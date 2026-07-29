import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { logStart, logDone, logError } from '@/lib/video-logger';
import { estimateSegmentCost } from '@/lib/video-cost';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'managed-agents-2026-04-01' },
});

// ---------------------------------------------------------------------------
// Per-session mutex. `sessions.events.stream()` is a live tail, not a replay
// from a cursor — if two requests both send a message to the SAME session
// and both start streaming around the same time, they each just see
// whatever end_turn happens next, regardless of which of their own messages
// it was actually replying to. Confirmed as a real production bug: two
// "regenerate segment" clicks fired close together on the same post ended
// up with THREE segments (all in flight against the same director session)
// all receiving the identical single response meant for only the last one,
// silently overwriting each other's video/text. Every place that sends a
// message to a session that could conceivably be reused concurrently (i.e.
// any session-reuse, not fresh-session-per-call) must serialize through
// this so a second call always waits for the first call's full turn to
// finish before sending its own message.
// ---------------------------------------------------------------------------
const sessionLocks = new Map();

function withSessionLock(sessionId, fn) {
  const previous = sessionLocks.get(sessionId) || Promise.resolve();
  const run = previous.then(fn, fn);
  const chained = run.catch(() => {});
  sessionLocks.set(sessionId, chained);
  chained.finally(() => {
    if (sessionLocks.get(sessionId) === chained) sessionLocks.delete(sessionId);
  });
  return run;
}

async function sendAndAwaitResponse(sessionId, message) {
  return withSessionLock(sessionId, async () => {
    await client.beta.sessions.events.send(sessionId, {
      events: [{ type: 'user.message', content: [{ type: 'text', text: message }] }],
    });
    return streamAgentResponse(sessionId);
  });
}

// ---------------------------------------------------------------------------
// resolveVideoConfig
// Effective Plan → Approve → Execute config for a post: per-post override,
// falling back to the campaign's cycle-level default, falling back to the
// global VideoSettings default.
// ---------------------------------------------------------------------------
export function resolveVideoConfig({ post, campaign, settings }) {
  return {
    platform: post?.targetPlatform || campaign?.targetPlatform || settings?.defaultTargetPlatform || 'auto',
    style: post?.videoStyle || campaign?.videoStyle || settings?.defaultVideoStyle || 'auto',
    shotCount: post?.targetShotCount ?? campaign?.targetShotCount ?? settings?.defaultTargetShotCount ?? null,
    orientation: post?.orientation || campaign?.orientation || settings?.defaultOrientation || '9:16',
  };
}

