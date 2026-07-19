# KG Hub — Social Media Template System

## Structure

```
template-system/
├── assets/
│   ├── K.png                ← brand watermark
│   ├── logo.svg              ← KG logo (dark-on-light)
│   ├── logo-light.svg        ← KG logo (light-on-dark)
│   ├── hero-default.jpg      ← fallback hero image when no article image is available
│   ├── fonts/                ← TwCenMT (TCM/TCMC) + Dosis families
│   └── joseph.jpg, livia.jpg, stephen.jpg, elara.jpg, selene.jpg, eden.jpg, michael.jpg
│       ← writer headshot fallbacks, flat in assets/ (no photos/ subfolder)
├── carousel/                 ← 14 files: 11 slide types (4 of them are cover variants)
├── story/                    ← 6 files, one per template variant
├── archived/                 ← previous template generation, kept for reference/rollback
└── SYSTEM.md
```

**LinkedIn has no templates of its own.** LinkedIn posts reuse the `carousel/` set —
a LinkedIn post is generated and exported exactly like an Instagram Carousel post
for the same article (see the social pipeline docs for how cloning works).

## How templates work

Each file is a standalone HTML page containing one slide. Fill `{{PLACEHOLDER}}` tokens with real values, then export `.export` with Playwright.

**Export selector:** `.export`
**No JS, no swiper, no navigation** — just one slide per file (the `<script>` block in each file only fills realistic sample copy for local preview in a browser; it's a no-op once the pipeline fills real placeholders).

---

## Slide IDs

IDs are just the filename without `.html`. There are no `slide-`/`story-`/`linkedin-` prefixes anymore.

### Carousel (used for both Instagram Carousel and LinkedIn)

| ID | Notes |
|---|---|
| `01-cover` | Always first. See "Cover variants" below — this ID represents 4 interchangeable visual designs. |
| `02-statement` | Bold single-sentence hook on a dark background. |
| `03-image-text` | Image top, narrative paragraph below. Needs an image. |
| `04-narrative` | Text-heavy 2–3 sentence context block. |
| `05-pull-quote` | Prominent expert quote. |
| `06-key-stat` | One large number with a short label. |
| `07-features` | Four labelled feature points. |
| `08-how-to` | Three numbered steps (formerly "steps"). |
| `09-full-image` | Full-bleed image with a short caption overlay near the bottom. Visual pause slide. Needs an image. |
| `10-image-box` | Boxed image with caption below. Needs an image. |
| `11-end-card` | Always last. Writer headshot required. |

### Story (pick one per article)

| ID | Notes |
|---|---|
| `cover-image` | Strong hero photo articles. Visual-first. Needs an image. |
| `dark-statement` | Opinion, editorial, or bold claim articles. Needs an image (background). |
| `split-image` | Data or analysis articles needing image + context. Needs an image. |
| `pull-quote` | Articles with a strong quotable line. Needs an image (background). |
| `stat-card` | Data-driven articles with a headline number. Needs an image (background). |
| `editorial-light` | Writer-forward or personal-voice articles. Needs an image. |

**Every story template uses `{{HERO_IMAGE}}`** (as a background or a top image) — the
single story slide always needs exactly one image assigned.

### Cover variants (carousel `01-cover`)

The content agent only ever sees and selects the single logical slide `01-cover` — it
has no knowledge of the variants below. At export time, the pipeline resolves `01-cover`
to one of 4 physical files, chosen once per post (stored on the post so retries stay
consistent) and editable by a human via the post's edit modal:

| Variant key | File |
|---|---|
| `default` | `01-cover.html` |
| `bottom-anchor` | `01-cover-bottom-anchor.html` |
| `center-vignette` | `01-cover-center-vignette.html` |
| `left-panel` | `01-cover-left-panel.html` |

All 4 share the same core placeholder set and only differ visually (headline
position, vignette style, etc) — except `left-panel`, which additionally renders
`{{COVER_SUBTEXT}}` (a short lede sentence under the title). Since the agent can't
control which variant gets picked, it should always supply `COVER_SUBTEXT`.

---

## Placeholders

### Common (used across most templates)

| Placeholder | Description | Example |
|---|---|---|
| `{{HERO_IMAGE}}` | Image shown on this specific slide — chosen per-slide by the content agent (see "Per-slide images" below) | `https://cdn.kghub...` |
| `{{ART_TITLE}}` | Article headline. Rendered only by carousel `01-cover` (all 4 variants, one logical slide) and by Story slides — never by any other carousel slide | `Embracing Luxury: A Guide...` |
| `{{QUOTE}}` | Pull quote from article | `In a penthouse, the city...` |
| `{{STAT_N}}` | Stat figure | `2.4×` |
| `{{STAT_L}}` | Stat label | `price premium on penthouse units` |
| `{{SECTION_NAME}}` | Section display name | `KG Living` |
| `{{SECTION_NAME_UPPER}}` | Section name uppercased | `KG LIVING` |
| `{{WRITER_NAME}}` | Writer full name | `Livia Moretti` |
| `{{WRITER_NAME_UPPER}}` | Writer name uppercased | `LIVIA MORETTI` |
| `{{WRITER_PHOTO}}` | Writer headshot URL | `assets/livia.jpg` |
| `{{COLOR_ACCENT}}` | Section primary accent color (hex) | `#CCB260` |
| `{{COLOR_LIGHT}}` | Section light accent (hex) | `#E0CC7A` |
| `{{COLOR_DARK}}` | Section dark accent (hex) | `#7A5500` |
| `{{SLIDE_INDEX}}` / `{{SLIDE_TOTAL}}` / `{{SLIDE_PROGRESS}}` | Progress bar position within the carousel | `3`, `11`, `27` |

### Carousel-only placeholders

Every placeholder below belongs to exactly one slide — no two slides in the same
carousel post ever share a content placeholder, so the content agent must write
genuinely distinct copy for each one (no reusing the same sentence, or a trivial
reword of it, across fields):

| Placeholder | Slide | Description |
|---|---|---|
| `{{COVER_SUBTEXT}}` | `01-cover-left-panel` | Lede sentence under the title — only rendered when the "left panel" cover variant is chosen, but the agent can't control the variant, so it must always supply a value |
| `{{STATEMENT_TEXT}}` | `02-statement` | Single bold declarative sentence |
| `{{IMAGE_TEXT_HOOK}}` | `03-image-text` | Short paragraph below the image |
| `{{HOWTO_INTRO}}` | `08-how-to` | One-line intro above the numbered steps |
| `{{NARRATIVE_TITLE}}` | `04-narrative` | Short sub-headline above the narrative paragraph — must NOT repeat `{{ART_TITLE}}`, since that would duplicate the cover's headline |
| `{{NARRATIVE}}` | `04-narrative` | Full paragraph combining hook + context |
| `{{FEAT_1_LABEL}}` … `{{FEAT_4_LABEL}}` | `07-features` | Feature row titles |
| `{{FEAT_1_DESC}}` … `{{FEAT_4_DESC}}` | `07-features` | Feature row descriptions |
| `{{STEP_1_TITLE}}` … `{{STEP_3_TITLE}}` | `08-how-to` | Step titles |
| `{{STEP_1_DESC}}` … `{{STEP_3_DESC}}` | `08-how-to` | Step descriptions |
| `{{FULL_IMAGE_CAPTION}}` | `09-full-image` | Caption overlaid near the bottom of the full-bleed image |
| `{{IMAGE_BOX_CAPTION}}` | `10-image-box` | Caption under the boxed image |
| `{{END_CARD_BIO}}` | `11-end-card` | Short writer bio / section tagline |
| `{{COVER_EYEBROW}}` | `01-cover` | Small ALL CAPS eyebrow tag above the headline |
| `{{STATEMENT_EYEBROW}}` | `02-statement` | Small ALL CAPS eyebrow tag above the statement |
| `{{IMAGE_TEXT_EYEBROW}}` | `03-image-text` | Small ALL CAPS eyebrow tag above the paragraph |
| `{{NARRATIVE_EYEBROW}}` | `04-narrative` | Small ALL CAPS eyebrow tag above the sub-headline |
| `{{KEY_STAT_EYEBROW}}` | `06-key-stat` | Small ALL CAPS eyebrow tag above the stat |
| `{{FEATURES_EYEBROW}}` | `07-features` | Small ALL CAPS eyebrow tag above the feature grid |
| `{{HOWTO_EYEBROW}}` | `08-how-to` | Small ALL CAPS eyebrow tag above the intro line |
| `{{IMAGE_BOX_EYEBROW}}` | `10-image-box` | Small ALL CAPS eyebrow tag above the boxed image |

`05-pull-quote`, `09-full-image`, and `11-end-card` render no eyebrow tag at all — don't
supply one for them. Every carousel eyebrow tag above must be its own fresh 2–4 word
phrase; never reuse the same word or phrase across two of them in the same post (that
was the old `{{LABEL}}` bug — one shared eyebrow value repeated on up to 8 different
carousel slides).

There is no `{{ARTICLE_URL}}` placeholder in the new templates — the "insights.kghub.ca"
text shown in several slides is fixed decorative branding, not a real link.

### Story-only placeholders

Unlike carousel, a Story post only ever shows **one** slide, so these two fields are
safely shared/generic — there's no duplication risk since nothing else renders alongside them:

| Placeholder | Slides | Description |
|---|---|---|
| `{{LABEL}}` | `cover-image`, `dark-statement`, `split-image`, `stat-card`, `editorial-light` | Agent-written ALL CAPS eyebrow label above the title |
| `{{HOOK}}` | `dark-statement`, `editorial-light` | Bold statement / 1-2 sentence teaser |

---

## Per-slide images (agent-selected)

Unlike the previous system (which repeated the article's single featured image on
every slide), the content agent now chooses which image goes on which slide from the
full pool of the article's generated assets (`ArticleAssetRequest` rows: `featured_image`
and `inline_image` types, plus `Article.featuredImage` as a guaranteed fallback candidate).

