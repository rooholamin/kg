import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { logStart, logDone, logError } from '@/lib/video-logger';
import * as higgsfield from '@/services/higgsfield.service';

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
// One Managed Agent session per post (VideoPost.directorSessionId). Unlike
// the Social content agent, this session actually calls custom tools
// (generate_image/generate_video/get_generation_status) to direct the shoot
// itself, so streamAgentResponse below handles agent.custom_tool_use events
// instead of assuming a pure text-in/JSON-out turn.
// ---------------------------------------------------------------------------
export async function directVideoPost({ campaignId, postId, article, section, environment, directorNote, settings, promptLearnings }) {
  if (!settings?.directorAgentId || !settings?.directorEnvironmentId) {
    throw new Error(
      'Video Director Agent IDs not configured. Set directorAgentId and directorEnvironmentId in Video Settings.',
    );
  }
  if (!section?.videoCharacterId) {
    throw new Error(`Section "${section?.name}" has no trained video character yet — train one from Video → Characters first.`);
  }

  higgsfield.resetGenerationBudget(postId);

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
- characterId (pass to generate_image): ${section.videoCharacterId}

ENVIRONMENT: ${environment?.name || 'KG Media Loft'}
${environment?.textDescriptor || ''}

TARGET DURATION: ${settings.defaultDuration || 15}s
TARGET ASPECT RATIO: ${settings.defaultAspectRatio || '9:16'}
DEFAULT GENRE: ${settings.defaultGenre || 'auto'}
${directorNote ? `\nDIRECTOR NOTE: ${directorNote}` : ''}${learningsBlock}

Write the script, then direct the shoot yourself using generate_image, generate_video, and get_generation_status until you have a completed video (or a clearly reported failure). Then respond with the final JSON described in your instructions.`
    : `${directorNote ? `DIRECTOR NOTE: ${directorNote}` : 'Please regenerate this video.'}${learningsBlock}

Write a fresh script and direct a new shoot using your tools, then respond with the final JSON.`;

  const aiLogId = await logStart(
    campaignId, 'director_ai_send',
    `${isFirstCall ? 'Directing' : 'Regenerating'} video for "${article.title}"`,
    { message, sessionId, isFirstCall },
    postId,
  );

  const toolContext = {
    postId,
    characterId: section.videoCharacterId,
    maxGenerationsPerPost: settings.maxGenerationsPerPost,
    campaignId,
  };

  let responseText;
  try {
    await client.beta.sessions.events.send(sessionId, {
      events: [{ type: 'user.message', content: [{ type: 'text', text: message }] }],
    });
    responseText = await streamAgentResponse(sessionId, toolContext);
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
 * Dispatches one agent.custom_tool_use call to the matching higgsfield.service
 * function. Returns a JSON string — custom tool results are always plain text
 * content blocks, so structured results are stringified.
 */
async function dispatchToolCall(name, input, context) {
  const { postId, characterId, maxGenerationsPerPost, campaignId } = context;
  const logId = await logStart(campaignId, `tool_${name}`, `Director called ${name}`, input, postId);

  try {
    let output;
    switch (name) {
      case 'generate_image':
        output = await higgsfield.generateImage({
          postId,
          prompt: input.prompt,
          aspectRatio: input.aspectRatio,
          characterId,
          maxGenerationsPerPost,
        });
        break;
      case 'generate_video':
        output = await higgsfield.generateVideo({
          postId,
          prompt: input.prompt,
          startImageUrl: input.startImageUrl,
          aspectRatio: input.aspectRatio,
          duration: input.duration,
          maxGenerationsPerPost,
        });
        break;
      case 'get_generation_status':
        output = await higgsfield.getGenerationStatus(input.requestId);
        break;
      default:
        throw new Error(`Unknown custom tool: ${name}`);
    }
    await logDone(logId, `${name} → ${output?.status || 'ok'}`, output);
    return JSON.stringify(output);
  } catch (err) {
    await logError(logId, err.message);
    return JSON.stringify({ error: err.message });
  }
}

/**
 * Stream events from the session until the agent signals end_turn, resolving
 * any custom tool calls (agent.custom_tool_use / requires_action) along the
 * way by dispatching to Higgsfield and sending user.custom_tool_result back.
 * toolContext is omitted for sessions that never use custom tools (the
 * approval agent) — dispatchToolCall is simply never reached in that case.
 */
async function streamAgentResponse(sessionId, toolContext) {
  const textParts = [];
  const eventsById = new Map();
  let done = false;

  while (!done) {
    const stream = await client.beta.sessions.events.stream(sessionId);

    for await (const event of stream) {
      if (event.id) eventsById.set(event.id, event);
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
          const eventIds = event.stop_reason.event_ids || [];
          const results = [];
          for (const eventId of eventIds) {
            const toolEvent = eventsById.get(eventId);
            if (!toolEvent || toolEvent.type !== 'agent.custom_tool_use') continue;
            const resultText = await dispatchToolCall(toolEvent.name, toolEvent.input || {}, toolContext || {});
            results.push({
              type: 'user.custom_tool_result',
              custom_tool_use_id: eventId,
              content: [{ type: 'text', text: resultText }],
            });
          }
          if (results.length) {
            await client.beta.sessions.events.send(sessionId, { events: results });
          }
          // Keep consuming the same stream — the session transitions back to
          // "running" and continues emitting events without needing a reconnect.
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
