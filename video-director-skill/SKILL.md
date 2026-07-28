---
name: kg-hub-cinematic-direction
description: Battle-tested prompting knowledge for directing Higgsfield-generated cinematic video for KG Hub — ref-stacking rules, the multi-shot prompt structure, content-filter avoidance, and per-genre shot patterns. Use whenever writing a shotList script or calling generate_image/generate_video/get_generation_status.
---

# KG Hub Cinematic Direction

Distilled from an internal production playbook (`Universal AI Cinematic Automation`) after many real shoots. Read `content-filter-reference.md` before writing any prompt that includes physical contact, steam/fog/mist, or camera/film-stock language.

## Golden rules

1. **One character reference is enough.** The section's `characterId` is a trained Higgsfield Soul Character — pass it on every `generate_image` call instead of stacking separate char-sheet/outfit-sheet image refs. Soul Character supersedes the old "8-ref ceiling" ref-stacking discipline; only reach for extra image refs if a shot needs something the character/environment text can't express (e.g. a specific prop).
2. **Environment is TEXT, not an image ref.** Passing a location photo as an `--image`-style ref causes "ref bleeding" — the model copies the reference photo's exact composition into your output instead of just matching its mood. Write the KG Media Loft descriptor straight into the `Scene:` portion of your prompt instead.
3. **Prefer one multi-shot generation over many short clips.** Video models in this family support several hard cuts inside a single generation via timestamped camera directions (see "Multi-shot prompt structure" below). Stitching separate clips together is a fallback, not the default.
4. **Always end sound design with "No music."** Sound should be physical and material-specific (fabric rustle, footsteps on a specific surface, glass, paper) and escalate through the clip — never musical, so there's no music-licensing conflict and no clash with a platform's own soundtrack tools.
5. **Retry once before rewriting on a content-safety flag.** Some `nsfw`/`ip_detected` flags are transient. If the exact same call fails twice in a row, the trigger is real — rewrite the specific phrase (see the reference table) rather than the whole prompt.
6. **Never name real camera or film-stock brands.** "Arri Alexa 65", "Kodak Vision3", "Ilford HP5" etc. read as IP triggers. Say "large-format cinema camera" / "fine-grain cinematic film" instead.
7. **Genre shapes risk, not just mood.** `drama` trips content filters on intimate/atmospheric beats more than `epic` or `action` — if a dramatic beat fails, retry the same shot with `epic` before rewriting the text.
8. **Isolate one variable per retry.** If a working prompt pattern suddenly fails, change exactly one thing (the flagged phrase, then the genre, then the still) rather than rewriting everything at once — otherwise you can't tell what actually fixed it.
9. **A still first, always.** Generate the start-frame still before the video call. It anchors identity/composition and gives you something to inspect before spending video credits.
10. **Every shot earns its place.** Do not pad a script to hit a shot count — cut a beat that doesn't advance the story rather than let two shots restate the same idea.

## Multi-shot prompt structure

```
[VIDEO TYPE: Cinematic <genre>. <duration>-second sequence.]

[CAMERA DIRECTION & ANGLE:
* 00:00-00:04: <shot 1 — angle, movement>
* 00:04-00:10: <shot 2 — angle, movement>
* 00:10-00:15: <shot 3 — angle, movement>]

[SUBJECT: <character description + outfit, from the CHARACTER brief>]
[VISUAL ACTION: <per-beat action matching the timestamps above>]
[ENVIRONMENT: <KG Media Loft text descriptor>]
[COLOUR TONE: <direction>]
[LIGHTING AND MOOD: <sources, quality>]
[SFX: <specific physical sounds per beat, escalating>]

No music.
```

Timestamps must cover the full requested duration with no gaps. Each beat must be meaningfully distinct — a different angle, distance, or movement, not just a rephrase of the last one.

## Shot-pattern defaults by story type

Adapt to what the article is actually about; these are starting points, not requirements.

- **Market/data story**: wide establishing shot in the Loft → character reacting to a stat/visual → medium shot delivering the key line → close on a detail (a chart, a model, a prop) → wide pull-back.
- **Design/reveal story**: close on a material/texture detail → medium reveal of the full subject → character's reaction → wide shot placing it in the Loft → close on the character's closing beat.
- **Explainer/how-to story**: character direct-to-camera intro → medium demonstrating the first point → cut to the second point → close on the payoff → wide closing shot.

## Sound design principles

- Name the specific material producing the sound (paper, glass, fabric, footsteps on a named surface).
- Escalate intensity beat-to-beat — never flat across the whole clip.
- Never musical. Always end with "No music."

See `content-filter-reference.md` for the specific trigger phrases to avoid and their safe replacements, and `ad-shot-structures.md` for longer example sequences.