// ---------------------------------------------------------------------------
// selectVideoArticles
// Unchanged from the previous pipeline — reuses the same Managed Agent
// session across campaigns, rotates after N runs — returns one flat list of
// approved article IDs.
// ---------------------------------------------------------------------------
export async function selectVideoArticles({ articles, campaign, settings, memory }) {
  let sessionId = memory.activeSessionId;

  if (!sessionId) {
    if (!settings.approvalAgentId || !settings.approvalEnvironmentId) {
      throw new Error(
        'Video Approval Agent IDs not configured. Set approvalAgentId and approvalEnvironmentId in Video Settings.',
      );
    }

    const sessionLogId = await logStart(campaign.id, 'approval_session', 'Creating new video approval agent session');
    const session = await client.beta.sessions.create({
      agent: settings.approvalAgentId,
      environment_id: settings.approvalEnvironmentId,
    });
    sessionId = session.id;
    await logDone(sessionLogId, `Session created: ${sessionId}`, { sessionId });

    await prisma.videoAiMemory.upsert({
      where: { id: 'singleton' },
      update: { activeSessionId: sessionId, sessionCampaignCount: 0 },
      create: { id: 'singleton', activeSessionId: sessionId, sessionCampaignCount: 0 },
    });

    if (memory.handoffSummary) {
      const handoffLogId = await logStart(campaign.id, 'approval_handoff', 'Injecting handoff context from previous session', { summary: memory.handoffSummary });
      await withSessionLock(sessionId, () =>
        client.beta.sessions.events.send(sessionId, {
          events: [
            {
              type: 'user.message',
              content: [
                {
                  type: 'text',
                  text: `[EDITORIAL CONTEXT FROM PREVIOUS SESSION]\n\n${memory.handoffSummary}\n\n[END CONTEXT]`,
                },
              ],
            },
          ],
        }),
      );
      await logDone(handoffLogId, 'Handoff context injected');
    }
  } else {
    await logStart(campaign.id, 'approval_session', `Reusing existing session: ${sessionId}`, { sessionId });
  }

  const articleList = articles
    .map(
      (a, i) =>
        `${i + 1}. ID: ${a.id} | Title: ${a.title} | Section: ${a.sectionName || ''} | Category: ${a.categoryName || ''} | Summary: ${(a.summary || '').slice(0, 200)}`,
    )
    .join('\n');

  const maxVideos = campaign.maxVideos || settings.defaultMaxVideosPerCampaign || 5;

  const filterNotes = [
    campaign.editorsChoiceOnly ? 'Only editors-choice articles.' : null,
    campaign.includeSections?.length
      ? `Only sections: ${campaign.includeSections.join(', ')}.`
      : null,
    campaign.campaignBrief ? `Campaign brief: ${campaign.campaignBrief}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const taskMessage = `VIDEO CAMPAIGN APPROVAL — Cycle: ${new Date(campaign.weekStart).toDateString()} to ${new Date(campaign.weekEnd).toDateString()}

Candidate articles:
${articleList}

Maximum videos this cycle: ${maxVideos}

${filterNotes}

Based on your editorial memory of what has already received a video, select which articles deserve one this cycle. Return ONLY valid JSON in this exact format, no other text:
{
  "approvedArticleIds": ["article-id-1", "article-id-2"]
}`;

  const aiSendLogId = await logStart(
    campaign.id, 'approval_ai_send',
    `Sending ${articles.length} articles to video approval agent`,
    { message: taskMessage, sessionId },
  );
  let approvedArticleIds;
  try {
    const parsed = await sendSessionMessageAndParse(sessionId, taskMessage);
    approvedArticleIds = Array.isArray(parsed.approvedArticleIds) ? parsed.approvedArticleIds : [];
    await logDone(aiSendLogId, `Agent approved ${approvedArticleIds.length} article${approvedArticleIds.length !== 1 ? 's' : ''} for video`, { approvedArticleIds });
  } catch (err) {
    await logError(aiSendLogId, err.message);
    throw err;
  }

  await prisma.videoCampaign.update({
    where: { id: campaign.id },
    data: { approvalSessionId: sessionId },
  });

  const newCount = (memory.sessionCampaignCount || 0) + 1;
  const rotateAfter = memory.sessionRotateAfter || 10;
  if (newCount >= rotateAfter) {
    const summaryLogId = await logStart(campaign.id, 'approval_handoff_write', 'Session limit reached — requesting handoff summary');
    const summary = await requestHandoffSummary(sessionId);
    await logDone(summaryLogId, 'Handoff summary written, session will rotate on next campaign', { summary });
    await prisma.videoAiMemory.update({
      where: { id: 'singleton' },
      data: { handoffSummary: summary, activeSessionId: null, sessionCampaignCount: 0 },
    });
  } else {
    await prisma.videoAiMemory.update({
      where: { id: 'singleton' },
      data: { sessionCampaignCount: newCount },
    });
  }

  return approvedArticleIds;
}

// ---------------------------------------------------------------------------
// Brief builders — split in two because the Planner Agent and Director Agent
// are now two separate agent definitions with two separate sessions. The
// Planner never touches Higgsfield, so it never needs the Reference Element
// ID or content-filter learnings; the Director never needs the article body,
// since the Planner already turned it into narration.
// ---------------------------------------------------------------------------
function buildPlanBrief({ article, section, environment, config }) {
  const bodyText = extractPlainText(article.content);

  return `ARTICLE TITLE: ${article.title}
ARTICLE SUMMARY: ${article.summary || ''}
ARTICLE BODY:
${bodyText}

CHARACTER:
- Name: ${section.characterName || ''}
- Biography/Persona: ${section.characterPersona || section.characterBiography || ''}
- Tone: ${section.characterTone || ''}

ENVIRONMENT: ${environment?.name || 'KG Media Loft'}
${environment?.textDescriptor || ''}

CONFIG:
- platform: ${config.platform}
- style: ${config.style}
- targetShotCount: ${config.shotCount ?? 'auto'}
- orientation: ${config.orientation}`;
}

function buildExecuteBrief({ section, environment, config, promptLearnings }) {
  const learningsBlock = promptLearnings?.length
    ? `\nRECENT CONTENT-FILTER LEARNINGS (avoid these patterns):\n${promptLearnings
        .map((l) => `- [${l.failureType}] "${l.triggerPhrase}"${l.safeRewrite ? ` → use: "${l.safeRewrite}"` : ''}`)
        .join('\n')}`
    : '';

  return `CHARACTER:
- Name: ${section.characterName || ''}
- Biography/Persona: ${section.characterPersona || section.characterBiography || ''}
- Tone: ${section.characterTone || ''}
- Reference Element ID (a real trained person): ${section.videoCharacterId}
  Wherever this character should appear or be referenced, write this EXACT ID VALUE wrapped in triple angle brackets directly inside the generate_image/generate_video prompt text — i.e. literally type <<<${section.videoCharacterId}>>> (substituting the real ID above). Do NOT write the literal text "<<<elementId>>>" — "elementId" is just this field's label in these instructions, not something to copy verbatim. Writing the label instead of the real ID means Higgsfield receives no reference at all and generates a random person.

ENVIRONMENT: ${environment?.name || 'KG Media Loft'}
${environment?.textDescriptor || ''}

CONFIG:
- orientation: ${config.orientation} (pass this EXACT value as aspect_ratio on every generate_image/generate_video call)${learningsBlock}`;
}

// ---------------------------------------------------------------------------
// planVideoPost — Phase 1: text-only draft, no Higgsfield spend at all (the
// Planner Agent has zero generation tools). Opens (or reuses) the planner
// session for this post. Two modes:
//   - MODE: initial  — no existingPlan given yet, write a complete fresh plan.
//   - MODE: revision — existingPlan given; a TARGETED EDIT of only what the
//     directorNote asks for, not a fresh rewrite, unless the note says so.
// ---------------------------------------------------------------------------
export async function planVideoPost({ campaignId, postId, article, section, environment, config, existingPlan, directorNote, settings }) {
  if (!settings?.plannerAgentId || !settings?.plannerEnvironmentId) {
    throw new Error(
      'Video Planner Agent IDs not configured. Set plannerAgentId and plannerEnvironmentId in Video Settings.',
    );
  }
  if (!section?.videoCharacterId) {
    throw new Error(`Section "${section?.name}" has no Higgsfield Reference Element yet — create one from Video → Characters first.`);
  }

  const freshPost = await prisma.videoPost.findUnique({ where: { id: postId }, select: { planSessionId: true } });
  let sessionId = freshPost?.planSessionId;
  const needsBrief = !sessionId;

  if (needsBrief) {
    const sessionLogId = await logStart(campaignId, 'planner_session', `Creating planner agent session for "${article.title}"`, null, postId);
    const session = await client.beta.sessions.create({
      agent: settings.plannerAgentId,
      environment_id: settings.plannerEnvironmentId,
      // No vault_ids and no MCP server on this agent at all — the Planner
      // can never spend a real generation credit, by construction, not just instruction.
    });
    sessionId = session.id;
    await logDone(sessionLogId, `Session created: ${sessionId}`, { sessionId });
    await prisma.videoPost.update({ where: { id: postId }, data: { planSessionId: sessionId } });
  } else {
    await logStart(campaignId, 'planner_session', `Reusing planner session for "${article.title}" (re-plan)`, { sessionId }, postId);
  }

  const mode = existingPlan ? 'revision' : 'initial';
  const briefBlock = needsBrief ? `${buildPlanBrief({ article, section, environment, config })}\n\n` : '';
  const modeBlock = mode === 'revision'
    ? `EXISTING PLAN:\n${JSON.stringify(existingPlan, null, 2)}\n\nDIRECTOR NOTE: ${directorNote || '(no specific note given — just double-check everything still reads well)'}\n\nThis is a targeted edit: change ONLY what the note asks for and leave everything else exactly as it was, unless the note explicitly asks you to start over or rewrite everything.`
    : `${directorNote ? `DIRECTOR NOTE: ${directorNote}\n\n` : ''}Write the full plan now.`;

  const message = `PHASE: plan\n\nMODE: ${mode}\n\n${briefBlock}${modeBlock}\n\nRespond with ONLY the OUTPUT FORMAT JSON described in your instructions.`;

  const aiLogId = await logStart(campaignId, 'planner_send', `${mode === 'initial' ? 'Drafting' : 'Revising'} plan for "${article.title}"`, { message, sessionId, mode }, postId);

  let responseText;
  try {
    responseText = await sendAndAwaitResponse(sessionId, message);
  } catch (err) {
    await logError(aiLogId, err.message);
    throw err;
  }

  try {
    const plan = JSON.parse(extractJson(responseText));
    await logDone(aiLogId, `Plan drafted — ${(plan.segments || []).length} segment(s)`, { response: responseText, parsed: plan });
    return { plan, sessionId };
  } catch {
    await logError(aiLogId, `Agent returned invalid JSON: ${responseText.slice(0, 200)}`, { response: responseText });
    throw new Error(`Planner agent returned invalid plan JSON: ${responseText.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// executeVideoPost — Phase 3: the plan was approved. Always opens a FRESH
// Director Agent session (a different agent than the Planner, so it can't
// share the Planner's session) and resends the brief + approved plan as the
// first message. Creates one VideoSegment row per planned segment up front
// (status "generating"), then updates each row with the agent's final
// per-segment result (or failure) once the response comes back.
//
// Always starting a brand-new session here (rather than reusing an old
// directorSessionId from a previous execute) is deliberate: it guarantees a
// clean anchor still matching the CURRENT approved plan/characterLook, which
// matters if a post is re-approved after being revised post-execution.
// regenerateVideoSegment is the one that reuses a session, since it's
// specifically about staying consistent with an already-executed video.
// ---------------------------------------------------------------------------
export async function executeVideoPost({ campaignId, postId, article, section, environment, config, plan, directorNote, settings, promptLearnings }) {
  if (!settings?.directorAgentId || !settings?.directorEnvironmentId) {
    throw new Error(
      'Video Director Agent IDs not configured. Set directorAgentId and directorEnvironmentId in Video Settings.',
    );
  }
  if (!settings?.higgsfieldVaultId) {
    throw new Error('Higgsfield Vault ID not configured in Video Settings — required to authenticate the director agent\'s MCP calls.');
  }
  if (!section?.videoCharacterId) {
    throw new Error(`Section "${section?.name}" has no Higgsfield Reference Element yet — create one from Video → Characters first.`);
  }

  const sessionLogId = await logStart(campaignId, 'director_session', `Creating director agent session for "${article.title}"`, null, postId);
  const session = await client.beta.sessions.create({
    agent: settings.directorAgentId,
    environment_id: settings.directorEnvironmentId,
    vault_ids: [settings.higgsfieldVaultId],
  });
  const sessionId = session.id;
  await logDone(sessionLogId, `Session created: ${sessionId}`, { sessionId });
  await prisma.videoPost.update({ where: { id: postId }, data: { directorSessionId: sessionId } });

  const plannedSegments = plan.segments || [];
  const startedAt = new Date();

  await prisma.videoSegment.deleteMany({ where: { postId } });
  await prisma.videoSegment.createMany({
    data: plannedSegments.map((s) => ({
      postId,
      order: s.order,
      hasCharacter: !!s.hasCharacter,
      spokenPortion: s.spokenPortion || null,
      visualDescription: s.visualDescription || null,
      status: 'generating',
      generationStartedAt: startedAt,
    })),
  });

  const planText = JSON.stringify(
    {
      narration: plan.narration,
      characterLook: plan.characterLook,
      segments: plannedSegments.map((s) => ({
        order: s.order,
        hasCharacter: s.hasCharacter,
        spokenPortion: s.spokenPortion,
        visualDescription: s.visualDescription,
        estimatedDuration: s.estimatedDuration,
      })),
    },
    null,
    2,
  );

  const briefText = buildExecuteBrief({ section, environment, config, promptLearnings });

  const message = `PHASE: execute\n\n${briefText}\n\nAPPROVED PLAN:\n${planText}\n${directorNote ? `\nDIRECTOR NOTE: ${directorNote}\n` : ''}
Direct the full shoot now — generate_image + generate_video per segment, in order, with native audio and the exact configured orientation on every call. Respond with ONLY the EXECUTE OUTPUT FORMAT JSON described in your instructions.`;

  const aiLogId = await logStart(campaignId, 'director_execute_send', `Executing approved plan for "${article.title}" (${plannedSegments.length} segments)`, { message, sessionId }, postId);

  let responseText;
  try {
    responseText = await sendAndAwaitResponse(sessionId, message);
  } catch (err) {
    await logError(aiLogId, err.message);
    await prisma.videoSegment.updateMany({ where: { postId }, data: { status: 'failed', errorMessage: err.message, generationCompletedAt: new Date() } });
    throw err;
  }

  let result;
  try {
    result = JSON.parse(extractJson(responseText));
  } catch {
    await logError(aiLogId, `Agent returned invalid JSON: ${responseText.slice(0, 200)}`, { response: responseText });
    await prisma.videoSegment.updateMany({ where: { postId }, data: { status: 'failed', errorMessage: 'Director agent returned invalid JSON', generationCompletedAt: new Date() } });
    throw new Error(`Director agent returned invalid execute JSON: ${responseText.slice(0, 200)}`);
  }

  const completedAt = new Date();
  const resultSegments = result.segments || [];
  for (const seg of resultSegments) {
    const hasVideo = !!seg.videoUrl;
    await prisma.videoSegment.updateMany({
      where: { postId, order: seg.order },
      data: {
        spokenPortion: seg.spokenPortion || undefined,
        visualDescription: seg.visualDescription || undefined,
        videoUrl: seg.videoUrl || null,
        duration: seg.duration || null,
        higgsfieldJobId: seg.higgsfieldJobId || null,
        status: hasVideo ? 'completed' : 'failed',
        errorMessage: hasVideo ? null : (seg.errorMessage || 'Segment generation failed'),
        generationCompletedAt: completedAt,
        estimatedCost: estimateSegmentCost({ hasCharacter: seg.hasCharacter, duration: seg.duration }),
      },
    });
  }

  const succeeded = resultSegments.filter((s) => s.videoUrl).length;
  await logDone(aiLogId, `Execution complete — ${succeeded}/${plannedSegments.length} segments generated`, { response: responseText, parsed: result });

  return { result, sessionId };
}

// ---------------------------------------------------------------------------
// regenerateVideoSegment — redoes exactly one segment, reusing the post's
// existing DIRECTOR session (from executeVideoPost) so the agent retains
// full context — including the character anchor still's job id — of the
// rest of the already-executed video, without touching any other
// VideoSegment row.
// ---------------------------------------------------------------------------
export async function regenerateVideoSegment({ postId, segment, note, settings }) {
  const post = await prisma.videoPost.findUnique({ where: { id: postId }, select: { directorSessionId: true, campaignId: true } });
  const sessionId = post?.directorSessionId;
  if (!sessionId) throw new Error('Cannot regenerate a segment with no director session — run/approve execution first.');

  const startedAt = new Date();
  await prisma.videoSegment.update({
    where: { id: segment.id },
    data: { status: 'generating', errorMessage: null, generationStartedAt: startedAt, generationCompletedAt: null },
  });

  const message = `PHASE: regenerate_segment\n\nRegenerate ONLY this one segment — do not touch or re-mention any other segment.

SEGMENT TO REGENERATE:
{
  "order": ${segment.order},
  "hasCharacter": ${segment.hasCharacter},
  "spokenPortion": ${JSON.stringify(segment.spokenPortion || '')},
  "visualDescription": ${JSON.stringify(segment.visualDescription || '')}
}
${note ? `\nHUMAN NOTE: ${note}` : ''}

Respond with ONLY the REGENERATE OUTPUT FORMAT JSON described in your instructions.`;

  const aiLogId = await logStart(post.campaignId, 'director_segment_regenerate', `Regenerating segment ${segment.order}`, { message, sessionId }, postId);

  let responseText;
  try {
    responseText = await sendAndAwaitResponse(sessionId, message);
  } catch (err) {
    await logError(aiLogId, err.message);
    await prisma.videoSegment.update({ where: { id: segment.id }, data: { status: 'failed', errorMessage: err.message, generationCompletedAt: new Date() } });
    throw err;
  }

  let result;
  try {
    result = JSON.parse(extractJson(responseText));
  } catch {
    await logError(aiLogId, `Agent returned invalid JSON: ${responseText.slice(0, 200)}`, { response: responseText });
    await prisma.videoSegment.update({ where: { id: segment.id }, data: { status: 'failed', errorMessage: 'Director agent returned invalid JSON', generationCompletedAt: new Date() } });
    throw new Error(`Director agent returned invalid regenerate JSON: ${responseText.slice(0, 200)}`);
  }

  const hasVideo = !!result.videoUrl;
  const updated = await prisma.videoSegment.update({
    where: { id: segment.id },
    data: {
      spokenPortion: result.spokenPortion || segment.spokenPortion,
      visualDescription: result.visualDescription || segment.visualDescription,
      videoUrl: result.videoUrl || null,
      duration: result.duration || null,
      higgsfieldJobId: result.higgsfieldJobId || null,
      status: hasVideo ? 'completed' : 'failed',
      errorMessage: hasVideo ? null : (result.errorMessage || 'Segment generation failed'),
      generationCompletedAt: new Date(),
      estimatedCost: estimateSegmentCost({ hasCharacter: result.hasCharacter ?? segment.hasCharacter, duration: result.duration }),
    },
  });

  await logDone(aiLogId, hasVideo ? `Segment ${segment.order} regenerated` : `Segment ${segment.order} failed: ${result.errorMessage || 'unknown'}`, { response: responseText, parsed: result });

  return updated;
}

// ---------------------------------------------------------------------------
// createReferenceElement
// ADMIN ONLY — one-off session per section (see
// app/api/video/characters/[sectionId]/train). Unchanged.
// ---------------------------------------------------------------------------
export async function createReferenceElement({ sectionName, referenceImageUrls, settings }) {
  if (!settings?.characterAdminAgentId || !settings?.characterAdminEnvironmentId) {
    throw new Error(
      'Character Admin Agent not configured. Set characterAdminAgentId and characterAdminEnvironmentId in Video Settings.',
    );
  }
  if (!settings?.higgsfieldVaultId) {
    throw new Error('Higgsfield Vault ID not configured in Video Settings — required to authenticate the character admin agent\'s MCP calls.');
  }
  if (!referenceImageUrls?.length) {
    throw new Error('createReferenceElement requires at least one reference image URL');
  }

  const session = await client.beta.sessions.create({
    agent: settings.characterAdminAgentId,
    environment_id: settings.characterAdminEnvironmentId,
    vault_ids: [settings.higgsfieldVaultId],
  });

  const message = `SECTION: ${sectionName}

REFERENCE IMAGE URLS:
${referenceImageUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}

Import these images and create a Higgsfield Reference Element for this character, then respond with the final JSON described in your instructions.`;

  const responseText = await sendAndAwaitResponse(session.id, message);
  try {
    const result = JSON.parse(extractJson(responseText));
    return { ...result, sessionId: session.id };
  } catch {
    throw new Error(`Character admin agent returned invalid JSON: ${responseText.slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function sendSessionMessageAndParse(sessionId, message) {
  const text = await sendAndAwaitResponse(sessionId, message);
  try {
    return JSON.parse(extractJson(text));
  } catch {
    throw new Error(`Agent returned invalid JSON: ${text.slice(0, 300)}`);
  }
}

/**
 * Stream events from the session until the agent signals end_turn. All
 * generation tools this codebase's agents use (Higgsfield MCP, always_allow)
 * are executed by Anthropic server-side, so a well-behaved session should
 * never actually pause on requires_action — if one does, something needs
 * manual approval we didn't anticipate, so surface it as an explicit error
 * rather than silently deadlocking waiting for a tool result nobody sends.
 */
async function streamAgentResponse(sessionId) {
  const textParts = [];
  let done = false;

  while (!done) {
    const stream = await client.beta.sessions.events.stream(sessionId);

    for await (const event of stream) {
      const evType = event.type;

      if (evType === 'agent.message') {
        for (const block of event.content ?? []) {
          if (block.type === 'text' && block.text) textParts.push(block.text);
        }
      } else if (evType === 'session.status_idle') {
        if (event.stop_reason?.type === 'end_turn') {
          done = true;
          break;
        }
        if (event.stop_reason?.type === 'requires_action') {
          throw new Error(`Session ${sessionId} unexpectedly requires manual action: ${JSON.stringify(event.stop_reason)}`);
        }
      } else if (
        evType === 'session.status_terminated' ||
        evType === 'session.deleted'
      ) {
        done = true;
        break;
      } else if (evType === 'session.error') {
        throw new Error(`Agent session error: ${JSON.stringify(event)}`);
      }
    }
  }

  return textParts.join('').trim();
}

async function requestHandoffSummary(sessionId) {
  const summaryRequest = `Please write a concise handoff summary (max 500 words) of all video-approval decisions made in this session. Include:
- Which articles/sections received a video
- Content patterns you noticed (section balance, topics, formats)
- Any "avoid" signals from campaign briefs
- Recommendations for future cycles

This summary will be injected into your next session to maintain editorial continuity.`;

  try {
    return await sendSessionMessageAndParse(sessionId, `${summaryRequest}\n\nRespond with ONLY valid JSON: {"summary": "..."}`).then((r) => r.summary || '');
  } catch {
    return '';
  }
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

function extractPlainText(contentJson) {
  if (!contentJson) return '';
  if (contentJson.type === 'html' && typeof contentJson.html === 'string') {
    return contentJson.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (typeof contentJson === 'string') return contentJson;
  try {
    const doc = contentJson;
    const texts = [];
    function traverse(node) {
      if (node.type === 'text') texts.push(node.text || '');
      if (node.content) node.content.forEach(traverse);
    }
    traverse(doc);
    return texts.join(' ');
  } catch {
    return '';
  }
}