The agent returns an `images` map keyed by slide ID, e.g.:

```json
{
  "01-cover": "https://cdn.kghub.../hero.jpg",
  "03-image-text": "https://cdn.kghub.../inline-2.jpg",
  "09-full-image": "https://cdn.kghub.../inline-4.jpg"
}
```

Only slides that actually render `{{HERO_IMAGE}}` need an entry. If a needed slide has
no assigned image, the export step falls back to `Article.featuredImage`, then to
`assets/hero-default.jpg`.

---

## Colour system

Background colors are fixed across all sections — do not replace them:

| Variable | Value | Used on |
|---|---|---|
| `#1C1910` / `#131009` | Primary dark | Most dark slides |
| `#222016` / `#0E0C09` | Secondary dark | Pull quote, steps slides |
| `#F6F2EA` / `#EEEAE0` | Light off-white | Statement, features, end card |

Per-section accent colors — fill these via `{{COLOR_ACCENT}}`, `{{COLOR_LIGHT}}`, `{{COLOR_DARK}}`:

| Section | `{{COLOR_ACCENT}}` | `{{COLOR_LIGHT}}` | `{{COLOR_DARK}}` |
|---|---|---|---|
| KG Living (`living`) | `#CCB260` | `#E0CC7A` | `#7A5500` |
| KG Build (`build`) | `#C49A6C` | `#D8B484` | `#6B4020` |
| KG Invest (`invest`) | `#70A860` | `#8EC87A` | `#285018` |
| KG Data (`data`) | `#5898C8` | `#74B4E0` | `#1E4870` |
| KG Design (`design`) | `#C47890` | `#E094AA` | `#7A3050` |
| KG Eco (`eco`) | `#60B87A` | `#80D094` | `#1A6030` |
| KG Develop (`develop`) | `#A89060` | `#C4AC7A` | `#503810` |

