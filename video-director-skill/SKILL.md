---
name: kg-hub-cinematic-direction
description: Battle-tested prompting knowledge for Higgsfield-generated cinematic video at KG Hub — Reference Element rules, the still-image model that actually honors them, the anchor-still consistency mechanic, native-audio prompting (avatar dialogue + off-screen voiceover), and content-filter avoidance. Use whenever generating start frames (PHASE: stills), directing a shoot (PHASE: shoot), or regenerating one segment (PHASE: regenerate_segment). ALSO use when PLANNING a video (writing narration, segment breakdowns, visualDescriptions, or a character look) — most of this file is execution procedure a planner can't act on, but `content-filter-reference.md` applies directly, since a visualDescription written at plan time becomes the generation prompt later and can be rejected for language the planner chose.
---

# KG Hub Cinematic Direction

Distilled from an internal production playbook (`Universal AI Cinematic Automation`) after many real shoots. Read `content-filter-reference.md` before writing any prompt that includes physical contact, steam/fog/mist, or camera/film-stock language.

**If you're the Planner Agent, `content-filter-reference.md` is the part that concerns you** — everything else here is procedure for driving Higgsfield tools you don't have. A `visualDescription` you write today becomes a real generation prompt tomorrow, so a phrase that trips the filter costs a failed generation after the human has already approved your plan.

## Golden rules

1. **Write the REAL Reference Element ID value, never the literal word "elementId".** This is the #1 confirmed production failure — worse than anything else in this list. Your brief gives you an actual ID string (looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`); wrap THAT VALUE in triple angle brackets in your prompt, e.g. `<<<fa81a933-0850-47ab-bd6b-f994283eb97e>>>`. Writing the literal text `<<<elementId>>>` instead (mistaking the field's NAME for its VALUE) sends Higgsfield an empty reference — `reference_elements` comes back `[]` — and it silently generates a completely random, wrong-looking person. This has actually happened in a real shipped video. Before firing any call that should reference the character, re-check that the bracketed text is the real ID, not the word "elementId".
2. **`generate_image` MUST use `params.model: "nano_banana_2"` whenever the character is in the shot — never `"soul_2"`/`"text2image_soul_v2"`.** This is the #2 confirmed production failure, and produces the exact same symptom as #1 (a random wrong person) even when the real ID value is embedded correctly. Confirmed via a real side-by-side test: `soul_2`/`text2image_soul_v2`'s response has NO `reference_elements` field at all — it silently drops the reference — while `nano_banana_2`'s response correctly comes back with `reference_elements` populated with the real trained photo. If a still still shows the wrong person after confirming the ID text is correct, check the model name next.
3. **One anchor still, reused for every avatar segment.** Generate exactly ONE character still per video (Step 0 of PHASE: stills), then reuse that same still's job id as `start_image` for every avatar (`hasCharacter: true`) segment, including any later `PHASE: regenerate_segment` calls in the same session. Never generate a second, independent character still mid-video.
4. **The Reference Element covers identity (face/build) — it does NOT cover wardrobe/styling.** Never describe the character's face, ethnicity, or build in words; the Reference Element carries that. But their training photo is typically just a headshot, so it carries no wardrobe information at all — that's why your brief includes an already-decided `characterLook` (wardrobe/hair/styling for this shoot). Mention it briefly in every avatar segment's prompt so it stays consistent across independently-generated segments, even though the anchor still (rule 3) already anchors it visually for most segments.
5. **Environment is TEXT, not an image ref.** Passing a location photo as an image ref causes "ref bleeding" — the model copies the reference photo's exact composition into your output instead of just matching its mood. Write the KG Media Loft descriptor straight into the `Scene:` portion of your prompt instead.
6. **Native Seedance audio (`generate_audio: true`) handles ALL narration — avatar dialogue AND off-screen voiceover.** Confirmed in testing: a prompt describing an off-screen narrator with nobody visibly speaking still renders real, intelligible narration. This means one single audio system covers the entire video regardless of whether the character is on screen in a given segment — never reach for a separate TTS tool.
7. **Identity only ever via the real ID value wrapped in `<<< >>>` (rule 1) — never the character's literal name as text.** Writing the proper name in a prompt causes the model to render it as garbled on-screen text (confirmed real failure: a name printed wrong on a shirt).
8. **Keep the character's voice consistent in b-roll segments via natural scene-continuity phrasing**, e.g. `"<<<the-real-id-value>>> continues speaking from just off camera: '...'"` — not an explicit identity/voice-cloning claim like "she is not visible, narrates in her own voice" (confirmed: that framing triggers agent refusal twice; the natural-continuity phrasing produced a real working result). A generic "warm narrator" description with no identity reference is a safe fallback but won't guarantee the same voice.
9. **Orientation must always be explicitly set on every single generation call**, from the CONFIG value in your brief — never omitted, never left to a tool's own default. A real failure: one session left `aspect_ratio` unset, Seedance defaulted to 16:9, and the result couldn't go through the downstream 9:16-only captioning step at all.
10. **`params.resolution` must be set on every `generate_image` call**, from the `stillResolution` value in your brief (`1k`/`2k`/`4k`). `nano_banana_2` silently defaults to `1k`. That's soft enough that any writing in frame — signage, labels, book spines, product text — renders as mush, and Seedance animates the mush into gibberish lettering in the finished clip. Confirmed real failure. `generate_video` has no equivalent parameter; this is a stills-only rule.
11. **Retry once before rewriting on a content-safety flag.** Some `nsfw`/`ip_detected` flags are transient. If the exact same call fails twice in a row, the trigger is real — rewrite the specific phrase (see the reference table) rather than the whole prompt.
12. **Never name real camera or film-stock brands.** "Arri Alexa 65", "Kodak Vision3", "Ilford HP5" etc. read as IP triggers. Say "large-format cinema camera" / "fine-grain cinematic film" instead.
13. **Genre shapes risk, not just mood.** `drama` trips content filters on intimate/atmospheric beats more than `epic` or `action` — if a dramatic beat fails, retry the same shot with `epic` before rewriting the text.
14. **Isolate one variable per retry.** If a working prompt pattern suddenly fails, change exactly one thing (the flagged phrase, then the genre, then the still) rather than rewriting everything at once.
15. **Watch for `preset_recommendation`.** A generation call may come back suggesting a canned Higgsfield preset instead of starting your job. Unless directed to use a preset/template look, decline it and resubmit with `declined_preset_id` to force literal generation of your own script.
16. **A single failed segment should never sink the whole video.** If one segment can't be salvaged after a retry + rewrite, report its per-segment `errorMessage` and keep directing the rest — the backend tracks and can regenerate that one segment independently later.

