import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { logStart, logDone, logError } from '@/lib/video-logger';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'managed-agents-2026-04-01' },
});

// ---------------------------------------------------------------------------
// selectVideoArticles
// Mirrors social-ai.service.js's selectApprovedPlatforms — reuses the same
// Managed Agent session across campaigns, rotates after N runs — but returns
// one flat list of approved article IDs instead of a per-platform map, since
// video approval is a single yes/no decision, not a platform placement.
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
      await client.beta.sessions.events.send(sessionId, {
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
      });
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
// directVideoPost
// One Managed Agent session per post (VideoPost.directorSessionId). This
// session directs the Higgsfield shoot itself via the hosted Higgsfield MCP
// server (generate_image/generate_video/job_status, always_allow) rather
// than custom tools — Anthropic executes those MCP calls server-side, so
// streamAgentResponse below never actually needs to dispatch a tool call for
// this agent; it just streams text/status until end_turn.
// ---------------------------------------------------------------------------
export async function directVideoPost({ campaignId, postId, article, section, environment, directorNote, settings, promptLearnings }) {
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

  const bodyText = extractPlainText(article.content);

  const freshPost = await prisma.videoPost.findUnique({
    where: { id: postId },
    select: { directorSessionId: true },
  });
  let sessionId = freshPost?.directorSessionId;
  const isFirstCall = !sessionId;

  if (isFirstCall) {
    const sessionLogId = await logStart(campaignId, 'director_session', `Creating director agent session for "${article.title}"`, null, postId);
    const session = await client.beta.sessions.create({
      agent: settings.directorAgentId,
      environment_id: settings.directorEnvironmentId,
      vault_ids: [settings.higgsfieldVaultId],
    });
    sessionId = session.id;
    await logDone(sessionLogId, `Session created: ${sessionId}`, { sessionId });

    await prisma.videoPost.update({
      where: { id: postId },
      data: { directorSessionId: sessionId },
    });
  } else {
    await logStart(campaignId, 'director_session', `Reusing director session for "${article.title}"`, { sessionId }, postId);
  }

  const learningsBlock = promptLearnings?.length
    ? `\nRECENT CONTENT-FILTER LEARNINGS (avoid these patterns):\n${promptLearnings
        .map((l) => `- [${l.failureType}] "${l.triggerPhrase}"${l.safeRewrite ? ` → use: "${l.safeRewrite}"` : ''}`)
        .join('\n')}`
    : '';

  const message = isFirstCall
    ? `ARTICLE TITLE: ${article.title}
ARTICLE SUMMARY: ${article.summary || ''}
ARTICLE BODY:
${bodyText}

CHARACTER:
- Name: ${section.characterName || ''}
- Biography/Persona: ${section.characterPersona || section.characterBiography || ''}
- Tone: ${section.characterTone || ''}
- Outfit: ${section.videoOutfitDescription || ''}
- elementId (embed as <<<elementId>>> in every generate_image/generate_video prompt): ${section.videoCharacterId}

ENVIRONMENT: ${environment?.name || 'KG Media Loft'}
${environment?.textDescriptor || ''}

TARGET DURATION: ${settings.defaultDuration || 15}s
TARGET ASPECT RATIO: ${settings.defaultAspectRatio || '9:16'}
DEFAULT GENRE: ${settings.defaultGenre || 'auto'}
${directorNote ? `\nDIRECTOR NOTE: ${directorNote}` : ''}${learningsBlock}

Write the narration script and shot script, then direct the full shoot yourself — still, silent base video, narration audio, and lip-sync — using generate_image, generate_video, generate_audio, and job_status until you have a completed, narrated, lip-synced video (or a clearly reported failure). Then respond with the final JSON described in your instructions.`
    : `${directorNote ? `DIRECTOR NOTE: ${directorNote}` : 'Please regenerate this video.'}${learningsBlock}

Write a fresh narration script and shot script and direct a new shoot using your tools, then respond with the final JSON.`;

  const aiLogId = await logStart(
    campaignId, 'director_ai_send',
    `${isFirstCall ? 'Directing' : 'Regenerating'} video for "${article.title}"`,
    { message, sessionId, isFirstCall },
    postId,
  );

  let responseText;
  try {
    await client.beta.sessions.events.send(sessionId, {
      events: [{ type: 'user.message', content: [{ type: 'text', text: message }] }],
    });
    responseText = await streamAgentResponse(sessionId);
  } catch (err) {
    await logError(aiLogId, err.message);
    throw err;
  }

  try {
    const result = JSON.parse(extractJson(responseText));
    await logDone(
      aiLogId,
      result.videoUrl
        ? `Video directed — ${(result.shotList || []).length} shots, ${result.duration || '?'}s`
        : `Director reported failure: ${result.errorMessage || 'unknown'}`,
      { response: responseText, parsed: result },
    );
    return { result, sessionId };
  } catch {
    await logError(aiLogId, `Agent returned invalid JSON: ${responseText.slice(0, 200)}`, { response: responseText });
    throw new Error(`Director agent returned invalid JSON: ${responseText.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// createReferenceElement
// ADMIN ONLY — one-off session per section (see
// app/api/video/characters/[sectionId]/train). Uses the dedicated Character
// Admin Agent (video-character-admin-agent.yaml), which imports the given
// reference image URLs and creates a Higgsfield Reference Element via MCP
// (media_import_url + show_reference_elements — both synchronous, so this
// resolves in one request/response round trip, no separate polling needed).
// Never called by the per-post Director Agent.
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

  await client.beta.sessions.events.send(session.id, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: message }] }],
  });

  const responseText = await streamAgentResponse(session.id);
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
  await client.beta.sessions.events.send(sessionId, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: message }] }],
  });
  const text = await streamAgentResponse(sessionId);
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
