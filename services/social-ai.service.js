import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    const session = await client.beta.sessions.create({
      agent: settings.approvalAgentId,
      environment_id: settings.approvalEnvironmentId,
    });
    sessionId = session.id;

    // Persist the new session ID
    await prisma.socialAiMemory.upsert({
      where: { id: 'singleton' },
      update: { activeSessionId: sessionId, sessionCampaignCount: 0 },
      create: { id: 'singleton', activeSessionId: sessionId, sessionCampaignCount: 0 },
    });

    // 2. If there's a handoff summary from a previous session, inject it first
    if (memory.handoffSummary) {
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
    }
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

  // 4. Send the task and stream the response
  const approvalMap = await sendSessionMessageAndParse(sessionId, taskMessage);

  // 5. Save session ID on the campaign + update memory counter
  const newCount = (memory.sessionCampaignCount || 0) + 1;
  await prisma.socialCampaign.update({
    where: { id: campaign.id },
    data: { approvalSessionId: sessionId },
  });

  // 6. Check if session should rotate
  const rotateAfter = memory.sessionRotateAfter || 10;
  if (newCount >= rotateAfter) {
    const summary = await requestHandoffSummary(sessionId);
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
// generatePostContent
// Fresh messages.create per post — no session needed.
// ---------------------------------------------------------------------------
export async function generatePostContent({ article, section, platform, toneSeed }) {
  const charLimit = CHAR_LIMITS[platform] || 2200;
  const platformName = {
    instagram_carousel: 'Instagram Carousel',
    instagram_story: 'Instagram Story',
    linkedin: 'LinkedIn',
    twitter: 'Twitter',
  }[platform];

  const availableSlides =
    platform === 'instagram_carousel'
      ? AVAILABLE_SLIDES.carousel
      : platform === 'instagram_story'
        ? AVAILABLE_SLIDES.story
        : platform === 'linkedin'
          ? AVAILABLE_SLIDES.linkedin
          : [];

  // Extract plain text from TipTap content JSON
  const bodyText = extractPlainText(article.content);

  const systemPrompt = `You are a social media content creator for KG Hub, a premium real estate publication. 
You create platform-specific social media content based on articles.
Your tone should match the section voice: ${section.characterTone || 'professional and engaging'}.
Writing style: ${section.characterWritingStyle || 'clear and concise'}.
${toneSeed ? `Tone variation requested: ${toneSeed}` : ''}

Always respond with ONLY valid JSON, no other text or markdown.`;

  const slideGuide = availableSlides.length
    ? `\nAvailable slides/templates: ${availableSlides.join(', ')}\nFor carousel: pick 4-7 slides; always include slide-01-cover and slide-11-end-card.\nFor story/linkedin: pick exactly 1 template.`
    : '';

  const hashtagBase = section.socialHashtags?.length
    ? `Base hashtags to always include: ${section.socialHashtags.join(' ')}`
    : '';

  const userMessage = `Create a ${platformName} post for this article.

Article title: ${article.title}
Article summary: ${article.summary || ''}
Article body: ${bodyText.slice(0, 3000)}
Section: ${section.name}
Writer: ${section.characterName || 'KG Hub'}
${hashtagBase}
${slideGuide}

Character limit for caption: ${charLimit}

Return JSON with this structure:
{
  "slideIds": ${availableSlides.length ? '["slide-id-1", "slide-id-2"]' : '[]'},
  "text": "caption text within ${charLimit} chars",
  "hashtags": ["#tag1", "#tag2"],
  "placeholders": {
    "HOOK": "one strong opening sentence",
    "QUOTE": "memorable quote from article",
    "STAT_N": "key statistic number",
    "STAT_L": "statistic label",
    "NARRATIVE": "2-3 sentence narrative combining hook and context",
    "FEAT_1_LABEL": "feature 1 title",
    "FEAT_1_DESC": "feature 1 description",
    "FEAT_2_LABEL": "feature 2 title",
    "FEAT_2_DESC": "feature 2 description",
    "FEAT_3_LABEL": "feature 3 title",
    "FEAT_3_DESC": "feature 3 description",
    "FEAT_4_LABEL": "feature 4 title",
    "FEAT_4_DESC": "feature 4 description",
    "STEP_1_TITLE": "step 1 title",
    "STEP_1_DESC": "step 1 description",
    "STEP_2_TITLE": "step 2 title",
    "STEP_2_DESC": "step 2 description",
    "STEP_3_TITLE": "step 3 title",
    "STEP_3_DESC": "step 3 description",
    "IMGBOX_CAPTION": "caption for boxed image",
    "END_CARD_BIO": "short writer bio / section tagline",
    "ARTICLE_URL": "https://kghub.ai/placeholder"
  }
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = response.content[0]?.text || '{}';
  try {
    const result = JSON.parse(extractJson(raw));
    // Prepend section hashtags to AI-generated ones
    if (section.socialHashtags?.length) {
      const baseHashes = section.socialHashtags.map((h) => (h.startsWith('#') ? h : `#${h}`));
      result.hashtags = [...new Set([...baseHashes, ...(result.hashtags || [])])];
    }
    return result;
  } catch {
    throw new Error(`AI returned invalid JSON for post content: ${raw.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function sendSessionMessageAndParse(sessionId, message) {
  // Send the user message
  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: 'user.message',
        content: [{ type: 'text', text: message }],
      },
    ],
  });

  // Poll for the session to complete and get the response
  const responseText = await pollSessionCompletion(sessionId);
  try {
    return JSON.parse(extractJson(responseText));
  } catch {
    throw new Error(`Approval agent returned invalid JSON: ${responseText.slice(0, 300)}`);
  }
}

async function pollSessionCompletion(sessionId, maxWaitMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await sleep(3000);
    const session = await client.beta.sessions.retrieve(sessionId);
    if (session.status === 'completed' || session.status === 'stopped') {
      // Get the latest events to find the assistant response
      const events = await client.beta.sessions.events.list(sessionId);
      const assistantEvents = events.data?.filter(
        (e) => e.type === 'assistant.message' || e.type === 'agent.response',
      );
      if (assistantEvents?.length) {
        const latest = assistantEvents[assistantEvents.length - 1];
        const content = latest.content || latest.message?.content;
        if (Array.isArray(content)) {
          return content
            .filter((c) => c.type === 'text')
            .map((c) => c.text)
            .join('');
        }
        return String(content || '');
      }
    }
    if (session.status === 'failed' || session.status === 'error') {
      throw new Error(`Approval agent session failed: ${session.status}`);
    }
  }
  throw new Error('Approval agent session timed out');
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
  if (typeof contentJson === 'string') return contentJson;
  try {
    const doc = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson;
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
