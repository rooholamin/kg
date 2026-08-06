# AI Search / GEO Passage Citability

Condensed from claude-seo's `seo-geo` skill (MIT licensed,
github.com/AgriciDaniel/claude-seo), keeping only the passage-level,
per-article editing guidance — not the site-level crawler/robots.txt/
llms.txt/schema-rollout material, which doesn't apply when editing one
already-published article's text.

## Primary Source: Google's AI Optimization Guide

Google's official, stated position: optimizing for generative AI search
(AI Overviews, AI Mode, ChatGPT, Perplexity, etc.) is **still SEO** — AEO
and GEO are rebranded labels for the same underlying work, not a separate
discipline. AI Overviews and AI Mode are grounded in the same ranking and
quality systems as classic Search.

## Citability Score Criteria (what actually correlates with being cited)

**Optimal passage length: 134-167 words** for AI citation — a
self-contained block that fully answers a specific question without
requiring surrounding context. **~44% of AI citations come from the first
30% of a page** — front-load the clearest, most citable answer instead of
burying it several paragraphs in.

**Strong signals** (edit toward these):
- Clear, quotable sentences with specific facts/statistics
- Self-contained answer blocks — extractable as a standalone quote
- Direct answer within the first 40-60 words of a section
- Claims attributed to a specific, real source already in the article
- Definitions phrased as "X is..." / "X refers to..."
- A genuinely unique data point or specific detail, not found verbatim elsewhere

**Weak signals** (edit away from these):
- Vague, general statements with no specifics
- Opinion stated without any grounding
- The article's actual conclusion/answer buried several paragraphs down
- No concrete data points where the topic calls for one

## Structural Readability

- Clean H1 -> H2 -> H3 hierarchy, no skipped levels.
- Question-based headings where they match how a reader would actually
  phrase the query ("What is X?" over "Overview of X").
- Short paragraphs (2-4 sentences).
- Tables for genuinely comparative data; ordered/unordered lists for
  step-by-step or multi-item content — don't force structure where prose
  is the better fit.

## Explicitly Rejected Tactics (per Google's own guidance — never apply these)

- `llms.txt` is **not** a Google Search citation lever. Google's guide
  states explicitly that adding or omitting it "won't harm (nor help)"
  visibility in Google Search. Do not recommend or reference it as if it
  were an SEO lever.
- Content "chunking" specifically for AI consumption is unnecessary.
- AI-specific keyword rewriting/rephrasing is unnecessary — synonym
  understanding is already sufficient; write for the human reader.
- Mention-farming / inauthentic brand-mention stuffing is explicitly called
  out by Google as unhelpful and should never be applied.
