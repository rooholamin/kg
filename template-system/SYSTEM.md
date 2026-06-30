# KG Hub — Social Media Template System

## Structure

```
template-system/
├── assets/
│   ├── K.png               ← brand watermark
│   ├── logo.svg            ← KG logo
│   ├── fonts/              ← TCM-Bold, TCM-Regular, Dosis-Book, Dosis-SemiBold
│   └── photos/             ← livia, joseph, stephen, elara, selene, eden, michael (.jpg)
├── carousel/               ← 11 files, one per slide
├── story/                  ← 6 files, one per template variant
├── linkedin/               ← 5 files, one per template variant
└── SYSTEM.md
```

## How templates work

Each file is a standalone HTML page containing one slide. Fill `{{PLACEHOLDER}}` tokens with real values, then export `.export` with Playwright.

**Export selector:** `.export`  
**No JS, no swiper, no navigation** — just one slide per file.

---

## Placeholders

### Common (used across most templates)

| Placeholder | Description | Example |
|---|---|---|
| `{{HERO_IMAGE}}` | Article hero image URL | `https://cdn.kghub...` |
| `{{ART_TITLE}}` | Article headline | `Embracing Luxury: A Guide...` |
| `{{HOOK}}` | Opening hook sentence | `Living above the city...` |
| `{{QUOTE}}` | Pull quote from article | `In a penthouse, the city...` |
| `{{STAT_N}}` | Stat figure | `2.4×` |
| `{{STAT_L}}` | Stat label | `price premium on penthouse units` |
| `{{TONE}}` | Section tone label | `LIFESTYLE` |
| `{{SECTION_NAME}}` | Section display name | `KG Living` |
| `{{SECTION_NAME_UPPER}}` | Section name uppercased | `KG LIVING` |
| `{{WRITER_NAME}}` | Writer full name | `Livia Moretti` |
| `{{WRITER_NAME_UPPER}}` | Writer name uppercased | `LIVIA MORETTI` |
| `{{WRITER_PHOTO}}` | Writer headshot URL | `assets/photos/livia.jpg` |
| `{{COLOR_ACCENT}}` | Section primary accent color (hex) | `#CCB260` |
| `{{COLOR_LIGHT}}` | Section light accent (hex) | `#E0CC7A` |
| `{{COLOR_DARK}}` | Section dark accent (hex) | `#7A5500` |

### Carousel-only placeholders

| Placeholder | Slide | Description |
|---|---|---|
| `{{NARRATIVE}}` | slide-04 | Full paragraph combining hook + context |
| `{{FEAT_1_LABEL}}` … `{{FEAT_4_LABEL}}` | slide-07 | Feature row titles |
| `{{FEAT_1_DESC}}` … `{{FEAT_4_DESC}}` | slide-07 | Feature row descriptions |
| `{{STEP_1_TITLE}}` … `{{STEP_3_TITLE}}` | slide-08 | Step titles |
| `{{STEP_1_DESC}}` … `{{STEP_3_DESC}}` | slide-08 | Step descriptions |
| `{{IMGBOX_CAPTION}}` | slide-10 | Caption under the boxed image |
| `{{END_CARD_BIO}}` | slide-11 | Short writer bio / section tagline |

### Story-only placeholder

| Placeholder | Description |
|---|---|
| `{{ARTICLE_URL}}` | Full article URL shown in the link sticker |

---

## Colour system

Background colors are fixed across all sections — do not replace them:

| Variable | Value | Used on |
|---|---|---|
| `#1C1910` | Primary dark | Most dark slides |
| `#222016` | Secondary dark | Pull quote, steps slides |
| `#EEEAE0` | Light off-white | Statement, features, end card |

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

| Format | File | Viewport | Scale factor | Output |
|---|---|---|---|---|
| Carousel slides | `carousel/slide-*.html` | 420×525 | `1080÷420` | 1080×1350 |
| Story | `story/story-*.html` | 420×747 | `1080÷420` | 1080×1920 |
| LinkedIn | `linkedin/linkedin-*.html` | 600×314 | `2.0` | 1200×628 |

Export the `.export` div using `page.locator('.export').screenshot()`.  
Wait 3 seconds after `set_content` for fonts to load.  
Never set the viewport to the output size — use `device_scale_factor` to scale up.

---

## Template guide — which to use when

### Carousel (all 11 slides used every post, in order)

| File | When it shines |
|---|---|
| slide-01-cover | Always first. Strong hero image required. |
| slide-02-statement | Best when hook is a short, punchy declaration. |
| slide-03-image-text | Good when image and headline together tell the story. |
| slide-04-narrative | Use for articles with strong narrative or explanation. |
| slide-05-pull-quote | Best when article has a memorable standalone quote. |
| slide-06-key-stat | Required when article has a compelling number. |
| slide-07-features | Use for listicle-style articles or benefit-driven content. |
| slide-08-steps | Use for how-to, process, or instructional articles. |
| slide-09-full-image | Works best when hero image is editorial/dramatic quality. |
| slide-10-image-box | Use when a specific image detail needs a caption. |
| slide-11-end-card | Always last. Writer headshot required. |

### Story (pick one per article)

| File | Best for |
|---|---|
| story-01-cover-image | Strong hero photo articles. Visual-first. |
| story-02-dark-statement | Opinion, editorial, or bold claim articles. |
| story-03-split-image | Data or analysis articles needing image + context. |
| story-04-pull-quote | Articles with a strong quotable line. |
| story-05-stat-card | Data-driven articles with a headline number. |
| story-06-editorial-light | Writer-forward or personal-voice articles. |

### LinkedIn (pick one per article)

| File | Best for |
|---|---|
| linkedin-01-bottom-anchor | General article shares. Clean and versatile. |
| linkedin-02-left-panel | Analysis or thought-leadership pieces needing hook copy. |
| linkedin-03-center-vignette | Premium or award-type announcements. |
| linkedin-04-stat-overlay | Data-heavy articles where the number is the story. |
| linkedin-05-quote-overlay | Articles with a sharp executive or expert quote. |

---

## Playwright rules

- Export selector: `.export`  
- `crossorigin` attribute: never add it to any `<img>` — breaks CDN images  
- Font wait: `await page.wait_for_timeout(3000)` after `set_content`  
- Screenshot: `page.locator('.export').screenshot()` — not `page.screenshot(clip=...)`