---

## Export dimensions

| Format | Files | Viewport | Scale factor | Output |
|---|---|---|---|---|
| Carousel (Instagram Carousel + LinkedIn) | `carousel/*.html` | 420×525 | `1080÷420` | 1080×1350 |
| Story | `story/*.html` | 420×747 | `1080÷420` | 1080×1920 |

LinkedIn no longer has its own export dimensions — LinkedIn posts are generated and
exported as Instagram Carousel posts (or cloned directly from the sibling Instagram
Carousel post for the same article) and reuse the carousel viewport/scale above.

Export the `.export` div using `page.locator('.export').screenshot()`.
Wait for `document.fonts.ready` after `page.goto()` for fonts to load.
Never set the viewport to the output size — use `device_scale_factor` to scale up.

---

## Template guide — which to use when

### Carousel (agent picks 4–7 slides in order; `01-cover` and `11-end-card` are always included)

| ID | When it shines |
|---|---|
| `01-cover` | Always first. Strong hero image required. Visual variant is chosen automatically, not by the agent. |
| `02-statement` | Best when hook is a short, punchy declaration. |
| `03-image-text` | Good when image and headline together tell the story. |
| `04-narrative` | Use for articles with strong narrative or explanation. |
| `05-pull-quote` | Best when article has a memorable standalone quote. |
| `06-key-stat` | Required when article has a compelling number. |
| `07-features` | Use for listicle-style articles or benefit-driven content. |
| `08-how-to` | Use for how-to, process, or instructional articles. |
| `09-full-image` | Works best when hero image is editorial/dramatic quality. |
| `10-image-box` | Use when a specific image detail needs a caption. |
| `11-end-card` | Always last. Writer headshot required. |

### Story (pick one per article)

| ID | Best for |
|---|---|
| `cover-image` | Strong hero photo articles. Visual-first. |
| `dark-statement` | Opinion, editorial, or bold claim articles. |
| `split-image` | Data or analysis articles needing image + context. |
| `pull-quote` | Articles with a strong quotable line. |
| `stat-card` | Data-driven articles with a headline number. |
| `editorial-light` | Writer-forward or personal-voice articles. |

### LinkedIn

No separate guide — LinkedIn reuses the exact Instagram Carousel post generated for
the same article whenever one exists in the same campaign. If it doesn't (e.g. only
LinkedIn was approved for that article), the pipeline generates one using the
Instagram Carousel prompt/template menu above and saves it onto the LinkedIn post.

---

## Playwright rules

- Export selector: `.export`
- `crossorigin` attribute: never add it to any `<img>` — breaks CDN images
- Font wait: `await page.evaluate(() => document.fonts.ready)` after `page.goto()`
- Screenshot: `page.locator('.export').screenshot()` — not `page.screenshot(clip=...)`
