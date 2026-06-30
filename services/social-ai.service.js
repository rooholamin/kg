import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { logStart, logDone, logError } from '@/lib/social-logger';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'managed-agents-2026-04-01' },
});

// ---------------------------------------------------------------------------
// Platform character limits
// ---------------------------------------------------------------------------
const CHAR_LIMITS = {
  instagram_carousel: 2200,
  instagram_story: 2200,
  linkedin: 3000,
  twitter: 280,
};

// ---------------------------------------------------------------------------
// Available slides reference
// ---------------------------------------------------------------------------
const AVAILABLE_SLIDES = {
  carousel: [
    'slide-01-cover',
    'slide-02-statement',
    'slide-03-image-text',
    'slide-04-narrative',
    'slide-05-pull-quote',
    'slide-06-key-stat',
    'slide-07-features',
    'slide-08-steps',
    'slide-09-full-image',
    'slide-10-image-box',
    'slide-11-end-card',
  ],
  story: [
    'story-01-cover-image',
    'story-02-dark-statement',
    'story-03-split-image',
    'story-04-pull-quote',
    'story-05-stat-card',
    'story-06-editorial-light',
  ],
  linkedin: [
    'linkedin-01-bottom-anchor',
    'linkedin-02-left-panel',
    'linkedin-03-center-vignette',
    'linkedin-04-stat-overlay',
    'linkedin-05-quote-overlay',
  ],
};

