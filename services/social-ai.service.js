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
// LinkedIn has no slide set of its own — it clones the Instagram Carousel post
// for the same article (see social-pipeline.service.js). Whenever the agent
// needs to be asked directly (no sibling post to clone from yet), the pipeline
// always calls generatePostContent with platform: 'instagram_carousel', so
// only these two formats are ever presented to the agent.
const AVAILABLE_SLIDES = {
  carousel: [
    '01-cover',
    '02-statement',
    '03-image-text',
    '04-narrative',
    '05-pull-quote',
    '06-key-stat',
    '07-features',
    '08-how-to',
    '09-full-image',
    '10-image-box',
    '11-end-card',
  ],
  story: [
    'cover-image',
    'dark-statement',
    'split-image',
    'pull-quote',
    'stat-card',
    'editorial-light',
  ],
};

// Slides that render {{HERO_IMAGE}} and therefore need an image assigned by the agent.
const IMAGE_SLIDES = {
  carousel: ['01-cover', '03-image-text', '09-full-image', '10-image-box'],
  story: ['cover-image', 'dark-statement', 'split-image', 'pull-quote', 'stat-card', 'editorial-light'],
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
  // Carousel (also used for LinkedIn — see AVAILABLE_SLIDES note above)
  '01-cover':
    'Cover slide — hero image full bleed, large article title, section name, writer name. Always use as the first carousel slide. Needs an image. (The visual design rotates automatically between 4 variants — you always just select "01-cover".)',
  '02-statement':
    'Bold statement slide — single powerful sentence (HOOK) displayed large on a dark background. Great for a provocative opening line.',
  '03-image-text':
    'Image + text split — top is an article image, below it a short paragraph (HOOK). Good for visual storytelling. Needs an image.',
  '04-narrative':
    'Text-heavy slide — a 2-3 sentence narrative block (NARRATIVE) with a subtle background. Use for context or background.',
  '05-pull-quote':
    'Pull quote slide — a single quotation (QUOTE) displayed prominently. Great for a memorable expert quote from the article.',
  '06-key-stat':
    'Key statistic slide — one large number (STAT_N) and a short label (STAT_L). Use when the article has a standout data point.',
  '07-features':
    'Features grid — four labelled points (FEAT_1_LABEL/DESC through FEAT_4_LABEL/DESC). Good for listicle or "reasons why" content.',
  '08-how-to':
    'How-to slide — three numbered steps (STEP_1_TITLE/DESC through STEP_3_TITLE/DESC). Use for how-to or process articles.',
  '09-full-image':
    'Full-bleed image slide — article image fills the entire frame. Visual pause slide. Needs an image.',
  '10-image-box':
    'Image with boxed caption — image on top, text box below (IMGBOX_CAPTION). Use for a striking image with explanatory text. Needs an image.',
  '11-end-card':
    'End card — writer bio/section tagline (END_CARD_BIO), logo. Always use as the final carousel slide.',
  // Story
  'cover-image':
    'Story cover — full-bleed hero image with article title overlaid. Classic opening story frame. Needs an image.',
  'dark-statement':
    'Dark statement story — bold HOOK text over a dark image background. High-impact single-message frame. Needs an image.',
  'split-image':
    'Split story — image on the top half, article title/byline on the bottom half. Needs an image.',
  'pull-quote':
    'Pull quote story — QUOTE displayed large over an image background, centred, with minimal design. Great for shareable quotes. Needs an image.',
  'stat-card':
    'Stat story — STAT_N and STAT_L displayed prominently over an image background. Use when the article leads with a strong data point. Needs an image.',
  'editorial-light':
    'Editorial light story — clean, light background with a top image, article title and a 1-2 sentence teaser (HOOK). Professional editorial feel. Needs an image.',
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
    twitter: 'Twitter',
  }[platform];

  if (!settings?.contentAgentId || !settings?.contentEnvironmentId) {
    throw new Error(
      'Content Agent IDs not configured. Set contentAgentId and contentEnvironmentId in Social Settings.',
    );
  }

  const bodyText = extractPlainText(article.content);

  // Compute active templates for this platform (filtered by disabled list)
  const platformTemplateKey = {
    instagram_carousel: 'carousel',
    instagram_story: 'story',
  }[platform];
  const disabled = new Set(settings?.disabledTemplates || []);
  const activeSlides = platformTemplateKey
    ? (AVAILABLE_SLIDES[platformTemplateKey] || []).filter((id) => !disabled.has(id))
    : [];
  const slideMenu = activeSlides
    .map((id) => `- ${id}: ${SLIDE_DESCRIPTIONS[id] || ''}`)
    .join('\n');
  const imageSlideIds = new Set(
    platformTemplateKey ? IMAGE_SLIDES[platformTemplateKey] || [] : [],
  );

  // Build the pool of real images the agent may assign to image-bearing slides:
  // the article's featured image plus every completed featured/inline asset generated for it.
  const assetRequests = await prisma.articleAssetRequest.findMany({
    where: {
      articleId: article.id,
      type: { in: ['featured_image', 'inline_image'] },
      status: 'completed',
      imageUrl: { not: null },
    },
    select: { imageUrl: true, type: true },
  });
  const imagePool = [];
  const seenUrls = new Set();
  if (article.featuredImage) {
    imagePool.push({ url: article.featuredImage, type: 'featured' });
    seenUrls.add(article.featuredImage);
  }
  for (const req of assetRequests) {
    if (!req.imageUrl || seenUrls.has(req.imageUrl)) continue;
    seenUrls.add(req.imageUrl);
    imagePool.push({ url: req.imageUrl, type: req.type === 'featured_image' ? 'featured' : 'inline' });
  }
  const imagePoolUrls = new Set(imagePool.map((img) => img.url));
  const imageMenu = imagePool.map((img) => `- ${img.url} (${img.type})`).join('\n');

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

