import { BookOpen, Code, FileText, Lightbulb, Search, Zap } from 'lucide-react';

export const RECENT_CHATS = [
  {
    id: '1',
    title: 'Plan 4 HVAC posts for next month',
    timestamp: '3 min ago',
    icon: Lightbulb,
  },
  {
    id: '2',
    title: 'What is at risk this week?',
    timestamp: '1 hour ago',
    icon: Zap,
  },
  {
    id: '3',
    title: 'Topics with zero published articles',
    timestamp: '3 hours ago',
    icon: Search,
  },
  {
    id: '4',
    title: 'Summarize pipeline health',
    timestamp: '5 hours ago',
    icon: FileText,
  },
  {
    id: '5',
    title: 'Draft outline: Emergency Fund 101',
    timestamp: 'Yesterday',
    icon: BookOpen,
  },
  {
    id: '6',
    title: 'SEO anchor text suggestions',
    timestamp: 'Yesterday',
    icon: Code,
  },
];

// Per-chat message threads. Chats with a pending action end with type:'action'.
export const CHAT_MESSAGES = {
  '1': [
    {
      id: 'a1',
      role: 'user',
      content: 'Plan 4 HVAC posts for next month.',
      timestamp: '3 min ago',
    },
    {
      id: 'a2',
      role: 'assistant',
      content:
        "Great — I can plan those out for you. Before I create the 4 posts and schedule them, I have a few quick questions:\n\n1. **Target audience** — Are these aimed at homeowners, HVAC technicians, or a mix of both?\n2. **Post format** — Long-form articles (1,500+ words), short how-to guides, or a mix?\n3. **Topics in mind?** — Do you have specific subjects (e.g. heat pump efficiency, filter maintenance, seasonal tune-ups), or should I suggest based on your existing topic gaps and what's seasonally relevant next month?\n4. **Publishing cadence** — Spread evenly (roughly one per week) or clustered?",
      timestamp: '3 min ago',
      isSimulated: true,
    },
    {
      id: 'a3',
      role: 'user',
      content:
        'Mix of homeowners and techs. Long-form articles. Suggest topics based on gaps. Spread evenly.',
      timestamp: '1 min ago',
    },
    {
      id: 'a4',
      role: 'assistant',
      content:
        "Perfect. Based on your existing topic library and seasonal demand for next month, here's the draft plan:\n\n**Week 1 — May 5**\n- **Why Your AC Isn't Cooling Properly: 7 Common Causes** *(homeowner-focused, 1,600 words)*\n\n**Week 2 — May 12**\n- **HVAC Filter Types Compared: MERV, HEPA & Fiberglass Explained** *(mixed audience, 1,800 words)*\n\n**Week 3 — May 19**\n- **How to Prepare Your HVAC System for Summer: A Tech's Checklist** *(technician-leaning, 2,000 words)*\n\n**Week 4 — May 26**\n- **Heat Pump vs Central AC: Which Is Right for Your Home in 2025?** *(homeowner-focused, 1,700 words)*\n\nShould I create these 4 topics in the system and queue them for assignment?",
      timestamp: '1 min ago',
      isSimulated: true,
    },
  ],

  '2': [
    {
      id: 'b1',
      role: 'user',
      content: 'What articles are at risk of missing readiness this week?',
      timestamp: '1 hour ago',
    },
    {
      id: 'b2',
      role: 'assistant',
      content:
        '**At-Risk Articles This Week**\n\n2 articles are currently flagged:\n\n- **YouTube Thumbnails That Convert** — all readiness criteria met, awaiting final publish approval\n- **The Best AI Writing Assistants Compared** — missing 3 internal links, no featured image\n\nThe first article is ready to publish. Would you like me to submit it for final publication?',
      timestamp: '1 hour ago',
      isSimulated: true,
    },
    {
      id: 'b3',
      role: 'user',
      content: 'Yes, go ahead and submit YouTube Thumbnails for publishing.',
      timestamp: '58 min ago',
    },
    {
      id: 'b4',
      role: 'assistant',
      content:
        "I've prepared the publish action for **YouTube Thumbnails That Convert**. This is a live write action — it requires your explicit approval before anything is executed.",
      timestamp: '58 min ago',
      isSimulated: true,
    },
    {
      id: 'b5',
      role: 'action',
      pendingId: 'c1',
      label: 'Publish article: YouTube Thumbnails That Convert',
      detail:
        'Marks the article as Published, sets the publish date to today, and triggers the WordPress sync job.',
      risk: 'high',
      timestamp: '58 min ago',
    },
  ],

  '5': [
    {
      id: 'e1',
      role: 'user',
      content: 'I want to create a new topic under Finance: Emergency Fund 101.',
      timestamp: 'Yesterday',
    },
    {
      id: 'e2',
      role: 'assistant',
      content:
        "Good choice — **Emergency Fund 101** fits a gap in your Finance category. Here's what I'll create:\n\n- **Category:** Finance\n- **Slug:** emergency-fund-101\n- **Status:** Open for assignment\n- **Suggested word count:** 1,400 words\n- **Target audience:** General / personal finance beginners\n\nShall I add this topic to the system now?",
      timestamp: 'Yesterday',
      isSimulated: true,
    },
    {
      id: 'e3',
      role: 'user',
      content: 'Yes, create it.',
      timestamp: 'Yesterday',
    },
    {
      id: 'e4',
      role: 'assistant',
      content:
        "I've prepared the create action for this topic. Approve below to add it to your content library.",
      timestamp: 'Yesterday',
      isSimulated: true,
    },
    {
      id: 'e5',
      role: 'action',
      pendingId: 'c2',
      label: 'Create topic: Emergency Fund 101',
      detail:
        'Adds a new topic record under Finance, sets status to Open, and makes it available for writer assignment.',
      risk: 'medium',
      timestamp: 'Yesterday',
    },
  ],
};

// Fallback messages for chats without a dedicated thread
export const DEFAULT_MESSAGES = [
  {
    id: 'def1',
    role: 'assistant',
    content: 'This chat thread is empty. Ask me anything about your content pipeline.',
    timestamp: '',
    isSimulated: true,
  },
];

export const SUGGESTED_PROMPTS = [
  'Summarize pipeline health for this week',
  'List topics with zero published articles',
  'Which articles need SEO review?',
  'Schedule a social post for the HVAC series',
];

export const PENDING_CONFIRMATIONS = [
  {
    id: 'c1',
    chatId: '2',
    label: 'Publish article: YouTube Thumbnails That Convert',
    risk: 'high',
  },
  {
    id: 'c2',
    chatId: '5',
    label: 'Create topic: Emergency Fund 101',
    risk: 'medium',
  },
];

export const ACTION_HISTORY = [
  {
    id: 'h1',
    action: 'Flagged 2 articles as at-risk',
    timestamp: 'Yesterday, 11:05 AM',
  },
  {
    id: 'h2',
    action: 'Assigned article to editor: J. Moore',
    timestamp: 'Yesterday, 9:30 AM',
  },
];
