import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { logStart, logDone, logError } from '@/lib/video-logger';
import { estimateSegmentCost } from '@/lib/video-cost';
import { recordSegmentVersion } from '@/lib/video-segment-versions';

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Confirmed in production: when Anthropic's own model-overload retries give
// up, the session doesn't error out — it goes `session.status_idle` with
// `stop_reason: { type: "retries_exhausted" }` and just sits there, having
// silently dropped the turn. The message was never actually answered, so
// the only way to get a real response is to resend it — polling the same
// (now-idle) session's stream again just hangs forever waiting for events
// that will never come, since nothing is running anymore.
//
// Resending is only safe for agents whose work is READ-ONLY. A dropped turn
// still ran its tool calls, so resending a brief that says "direct the full
// shoot" makes the director shoot the whole video a second time and bill for
// it — confirmed in production, where four resends of one execute brief
// produced several shoots' worth of Higgsfield jobs and six usable clips.
// Generation phases therefore pass maxAttempts: 1 and surface the failure, so
// the session can be resumed with `continue` instead of restarted.
async function sendAndAwaitResponse(sessionId, message, { maxAttempts = 4 } = {}) {
  return withSessionLock(sessionId, async () => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await client.beta.sessions.events.send(sessionId, {
        events: [{ type: 'user.message', content: [{ type: 'text', text: message }] }],
      });
      try {
        return await streamAgentResponse(sessionId);
      } catch (err) {
        if (err.retriesExhausted && attempt < maxAttempts) {
          await sleep(15000 * attempt);
          continue;
        }
        throw err;
      }
    }
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
    stillResolution: settings?.stillResolution || '2k',
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
//
// Both take a normalized shape rather than assuming an {article, section} —
// video-pipeline.service.js's resolvePostContent() resolves this from either
// an article+section (normal post) or customTitle/customContent/
// customCharacter (a custom video, no article/section at all), so these
// stay completely agnostic to the source.
// ---------------------------------------------------------------------------
function buildPlanBrief({ title, summary, contentText, character, environment, config }) {
  return `TITLE: ${title}
${summary ? `SUMMARY: ${summary}\n` : ''}CONTENT:
${contentText}

CHARACTER:
- Name: ${character.name || ''}
- Biography/Persona: ${character.persona || ''}
- Tone: ${character.tone || ''}

ENVIRONMENT: ${environment?.name || 'KG Media Loft'}
${environment?.textDescriptor || ''}

CONFIG:
- platform: ${config.platform}
- style: ${config.style}
- targetShotCount: ${config.shotCount ?? 'auto'}
- orientation: ${config.orientation}`;
}

function buildExecuteBrief({ character, environment, config, promptLearnings }) {
  const learningsBlock = promptLearnings?.length
    ? `\nRECENT CONTENT-FILTER LEARNINGS (avoid these patterns):\n${promptLearnings
        .map((l) => `- [${l.failureType}] "${l.triggerPhrase}"${l.safeRewrite ? ` → use: "${l.safeRewrite}"` : ''}`)
        .join('\n')}`
    : '';

  return `CHARACTER:
- Name: ${character.name || ''}
- Biography/Persona: ${character.persona || ''}
- Tone: ${character.tone || ''}
- Reference Element ID (a real trained person): ${character.videoCharacterId}
  Wherever this character should appear or be referenced, write this EXACT ID VALUE wrapped in triple angle brackets directly inside the generate_image/generate_video prompt text — i.e. literally type <<<${character.videoCharacterId}>>> (substituting the real ID above). Do NOT write the literal text "<<<elementId>>>" — "elementId" is just this field's label in these instructions, not something to copy verbatim. Writing the label instead of the real ID means Higgsfield receives no reference at all and generates a random person.

ENVIRONMENT: ${environment?.name || 'KG Media Loft'}
${environment?.textDescriptor || ''}

CONFIG:
- orientation: ${config.orientation} (pass this EXACT value as aspect_ratio on every generate_image/generate_video call)
- stillResolution: ${config.stillResolution} (pass this EXACT value as params.resolution on every generate_image call — the model defaults to 1k, which is too soft for legible text)${learningsBlock}`;
}

// ---------------------------------------------------------------------------
// planVideoPost — Phase 1: text-only draft, no Higgsfield spend at all (the
// Planner Agent has zero generation tools). Opens (or reuses) the planner
// session for this post. Two modes:
//   - MODE: initial  — no existingPlan given yet, write a complete fresh plan.
//   - MODE: revision — existingPlan given; a TARGETED EDIT of only what the
//     directorNote asks for, not a fresh rewrite, unless the note says so.
// ---------------------------------------------------------------------------
export async function planVideoPost({ campaignId, postId, title, summary, contentText, character, environment, config, existingPlan, directorNote, settings }) {
  if (!settings?.plannerAgentId || !settings?.plannerEnvironmentId) {
    throw new Error(
      'Video Planner Agent IDs not configured. Set plannerAgentId and plannerEnvironmentId in Video Settings.',
    );
  }
  if (!character?.videoCharacterId) {
    throw new Error(`Character "${character?.name}" has no Higgsfield Reference Element yet — train it from Video → Characters first.`);
  }

  const freshPost = await prisma.videoPost.findUnique({ where: { id: postId }, select: { planSessionId: true } });
  let sessionId = freshPost?.planSessionId;
  const needsBrief = !sessionId;

  if (needsBrief) {
    const sessionLogId = await logStart(campaignId, 'planner_session', `Creating planner agent session for "${title}"`, null, postId);
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
    await logStart(campaignId, 'planner_session', `Reusing planner session for "${title}" (re-plan)`, { sessionId }, postId);
  }

  const mode = existingPlan ? 'revision' : 'initial';
  const briefBlock = needsBrief ? `${buildPlanBrief({ title, summary, contentText, character, environment, config })}\n\n` : '';
  const modeBlock = mode === 'revision'
    ? `EXISTING PLAN:\n${JSON.stringify(existingPlan, null, 2)}\n\nDIRECTOR NOTE: ${directorNote || '(no specific note given — just double-check everything still reads well)'}\n\nThis is a targeted edit: change ONLY what the note asks for and leave everything else exactly as it was, unless the note explicitly asks you to start over or rewrite everything.`
    : `${directorNote ? `DIRECTOR NOTE: ${directorNote}\n\n` : ''}Write the full plan now.`;

  const message = `PHASE: plan\n\nMODE: ${mode}\n\n${briefBlock}${modeBlock}\n\nRespond with ONLY the OUTPUT FORMAT JSON described in your instructions.`;

  const aiLogId = await logStart(campaignId, 'planner_send', `${mode === 'initial' ? 'Drafting' : 'Revising'} plan for "${title}"`, { message, sessionId, mode }, postId);

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
// planAnchors — the plan's declared places and subjects, normalized.
//
// Plans written before named anchors existed carry a single `subjectAnchor`
// string instead; those become one subject anchor so an old plan re-approved
// today still keeps its closet description.
// ---------------------------------------------------------------------------
function planAnchors(plan) {
  if (Array.isArray(plan?.anchors) && plan.anchors.length) {
    return plan.anchors
      .filter((a) => a?.key && a?.description)
      .map((a, i) => ({
        key: String(a.key).trim(),
        kind: a.kind === 'subject' ? 'subject' : 'place',
        description: String(a.description).trim(),
        order: i,
      }));
  }
  if (plan?.subjectAnchor) {
    return [{ key: 'subject', kind: 'subject', description: plan.subjectAnchor, order: 0 }];
  }
  return [];
}

// ---------------------------------------------------------------------------
// generateVideoStills — Phase 3a: the plan was approved, so shoot the START
// FRAMES only and stop. Always opens a FRESH Director Agent session (a
// different agent than the Planner, so it can't share the Planner's session)
// and sends the brief + approved plan as the first message. Creates one
// VideoSegment row per planned segment up front (status "pending"), then
// records the anchor still on the post and each b-roll still on its segment.
//
// Nothing here generates video. A still is ~4 credits against ~29 for a 12s
// clip, and a malformed still (extra hand, backwards hardware) reliably
// becomes a malformed clip, so a human reviews these frames before
// shootVideoPost is allowed to spend the video budget.
//
// Always starting a brand-new session here (rather than reusing an old
// directorSessionId from a previous run) is deliberate: it guarantees a
// clean anchor still matching the CURRENT approved plan/characterLook, which
// matters if a post is re-approved after being revised post-execution.
// regenerateVideoSegment is the one that reuses a session, since it's
// specifically about staying consistent with an already-executed video.
// ---------------------------------------------------------------------------
export async function generateVideoStills({ campaignId, postId, title, character, environment, config, plan, directorNote, settings, promptLearnings }) {
  if (!settings?.directorAgentId || !settings?.directorEnvironmentId) {
    throw new Error(
      'Video Director Agent IDs not configured. Set directorAgentId and directorEnvironmentId in Video Settings.',
    );
  }
  if (!settings?.higgsfieldVaultId) {
    throw new Error('Higgsfield Vault ID not configured in Video Settings — required to authenticate the director agent\'s MCP calls.');
  }
  if (!character?.videoCharacterId) {
    throw new Error(`Character "${character?.name}" has no Higgsfield Reference Element yet — train it from Video → Characters first.`);
  }

  const sessionLogId = await logStart(campaignId, 'director_session', `Creating director agent session for "${title}"`, null, postId);
  const session = await client.beta.sessions.create({
    agent: settings.directorAgentId,
    environment_id: settings.directorEnvironmentId,
    vault_ids: [settings.higgsfieldVaultId],
  });
  const sessionId = session.id;
  await logDone(sessionLogId, `Session created: ${sessionId}`, { sessionId });
  await prisma.videoPost.update({ where: { id: postId }, data: { directorSessionId: sessionId } });

  const plannedSegments = plan.segments || [];
  const anchors = planAnchors(plan);
  const anchorKeySet = new Set(anchors.map((a) => a.key));
  const startedAt = new Date();

  await prisma.videoSegment.deleteMany({ where: { postId } });
  await prisma.videoSegment.createMany({
    data: plannedSegments.map((s) => ({
      postId,
      order: s.order,
      hasCharacter: !!s.hasCharacter,
      spokenPortion: s.spokenPortion || null,
      visualDescription: s.visualDescription || null,
      stillReferenceOrder: Number.isInteger(s.stillReferenceOrder) ? s.stillReferenceOrder : null,
      // A key naming an anchor that doesn't exist would send the director
      // looking for a frame nobody generated.
      anchorKeys: (Array.isArray(s.anchorKeys) ? s.anchorKeys : []).filter((k) => anchorKeySet.has(k)),
      wardrobeAddition: s.wardrobeAddition || null,
      status: 'pending',
      generationStartedAt: startedAt,
    })),
  });

  await prisma.videoAnchor.deleteMany({ where: { postId } });
  if (anchors.length) {
    await prisma.videoAnchor.createMany({ data: anchors.map((a) => ({ postId, ...a })) });
  }

  await prisma.videoPost.update({
    where: { id: postId },
    data: {
      anchorStillUrl: null,
      anchorStillJobId: null,
    },
  });

  const planText = JSON.stringify(
    {
      narration: plan.narration,
      characterLook: plan.characterLook,
      anchors: anchors.map(({ key, kind, description }) => ({ key, kind, description })),
      segments: plannedSegments.map((s) => ({
        order: s.order,
        hasCharacter: s.hasCharacter,
        spokenPortion: s.spokenPortion,
        visualDescription: s.visualDescription,
        estimatedDuration: s.estimatedDuration,
        anchorKeys: (Array.isArray(s.anchorKeys) ? s.anchorKeys : []).filter((k) => anchorKeySet.has(k)),
        wardrobeAddition: s.wardrobeAddition || null,
        stillReferenceOrder: Number.isInteger(s.stillReferenceOrder) ? s.stillReferenceOrder : null,
      })),
    },
    null,
    2,
  );

  const briefText = buildExecuteBrief({ character, environment, config, promptLearnings });

  const message = `PHASE: stills\n\n${briefText}\n\nAPPROVED PLAN:\n${planText}\n${directorNote ? `\nDIRECTOR NOTE: ${directorNote}\n` : ''}
Generate the START FRAMES ONLY: the location-free character anchor still, one frame for each of the ${anchors.length} declared anchor(s), then one frame for each of the ${plannedSegments.length} segment(s) — avatar segments included, each chained off the character anchor and its own anchors. Do NOT call generate_video for anything — a human reviews these frames before the shoot is unlocked. Respond with ONLY the STILLS OUTPUT FORMAT JSON described in your instructions.`;

  const aiLogId = await logStart(campaignId, 'director_stills_send', `Generating start frames for "${title}" (character anchor + ${anchors.length} anchor(s) + ${plannedSegments.length} segments)`, { message, sessionId }, postId);

  let responseText;
  try {
    // One attempt only — see sendAndAwaitResponse. A dropped turn has usually
    // already spent the Higgsfield budget, so re-sending would pay twice.
    responseText = await sendAndAwaitResponse(sessionId, message, { maxAttempts: 1 });
  } catch (err) {
    await logError(aiLogId, err.message);
    throw err;
  }

  let result;
  try {
    result = JSON.parse(extractJson(responseText));
  } catch {
    await logError(aiLogId, `Agent returned invalid JSON: ${responseText.slice(0, 200)}`, { response: responseText });
    throw new Error(`Director agent returned invalid stills JSON: ${responseText.slice(0, 200)}`);
  }

  await prisma.videoPost.update({
    where: { id: postId },
    data: {
      anchorStillUrl: result.anchorStill?.url || null,
      anchorStillJobId: result.anchorStill?.jobId || null,
    },
  });

  for (const anchorStill of result.anchorStills || []) {
    if (!anchorStill?.key || !anchorKeySet.has(anchorStill.key)) continue;
    await prisma.videoAnchor.update({
      where: { postId_key: { postId, key: anchorStill.key } },
      data: { stillUrl: anchorStill.url || null, stillJobId: anchorStill.jobId || null },
    });
  }

  for (const still of result.stills || []) {
    const row = await prisma.videoSegment.findFirst({ where: { postId, order: still.order } });
    if (!row) continue;
    await prisma.videoSegment.update({
      where: { id: row.id },
      data: {
        stillUrl: still.url || null,
        stillJobId: still.jobId || null,
        errorMessage: still.url ? null : (still.errorMessage || 'Still generation failed'),
      },
    });
  }

  const stillCount = (result.stills || []).filter((s) => s.url).length;
  await logDone(aiLogId, `Start frames ready — ${stillCount} still(s) awaiting review`, { response: responseText, parsed: result });

  return { result, sessionId };
}

// ---------------------------------------------------------------------------
// regenerateVideoStill — a human rejected one start frame. Redoes just that
// frame in the same session so the replacement stays usable as a start_image
// for the eventual shoot.
// ---------------------------------------------------------------------------
export async function regenerateVideoStill({ postId, target, order, key, note }) {
  const post = await prisma.videoPost.findUnique({ where: { id: postId } });
  if (!post?.directorSessionId) {
    const err = new Error('This post has no director session — approve the plan to generate its start frames first.');
    err.code = 'INVALID_REQUEST';
    throw err;
  }

  const isAnchor = target === 'anchor';
  const isAnchorKey = target === 'anchorKey';

  let anchor = null;
  if (isAnchorKey) {
    anchor = await prisma.videoAnchor.findUnique({ where: { postId_key: { postId, key } } });
    if (!anchor) {
      const err = new Error(`This post has no anchor named "${key}".`);
      err.code = 'INVALID_REQUEST';
      throw err;
    }
  }

  const label = isAnchor
    ? 'the character anchor still'
    : isAnchorKey
      ? `the anchor frame for "${key}"`
      : `the still for segment ${order}`;

  const targetBlock = isAnchor
    ? 'TARGET: anchor'
    : isAnchorKey
      ? `TARGET: anchorKey\nKEY: ${key}\nANCHOR (${anchor.kind}): ${anchor.description}`
      : `TARGET: segment\nORDER: ${order}`;

  const message = `PHASE: regenerate_still

A human rejected ${label}. Generate that ONE still again, addressing the note below, and keep everything else about the frame as it was.
${targetBlock}
NOTE: ${note || '(no specific note — the frame just looked wrong; produce a cleaner take)'}

Do not generate video, and do not touch any other still. Respond with ONLY the SINGLE STILL OUTPUT FORMAT JSON described in your instructions.`;

  const aiLogId = await logStart(post.campaignId, 'director_still_regenerate', `Regenerating ${label}`, { message, sessionId: post.directorSessionId }, postId);

  let responseText;
  try {
    responseText = await sendAndAwaitResponse(post.directorSessionId, message, { maxAttempts: 1 });
  } catch (err) {
    await logError(aiLogId, err.message);
    throw err;
  }

  let result;
  try {
    result = JSON.parse(extractJson(responseText));
  } catch {
    await logError(aiLogId, `Agent returned invalid JSON: ${responseText.slice(0, 200)}`, { response: responseText });
    throw new Error(`Director agent returned invalid still JSON: ${responseText.slice(0, 200)}`);
  }

  if (!result.url) {
    await logError(aiLogId, result.errorMessage || 'Still regeneration failed', { response: responseText });
    throw new Error(result.errorMessage || 'Still regeneration failed');
  }

  if (isAnchor) {
    await prisma.videoPost.update({
      where: { id: postId },
      data: { anchorStillUrl: result.url, anchorStillJobId: result.jobId || null },
    });
  } else if (isAnchorKey) {
    await prisma.videoAnchor.update({
      where: { postId_key: { postId, key } },
      data: { stillUrl: result.url, stillJobId: result.jobId || null },
    });
  } else {
    const row = await prisma.videoSegment.findFirst({ where: { postId, order } });
    if (row) {
      await prisma.videoSegment.update({
        where: { id: row.id },
        data: { stillUrl: result.url, stillJobId: result.jobId || null, errorMessage: null },
      });
    }
  }

  await logDone(aiLogId, `${label.charAt(0).toUpperCase()}${label.slice(1)} regenerated`, { response: responseText, parsed: result });

  return result;
}

// ---------------------------------------------------------------------------
// shootVideoPost — Phase 3b: the human approved the start frames, so now spend
// the video budget. Reuses the same director session the stills were made in,
// which is what keeps their job ids valid as start_image references.
// ---------------------------------------------------------------------------
export async function shootVideoPost({ postId, directorNote }) {
  const post = await prisma.videoPost.findUnique({
    where: { id: postId },
    include: { segments: { orderBy: { order: 'asc' } } },
  });
  if (!post?.directorSessionId) {
    const err = new Error('This post has no director session — approve the plan to generate its start frames first.');
    err.code = 'INVALID_REQUEST';
    throw err;
  }
  if (!post.anchorStillJobId) {
    const err = new Error('This post has no approved anchor still to shoot from.');
    err.code = 'INVALID_REQUEST';
    throw err;
  }

  // Avatar segments predating per-segment character frames fall back to the
  // shared anchor, so an older post can still be shot or re-shot.
  const stillJobIdFor = (s) => s.stillJobId || (s.hasCharacter ? post.anchorStillJobId : null);

  const missingStill = post.segments.find((s) => !stillJobIdFor(s));
  if (missingStill) {
    const err = new Error(`Segment ${missingStill.order} has no start frame yet — regenerate it before shooting.`);
    err.code = 'INVALID_REQUEST';
    throw err;
  }

  const stillMap = post.segments
    .map((s) => `- segment ${s.order} (${s.hasCharacter ? 'avatar' : 'b-roll'}): start_image job id ${stillJobIdFor(s)}`)
    .join('\n');

  const message = `PHASE: shoot

A human reviewed and approved every start frame. Shoot the clips now, each starting from exactly the approved still listed below — do not generate any new stills.

APPROVED STILLS:
${stillMap}
${directorNote ? `\nDIRECTOR NOTE: ${directorNote}\n` : ''}
Generate one clip per segment, in order, with native audio and the exact configured orientation on every call. Respond with ONLY the SHOOT OUTPUT FORMAT JSON described in your instructions.`;

  await prisma.videoSegment.updateMany({
    where: { postId },
    data: { status: 'generating', generationStartedAt: new Date(), errorMessage: null },
  });

  const aiLogId = await logStart(post.campaignId, 'director_shoot_send', `Shooting ${post.segments.length} approved segment(s)`, { message, sessionId: post.directorSessionId }, postId);

  let responseText;
  try {
    responseText = await sendAndAwaitResponse(post.directorSessionId, message, { maxAttempts: 1 });
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
    throw new Error(`Director agent returned invalid shoot JSON: ${responseText.slice(0, 200)}`);
  }

  const succeeded = await applyExecuteSegments({ postId, result, directorNote });
  await logDone(aiLogId, `Shoot complete — ${succeeded}/${post.segments.length} segments generated`, { response: responseText, parsed: result });

  return { result, sessionId: post.directorSessionId };
}

// Writes an EXECUTE-shaped agent response onto the post's segment rows. Shared
// by shootVideoPost and continueVideoPost so a resumed shoot is recorded
// exactly like an uninterrupted one.
async function applyExecuteSegments({ postId, result, directorNote }) {
  const completedAt = new Date();
  const resultSegments = result.segments || [];

  for (const seg of resultSegments) {
    const hasVideo = !!seg.videoUrl;
    const estimatedCost = estimateSegmentCost({ hasCharacter: seg.hasCharacter, duration: seg.duration });
    const row = await prisma.videoSegment.findFirst({ where: { postId, order: seg.order } });
    if (!row) continue;

    // Never let a segment the agent couldn't deliver this time erase a clip
    // that's already there — that clip was paid for.
    if (!hasVideo && row.videoUrl) continue;

    await prisma.videoSegment.update({
      where: { id: row.id },
      data: {
        spokenPortion: seg.spokenPortion || undefined,
        visualDescription: seg.visualDescription || undefined,
        videoUrl: seg.videoUrl || null,
        duration: seg.duration || null,
        higgsfieldJobId: seg.higgsfieldJobId || null,
        status: hasVideo ? 'completed' : 'failed',
        errorMessage: hasVideo ? null : (seg.errorMessage || 'Segment generation failed'),
        generationCompletedAt: completedAt,
        estimatedCost,
      },
    });

    await recordSegmentVersion(row.id, {
      videoUrl: seg.videoUrl,
      duration: seg.duration,
      higgsfieldJobId: seg.higgsfieldJobId,
      estimatedCost,
      note: directorNote || null,
    });
  }

  return resultSegments.filter((s) => s.videoUrl).length;
}

// ---------------------------------------------------------------------------
// continueVideoPost — resumes an interrupted shoot in the SAME director
// session instead of starting over.
//
// When Anthropic drops a turn (credit exhaustion, model overload) the agent
// has usually already fired its Higgsfield jobs; only the reply was lost. The
// clips exist and are billed. Re-approving the plan would open a fresh session
// and shoot everything again, so this asks the existing session to report the
// work it already did and finish only what's genuinely missing.
// ---------------------------------------------------------------------------
export async function continueVideoPost({ postId }) {
  const post = await prisma.videoPost.findUnique({
    where: { id: postId },
    include: { segments: { orderBy: { order: 'asc' } } },
  });
  if (!post) throw new Error(`Post not found: ${postId}`);

  const sessionId = post.directorSessionId;
  if (!sessionId) {
    const err = new Error('This post has no director session to continue — approve the plan to start the shoot.');
    err.code = 'INVALID_REQUEST';
    throw err;
  }

  const missing = post.segments.filter((s) => !s.videoUrl);
  if (!missing.length) {
    const err = new Error('Every segment already has a clip — nothing to continue.');
    err.code = 'INVALID_REQUEST';
    throw err;
  }

  const haveList = post.segments
    .filter((s) => s.videoUrl)
    .map((s) => s.order)
    .join(', ') || 'none';

  const message = `PHASE: continue

Your previous turn was cut short by an infrastructure error before you could reply. The Higgsfield jobs you had already started still ran and were still billed, so treat them as done.

Do NOT start the shoot over. Do NOT re-generate any segment that already has a clip.

Segments already recorded on our side: ${haveList}
Segments still missing a clip: ${missing.map((s) => s.order).join(', ')}

First, for any job you already submitted, call job_status to collect its finished URL — reuse it rather than generating again. Only generate for segments that have no job at all.

Respond with ONLY the SHOOT OUTPUT FORMAT JSON described in your instructions, covering every segment you can account for.`;

  const aiLogId = await logStart(post.campaignId, 'director_continue', `Continuing shoot — ${missing.length} segment(s) missing`, { message, sessionId }, postId);

  await prisma.videoSegment.updateMany({
    where: { postId, videoUrl: null },
    data: { status: 'generating', errorMessage: null, generationStartedAt: new Date(), generationCompletedAt: null },
  });

  let responseText;
  try {
    responseText = await sendAndAwaitResponse(sessionId, message, { maxAttempts: 1 });
  } catch (err) {
    await logError(aiLogId, err.message);
    await prisma.videoSegment.updateMany({
      where: { postId, videoUrl: null },
      data: { status: 'failed', errorMessage: err.message, generationCompletedAt: new Date() },
    });
    throw err;
  }

  let result;
  try {
    result = JSON.parse(extractJson(responseText));
  } catch {
    await logError(aiLogId, `Agent returned invalid JSON: ${responseText.slice(0, 200)}`, { response: responseText });
    await prisma.videoSegment.updateMany({
      where: { postId, videoUrl: null },
      data: { status: 'failed', errorMessage: 'Director agent returned invalid JSON', generationCompletedAt: new Date() },
    });
    throw new Error(`Director agent returned invalid continue JSON: ${responseText.slice(0, 200)}`);
  }

  const succeeded = await applyExecuteSegments({ postId, result, directorNote: null });

  // Anything still clipless after the agent's best effort shouldn't sit in
  // "generating" forever.
  await prisma.videoSegment.updateMany({
    where: { postId, videoUrl: null, status: 'generating' },
    data: { status: 'failed', errorMessage: 'Not recovered on continue', generationCompletedAt: new Date() },
  });

  await logDone(aiLogId, `Continue complete — ${succeeded} segment(s) accounted for`, { response: responseText, parsed: result });

  return { result, sessionId };
}

// ---------------------------------------------------------------------------
// regenerateVideoSegment — redoes exactly one segment, reusing the post's
// existing DIRECTOR session (from generateVideoStills) so the agent retains
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
    // Single attempt — a resend would shoot this segment twice (see
    // sendAndAwaitResponse).
    responseText = await sendAndAwaitResponse(sessionId, message, { maxAttempts: 1 });
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
  const estimatedCost = estimateSegmentCost({ hasCharacter: result.hasCharacter ?? segment.hasCharacter, duration: result.duration });
  // A failed regeneration must not wipe the take that's already there — the
  // previous clip stays live until something better actually arrives.
  const updated = await prisma.videoSegment.update({
    where: { id: segment.id },
    data: {
      spokenPortion: result.spokenPortion || segment.spokenPortion,
      visualDescription: result.visualDescription || segment.visualDescription,
      videoUrl: hasVideo ? result.videoUrl : segment.videoUrl,
      duration: hasVideo ? result.duration || null : segment.duration,
      higgsfieldJobId: hasVideo ? result.higgsfieldJobId || null : segment.higgsfieldJobId,
      status: hasVideo || segment.videoUrl ? 'completed' : 'failed',
      errorMessage: hasVideo ? null : (result.errorMessage || 'Segment generation failed'),
      generationCompletedAt: new Date(),
      estimatedCost: hasVideo ? estimatedCost : segment.estimatedCost,
    },
  });

  await recordSegmentVersion(segment.id, {
    videoUrl: result.videoUrl,
    duration: result.duration,
    higgsfieldJobId: result.higgsfieldJobId,
    estimatedCost,
    note,
  });

  await logDone(aiLogId, hasVideo ? `Segment ${segment.order} regenerated` : `Segment ${segment.order} failed: ${result.errorMessage || 'unknown'}`, { response: responseText, parsed: result });

  return hasVideo ? prisma.videoSegment.findUnique({ where: { id: segment.id } }) : updated;
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
  let textParts = [];
  let done = false;

  while (!done) {
    const stream = await client.beta.sessions.events.stream(sessionId);

    for await (const event of stream) {
      const evType = event.type;

      if (evType === 'agent.message') {
        for (const block of event.content ?? []) {
          if (block.type === 'text' && block.text) textParts.push(block.text);
        }
      } else if (evType === 'user.message') {
        // A user message mid-stream means a new turn is starting, so
        // everything collected so far answered a previous one. This happens
        // for real: sending to a session whose last turn was dropped makes
        // the platform resume that turn first and queue ours behind it, and
        // both answers then arrive on the same stream. Keeping both produced
        // a reply containing two JSON objects that parsed as neither.
        textParts = [];
      } else if (evType === 'session.status_idle') {
        if (event.stop_reason?.type === 'end_turn') {
          done = true;
          break;
        }
        if (event.stop_reason?.type === 'requires_action') {
          throw new Error(`Session ${sessionId} unexpectedly requires manual action: ${JSON.stringify(event.stop_reason)}`);
        }
        if (event.stop_reason?.type === 'retries_exhausted') {
          const err = new Error(`Session ${sessionId} gave up retrying its model call (stop_reason: retries_exhausted) — the turn was dropped and needs to be resent.`);
          err.retriesExhausted = true;
          throw err;
        }
      } else if (
        evType === 'session.status_terminated' ||
        evType === 'session.deleted'
      ) {
        done = true;
        break;
      } else if (evType === 'session.error') {
        // Anthropic's own model_overloaded_error (and similar) reports
        // retry_status: "retrying" — the platform is already retrying
        // server-side, so this isn't fatal; just keep tailing the stream
        // (the outer while-loop re-opens it) instead of failing the whole
        // request over a transient blip.
        if (event.error?.retry_status?.type === 'retrying') continue;
        // retry_status: "exhausted" means the platform gave up — this is
        // immediately followed by a session.status_idle with stop_reason
        // "retries_exhausted" (same dropped-turn condition handled below),
        // so treat it identically: the caller needs to resend, not just
        // keep listening.
        if (event.error?.retry_status?.type === 'exhausted') {
          const err = new Error(`Session ${sessionId} exhausted retries on a model_overloaded_error — the turn was dropped and needs to be resent.`);
          err.retriesExhausted = true;
          throw err;
        }
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

/**
 * Pull the agent's JSON answer out of a reply that may also contain prose.
 *
 * Deliberately takes the LAST parseable object rather than the first. A reply
 * can legitimately carry more than one JSON block — a resumed turn's answer
 * followed by the answer to the message that resumed it, say — and the naive
 * first-brace-to-last-brace match then spans both and parses as nothing. That
 * cost a real 11-segment shoot: every clip existed and was billed, but the
 * reply describing them was thrown away as invalid. The last block is the
 * agent's most recent word on the subject, which is the one we want.
 */
function extractJson(text) {
  if (!text) return text;

  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1].trim());
  for (const block of fenced.reverse()) {
    try {
      JSON.parse(block);
      return block;
    } catch { /* not this one */ }
  }

  // No usable fence — walk the raw text for balanced top-level objects,
  // ignoring braces that appear inside string literals.
  const candidates = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  for (const candidate of candidates.reverse()) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch { /* keep looking backwards */ }
  }

  return text;
}

export function extractPlainText(contentJson) {
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