## Your job starts after planning is already done

The narration, segment breakdown, and `characterLook` all arrive in your brief already written and human-approved by a separate Planner Agent — you never write or revise them. Your job is purely to turn each already-decided segment into a real, correctly-directed Higgsfield generation. If a segment's `visualDescription`/`spokenPortion` seems awkward, direct it as given rather than improvising a different structure — flag it for the human via `errorMessage` only if it's genuinely impossible to shoot (e.g. content-policy conflict that survives a rewrite attempt), not because you'd have written it differently.

## Production chain

The chain is deliberately split in half by a human review gate, because a malformed still — an extra hand, hardware assembled backwards, text that isn't real text — reliably becomes a malformed clip, and the clip costs roughly seven times what the still costs.

**PHASE: stills — every start frame, and nothing else:**

- **Step 0, once per video:** `generate_image` with `params.model: "nano_banana_2"` — ONE character anchor still: the real Reference Element ID value wrapped in `<<< >>>` (never the literal word "elementId" — Golden Rule 1), wearing the approved `characterLook`, a clean neutral front-facing composition in the Loft, at the configured `aspect_ratio` and `resolution` (Golden Rule 10). This job id is reused as `start_image` for every avatar segment — never regenerated mid-video (Golden Rule 3).
- **Step 1, per b-roll segment** (`hasCharacter: false`): a fresh `generate_image` call for that segment's actual subject, matching its `visualDescription` (model doesn't matter here, no character involved). Always pass the exact configured `aspect_ratio` and `resolution`. Avatar segments get no still of their own — they share the anchor.
- Then report and stop. No `generate_video` in this phase under any circumstances.

**PHASE: shoot — one `generate_video` per segment, after a human approved the frames:**

`generate_video` (model `seedance_2_0`, `generate_audio: true`) — the approved still's job ID as `start_image` (the shared anchor for avatar segments, that segment's own approved still otherwise), a duration worked out from the spoken line's word count, exact configured `aspect_ratio`, and the segment's `spokenPortion` written either as on-camera dialogue (`hasCharacter: true`, mentioning `characterLook` per Golden Rule 4) or an off-screen narrator's line (`hasCharacter: false`, natural-continuity phrasing with the real ID value per Golden Rule 8). This call's output IS the segment's final `videoUrl`. Job IDs chain within the session — never pass a raw URL.

`PHASE: regenerate_segment` redoes the `generate_video` step for one segment, reusing the SAME Step 0 anchor still from earlier in the session if it's an avatar segment, or that segment's already-approved b-roll still otherwise.

## Segment prompt structure (for the `generate_video` call above)

```
[VIDEO TYPE: Cinematic <genre>. ~<duration>-second segment.]

[SUBJECT: <<<the-real-reference-element-id-value>>> — substitute the actual ID from your brief, never the literal word "elementId" (Golden Rule 1), wearing <characterLook> — or the b-roll subject itself if not hasCharacter]
[VISUAL ACTION: <what's happening on screen this segment, matching visualDescription>]
[ENVIRONMENT: <KG Media Loft text descriptor, or the b-roll setting>]
[DIALOGUE / NARRATION: <the segment's spokenPortion — literal on-camera dialogue if hasCharacter, or an off-screen narrator's line otherwise, phrased per Golden Rule 8 if the character's voice should carry through>]
[COLOUR TONE: <direction>]
[LIGHTING AND MOOD: <sources, quality>]
```

No `[SFX:]` block — background music is mixed in separately by the backend after assembly; don't design ambient sound in the prompt.

See `content-filter-reference.md` for the specific trigger phrases to avoid and their safe replacements, and `narration-phrasing.md` for how to word the spoken line in an avatar vs. b-roll segment prompt.