WRITER TONE (for your writing style only — do not output this): ${section.characterTone || ''}
WRITING STYLE: ${section.characterWritingStyle || ''}
${slideMenu ? `\nAVAILABLE TEMPLATES (select slideIds ONLY from this list):\n${slideMenu}` : ''}
${imageMenu ? `\nAVAILABLE IMAGES (assign ONLY these URLs to image-bearing slides; vary the image across slides where sensible):\n${imageMenu}` : ''}
${instruction ? `INSTRUCTION: ${instruction}` : ''}

Return JSON with these fields:
- slideIds: array of template IDs selected from the list above
- text: the post caption/body text
- placeholders: object with all template placeholder values (HOOK, QUOTE, STAT_N, STAT_L, NARRATIVE, FEAT_*_LABEL, FEAT_*_DESC, STEP_*_TITLE, STEP_*_DESC, IMGBOX_CAPTION, END_CARD_BIO, ARC_TITLE)
- images: object mapping each image-bearing slideId you selected (marked "Needs an image" above) to one URL from the AVAILABLE IMAGES list, e.g. {"01-cover": "https://...", "09-full-image": "https://..."}
- label: a short 2–4 word creative eyebrow label written for this article (ALL CAPS, e.g. "RISING MARKETS", "BOLD NEW VISION", "DATA DEEP DIVE"). This appears above the article title in the image templates — make it punchy and editorial, not the writer tone.`
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
    // Filter slideIds to only active templates
    if (Array.isArray(result.slideIds) && activeSlides.length) {
      result.slideIds = result.slideIds.filter((id) => activeSlides.includes(id));
    }
    // Defensively filter images: keys must be image-bearing slides that were actually
    // selected, and values must be real URLs from the pool we offered the agent.
    if (result.images && typeof result.images === 'object') {
      const selectedSlideIds = new Set(result.slideIds || []);
      result.images = Object.fromEntries(
        Object.entries(result.images).filter(
          ([slideId, url]) => selectedSlideIds.has(slideId) && imageSlideIds.has(slideId) && imagePoolUrls.has(url),
        ),
      );
    } else {
      result.images = {};
    }
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