// ---------------------------------------------------------------------------
// selectApprovedPlatforms
// Reuses the same Managed Agent session across campaigns; rotates after N runs.
// ---------------------------------------------------------------------------
export async function selectApprovedPlatforms({ articles, campaign, settings, memory }) {
  let sessionId = memory.activeSessionId;

  // 1. Get or create session
  if (!sessionId) {
    if (!settings.approvalAgentId || !settings.approvalEnvironmentId) {
      throw new Error(
        'Anthropic Managed Agent IDs not configured. Set approvalAgentId and approvalEnvironmentId in Social Settings.',
      );
    }

    const sessionLogId = await logStart(campaign.id, 'approval_session', 'Creating new approval agent session');
    const session = await client.beta.sessions.create({
      agent: settings.approvalAgentId,
      environment_id: settings.approvalEnvironmentId,
    });
    sessionId = session.id;
    await logDone(sessionLogId, `Session created: ${sessionId}`, { sessionId });

    // Persist the new session ID
    await prisma.socialAiMemory.upsert({
      where: { id: 'singleton' },
      update: { activeSessionId: sessionId, sessionCampaignCount: 0 },
      create: { id: 'singleton', activeSessionId: sessionId, sessionCampaignCount: 0 },
    });

    // 2. If there's a handoff summary from a previous session, inject it first
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

  // 3. Build campaign task message
  const articleList = articles
    .map(
      (a, i) =>
        `${i + 1}. ID: ${a.id} | Title: ${a.title} | Section: ${a.sectionName || ''} | Category: ${a.categoryName || ''} | Summary: ${(a.summary || '').slice(0, 200)}`,
    )
    .join('\n');

  const maxPosts = campaign.maxPostsPerPlatform || {
    instagram_carousel: 3,
    instagram_story: 5,
    linkedin: 3,
    twitter: 7,
  };

  const filterNotes = [
    campaign.editorsChoiceOnly ? 'Only editors-choice articles.' : null,
    campaign.includeSections?.length
      ? `Only sections: ${campaign.includeSections.join(', ')}.`
      : null,
    campaign.campaignBrief ? `Campaign brief: ${campaign.campaignBrief}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const taskMessage = `WEEKLY SOCIAL APPROVAL — Week of ${new Date(campaign.weekStart).toDateString()} to ${new Date(campaign.weekEnd).toDateString()}

Candidate articles this week:
${articleList}

Limits (max posts per platform):
- instagram_carousel: ${maxPosts.instagram_carousel ?? 3}
- instagram_story: ${maxPosts.instagram_story ?? 5}
- linkedin: ${maxPosts.linkedin ?? 3}
- twitter: ${maxPosts.twitter ?? 7}

${filterNotes}

Based on your editorial memory of what has already been published, select which articles to approve for each platform. Return ONLY valid JSON in this exact format, no other text:
{
  "instagram_carousel": ["article-id-1", "article-id-2"],
  "instagram_story": ["article-id-3"],
  "linkedin": ["article-id-2", "article-id-4"],
  "twitter": ["article-id-1", "article-id-2", "article-id-3"]
}`;

  // 4. Send the task and get the response
  const aiSendLogId = await logStart(
    campaign.id, 'approval_ai_send',
    `Sending ${articles.length} articles to approval agent`,
    { message: taskMessage, sessionId },
  );
  let approvalMap;
  try {
    approvalMap = await sendSessionMessageAndParse(sessionId, taskMessage);
    const totalApproved = Object.values(approvalMap).reduce((s, arr) => s + arr.length, 0);
    await logDone(aiSendLogId, `Agent approved ${totalApproved} posts across platforms`, { approvalMap });
  } catch (err) {
    await logError(aiSendLogId, err.message);
    throw err;
  }

  // 5. Save session ID on the campaign + update memory counter
  const newCount = (memory.sessionCampaignCount || 0) + 1;
  await prisma.socialCampaign.update({
    where: { id: campaign.id },
    data: { approvalSessionId: sessionId },
  });

  // 6. Check if session should rotate
  const rotateAfter = memory.sessionRotateAfter || 10;
  if (newCount >= rotateAfter) {
    const summaryLogId = await logStart(campaign.id, 'approval_handoff_write', 'Session limit reached — requesting handoff summary');
    const summary = await requestHandoffSummary(sessionId);
    await logDone(summaryLogId, 'Handoff summary written, session will rotate on next campaign', { summary });
    await prisma.socialAiMemory.update({
      where: { id: 'singleton' },
      update: {
        handoffSummary: summary,
        activeSessionId: null,
        sessionCampaignCount: 0,
      },
    });
  } else {
    await prisma.socialAiMemory.update({
      where: { id: 'singleton' },
      data: { sessionCampaignCount: newCount },
    });
  }

  return approvalMap;
}

// ---------------------------------------------------------------------------
// Slide layout descriptions for the system prompt
// ---------------------------------------------------------------------------
const SLIDE_DESCRIPTIONS = {
  // Carousel
  'slide-01-cover':
    'Cover slide — hero image full bleed, large article title, section name, writer name. Always use as the first carousel slide.',
  'slide-02-statement':
    'Bold statement slide — single powerful sentence (HOOK) displayed large on a dark background. Great for a provocative opening line.',
  'slide-03-image-text':
    'Image + text split — left half is an article image, right half has a short paragraph (NARRATIVE). Good for visual storytelling.',
  'slide-04-narrative':
    'Text-heavy slide — a 2-3 sentence narrative block (NARRATIVE) with a subtle background. Use for context or background.',
  'slide-05-pull-quote':
    'Pull quote slide — a single quotation (QUOTE) displayed prominently. Great for a memorable expert quote from the article.',
  'slide-06-key-stat':
    'Key statistic slide — one large number (STAT_N) and a short label (STAT_L). Use when the article has a standout data point.',
  'slide-07-features':
    'Features grid — four labelled points (FEAT_1_LABEL/DESC through FEAT_4_LABEL/DESC). Good for listicle or "reasons why" content.',
  'slide-08-steps':
    'Steps slide — three numbered steps (STEP_1_TITLE/DESC through STEP_3_TITLE/DESC). Use for how-to or process articles.',
  'slide-09-full-image':
    'Full-bleed image slide — article image fills the entire frame with a short caption (IMGBOX_CAPTION) overlay. Visual pause slide.',
  'slide-10-image-box':
    'Image with boxed caption — image on top, text box below (IMGBOX_CAPTION). Use for a striking image with explanatory text.',
  'slide-11-end-card':
    'End card — writer bio/section tagline (END_CARD_BIO), article URL, logo. Always use as the final carousel slide.',
  // Story
  'story-01-cover-image':
    'Story cover — full-bleed hero image with article title overlaid. Classic opening story frame.',
  'story-02-dark-statement':
    'Dark statement story — bold HOOK text on a dark background. High-impact single-message frame.',
  'story-03-split-image':
    'Split story — image on the top half, short NARRATIVE text on the bottom half.',
  'story-04-pull-quote':
    'Pull quote story — QUOTE displayed large, centred, with minimal design. Great for shareable quotes.',
  'story-05-stat-card':
    'Stat story — STAT_N and STAT_L displayed prominently. Use when the article leads with a strong data point.',
  'story-06-editorial-light':
    'Editorial light story — clean, light background with article title and a 1-2 sentence teaser. Professional editorial feel.',
  // LinkedIn
  'linkedin-01-bottom-anchor':
    'Bottom anchor — image fills most of the frame, title and section anchored to the bottom strip.',
  'linkedin-02-left-panel':
    'Left panel — dark left column with title/section, right side is the article image. Clean professional split.',
  'linkedin-03-center-vignette':
    'Centre vignette — hero image with dark vignette, title centred over the image. Bold editorial look.',
  'linkedin-04-stat-overlay':
    'Stat overlay — article image with a prominent STAT_N + STAT_L overlay. Data-forward LinkedIn format.',
  'linkedin-05-quote-overlay':
    'Quote overlay — article image with a QUOTE overlaid in a styled box. Great for thought-leadership posts.',
};

// ---------------------------------------------------------------------------
// generatePostContent
// One Managed Agent session per article — shared across all platform posts.
// The session is stored on Article.socialContentSessionId so the agent remembers
// context when a second platform post is generated or any post is regenerated.
// ---------------------------------------------------------------------------
export async function generatePostContent({ campaignId, postId, article, section, platform, settings, instruction }) {
  const platformName = {
    instagram_carousel: 'Instagram Carousel',
    instagram_story: 'Instagram Story',
    linkedin: 'LinkedIn',
    twitter: 'Twitter',
  }[platform];

  if (!settings?.contentAgentId || !settings?.contentEnvironmentId) {
    throw new Error(
      'Content Agent IDs not configured. Set contentAgentId and contentEnvironmentId in Social Settings.',
    );
  }

  const bodyText = extractPlainText(article.content);

  // Re-read the article's session ID fresh to avoid stale caller data
  const freshArticle = await prisma.article.findUnique({
    where: { id: article.id },
    select: { socialContentSessionId: true },
  });
  let sessionId = freshArticle?.socialContentSessionId;
  const isFirstCall = !sessionId;

  if (isFirstCall) {
    const sessionLogId = await logStart(campaignId, 'content_session', `Creating content agent session for "${article.title}"`, null, postId);
    const session = await client.beta.sessions.create({
      agent: settings.contentAgentId,
      environment_id: settings.contentEnvironmentId,
    });
    sessionId = session.id;
    await logDone(sessionLogId, `Session created: ${sessionId}`, { sessionId });

    // Persist immediately so concurrent posts for the same article reuse it
    await prisma.article.update({
      where: { id: article.id },
      data: { socialContentSessionId: sessionId },
    });
  } else {
    await logStart(campaignId, 'content_session', `Reusing article session for "${article.title}" (${platformName})`, { sessionId }, postId);
  }

  // First call: send full article context alongside the platform request.
  // Subsequent calls (other platforms or regenerations): the agent already has
  // the article so we only send what changed.
  const message = isFirstCall
    ? `PLATFORM: ${platformName}

ARTICLE TITLE: ${article.title}
ARTICLE SUMMARY: ${article.summary || ''}
ARTICLE BODY:
${bodyText}

WRITER TONE: ${section.characterTone || ''}
WRITING STYLE: ${section.characterWritingStyle || ''}
${instruction ? `INSTRUCTION: ${instruction}` : ''}`
    : `PLATFORM: ${platformName}
${instruction ? `\nINSTRUCTION: ${instruction}` : '\nPlease generate content for this platform.'}`;

  const aiLogId = await logStart(
    campaignId, 'content_ai_send',
    `${instruction ? 'Regenerating' : 'Generating'} ${platformName} content for "${article.title}"`,
    { message, sessionId, isFirstCall },
    postId,
  );

  let responseText;
  try {
    responseText = await sendSessionMessage(sessionId, message);
  } catch (err) {
    await logError(aiLogId, err.message);
    throw err;
  }

  try {
    const result = JSON.parse(extractJson(responseText));
    await logDone(
      aiLogId,
      `Content ready — ${(result.slideIds || []).length} slides, caption ${(result.text || '').length} chars`,
      { response: responseText, parsed: result },
    );
    return { result, sessionId };
  } catch {
    await logError(aiLogId, `Agent returned invalid JSON: ${responseText.slice(0, 200)}`, { response: responseText });
    throw new Error(`Content agent returned invalid JSON: ${responseText.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function sendSessionMessage(sessionId, message) {
  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: 'user.message',
        content: [{ type: 'text', text: message }],
      },
    ],
  });

  return streamAgentResponse(sessionId);
}

