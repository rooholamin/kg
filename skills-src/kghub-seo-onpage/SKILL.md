---
name: kghub-seo-onpage
description: >
  On-page SEO checklist for optimizing a single already-published article:
  title and meta description quality, heading hierarchy, keyword placement,
  E-E-A-T content-quality signals, and AI-citability passage structure for
  AI Overviews/ChatGPT/Perplexity. Use when analyzing or editing one
  article's on-page SEO (title, meta description, headings, body copy).
license: MIT
metadata:
  adapted_from: "AgriciDaniel/claude-seo (seo-page, seo-content, seo-geo skills), MIT License"
  category: seo
---

# On-Page SEO Checklist

Adapted from the `seo-page`, `seo-content`, and `seo-geo` skills of the
open-source [claude-seo](https://github.com/AgriciDaniel/claude-seo) project
(MIT licensed), condensed to what applies when editing ONE already-written
article directly rather than crawling a live URL. See `references/` for the
fuller E-E-A-T and AI-citability frameworks this checklist is drawn from.

## Title & Meta Description

- Title: 50-60 characters, includes the primary/target keyword near the
  front, unique, not clickbait.
- Meta description: 150-160 characters, compelling and specific (ad copy
  that earns a click), not a generic restatement of the title, includes the
  keyword naturally.

## Heading Hierarchy

- Exactly one H1 (the title itself — never repeated inside the body).
- H2s/H3s nested logically, no level skipped, each heading descriptive of
  the section it introduces (not decorative).
- Prefer question-based headings where they match how a reader (or an AI
  system) would actually phrase the question ("What is X?" reads better to
  both humans and AI-citation systems than "Overview of X").

## Keyword Placement (only if a target keyword is given — never invent one)

- Appears naturally in: the title, the first ~100 words, and at least one
  heading.
- Natural density (roughly 1-3%), semantic variations present — never
  stuffed or mechanically repeated.

## Content Quality (E-E-A-T) — full framework in `references/eeat-and-content-quality.md`

Before editing, run Google's own three-question heuristic:

| Question | What to look for |
|---|---|
| **Who** created it? | A visible voice/byline consistent with the rest of the publication. |
| **How** was it created? | Does it read as genuinely researched/experienced, not generic filler? |
| **Why** does it exist? | To help the reader, not to hit a word count or chase a keyword. |

When editing, tighten toward these signals rather than away from them:
first-hand specificity over generic phrasing, concrete claims over vague
ones, natural paragraph/sentence length (2-4 sentences per paragraph,
15-20 words per sentence on average), a logical scannable structure.

**Word count is not a target.** Google has confirmed it isn't a ranking
factor — the goal is comprehensive coverage of the topic, not hitting a
number. Never pad an article to reach a length.

## AI-Search Passage Citability — full framework in `references/ai-citability-geo.md`

AEO/GEO are, per Google's own AI Optimization Guide, rebranded labels for
the same SEO fundamentals applied to AI-search surfaces (AI Overviews, AI
Mode, ChatGPT, Perplexity) — not a separate discipline.

- Somewhere near the top of the article, there should be at least one
  self-contained passage (roughly **134-167 words** is the citation-optimal
  range) that directly and completely answers the article's core question —
  extractable as a standalone quote, without needing the surrounding
  paragraphs for context. ~44% of AI citations come from the first 30% of a
  page, so don't bury the clearest answer below the fold.
- Prefer direct, quotable, specific sentences with facts/figures over vague
  or hedged ones.
- Definitions phrased as "X is..." / "X refers to..." are easy to cite —
  use this pattern naturally where the article already defines something.

## What NOT to do

- Never fabricate a statistic, quote, source, or claim that isn't already
  in the article.
- Never chase AI-search visibility with gimmicks Google has explicitly said
  don't work: `llms.txt` is not a Google citation lever, content "chunking"
  for AI is unnecessary, AI-specific keyword rewriting is unnecessary
  (synonym understanding is already sufficient). Don't recommend or apply
  any of these.
- Don't treat this checklist as a mandate to change everything — a
  well-optimized article may only need one or two of the above touched, or
  none at all.