// Convenience wrapper that parses JSON from the response
async function sendSessionMessageAndParse(sessionId, message) {
  const text = await sendSessionMessage(sessionId, message);
  try {
    return JSON.parse(extractJson(text));
  } catch {
    throw new Error(`Agent returned invalid JSON: ${text.slice(0, 300)}`);
  }
}

/**
 * Stream events from the session until the agent signals end_turn.
 * The correct event types per the Managed Agents API are:
 *   - agent.message          → the agent's text response
 *   - session.status_idle    → fired when the turn is complete; stop_reason.type === 'end_turn'
 *   - session.status_terminated / session.deleted / session.error → terminal states
 */
async function streamAgentResponse(sessionId) {
  const textParts = [];
  let done = false;

  while (!done) {
    const stream = await client.beta.sessions.events.stream(sessionId);

    for await (const event of stream) {
      const evType = event.type;

      if (evType === 'agent.message') {
        const content = event.content ?? [];
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            textParts.push(block.text);
          }
        }
      } else if (evType === 'session.status_idle') {
        if (event.stop_reason?.type === 'end_turn') {
          done = true;
          break;
        }
        // stop_reason 'requires_action' means a tool call was dispatched —
        // social-ai sessions don't use custom tools so this shouldn't happen,
        // but fall through and keep streaming to be safe.
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
  const summaryRequest = `Please write a concise handoff summary (max 500 words) of all editorial decisions made in this session. Include:
- Which articles were published to which platforms
- Content patterns you noticed (section balance, topics, formats)
- Any "avoid" signals from campaign briefs
- Recommendations for future weeks

This summary will be injected into your next session to maintain editorial continuity.`;

  return await sendSessionMessageAndParse(sessionId, summaryRequest).catch(() => '');
}

function extractJson(text) {
  // Try to extract JSON object from text that might have surrounding prose
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

function extractPlainText(contentJson) {
  if (!contentJson) return '';
  // Format 1: HTML wrapper { type: 'html', html: '...' }
  if (contentJson.type === 'html' && typeof contentJson.html === 'string') {
    return contentJson.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // Format 2: TipTap/ProseMirror doc { type: 'doc', content: [...] }
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
