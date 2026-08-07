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
3. **One character anchor still per video, shot against nothing, chained into every character frame.** Generate exactly ONE character still (Step 0 of PHASE: stills): plain backdrop, no room, no set dressing, no scenery — it answers who she is and what she's wearing, and nothing about where she is. Each avatar (`hasCharacter: true`) segment then gets its OWN start frame, generated with that anchor passed as an image reference (`params.medias`, `role: "image"`) alongside the Reference Element ID. An image reference carries background as much as identity, so an anchor with a room in it drags that room into every frame chained off it and the character can never leave it — that is exactly how a video about a garden ends up shot in the studio. Identity and wardrobe come from the character anchor, the place comes from the segment's place anchor (rule 5), pose and action come from the prompt. A character frame produced without the anchor chained in is an independent roll of the dice on her appearance. Never generate a second character anchor mid-video unless a director note explicitly asks for a look change.
4. **The Reference Element covers identity (face/build) — it does NOT cover wardrobe/styling.** Never describe the character's face, ethnicity, or build in words; the Reference Element carries that. But their training photo is typically just a headshot, so it carries no wardrobe information at all — that's why your brief includes an already-decided `characterLook` (wardrobe/hair/styling for this shoot). Mention it briefly in every avatar segment's prompt so it stays consistent across independently-generated segments, even though the anchor still (rule 3) already anchors it visually for most segments.
5. **Places and subjects are anchors: description restated verbatim AND their own frame chained in.** The plan declares every place the video visits and every recurring thing it returns to (`anchors`), and each segment names the ones in its shot (`anchorKeys`). Use both tools on every one of them — the verbatim text stops the model drifting, the chained frame stops it inventing. Text alone loses: it is why a video about one closet came back showing five different closets. Never substitute an outside location photo of your own as a reference; the only images you chain are frames generated in this session. Two related notes: the home environment is where a video opens and closes, not a cage — a segment set in a declared garden is shot in that garden; and `stillReferenceOrder` remains the narrower tool for two shots that must match down to the composition (a before/after pair), because it copies framing as well as content, so chaining it everywhere makes every shot look like the same photograph.
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

- **Step 0, once per video:** `generate_image` with `params.model: "nano_banana_2"` — ONE character anchor still: the real Reference Element ID value wrapped in `<<< >>>` (never the literal word "elementId" — Golden Rule 1), wearing the approved `characterLook`, clean neutral front-facing composition against a plain backdrop with no room or scenery behind her, at the configured `aspect_ratio` and `resolution` (Golden Rule 10). This is the canonical look every character frame derives from — never regenerated mid-video (Golden Rule 3).
- **Step 1, one frame per declared anchor, before any segment:** each place and subject in `anchors`, shot on its own with no character, its `description` verbatim as the subject of the prompt. Place anchors want a wide establishing view so later shots can sit anywhere inside them. These are the canonical frames every segment in that place or showing that subject chains (Golden Rule 5).
- **Step 2, one frame per segment** — every segment, avatar and b-roll alike:
  - Always: chain the anchor still of every key in `anchorKeys` and restate those descriptions verbatim.
  - Avatar (`hasCharacter: true`): additionally `nano_banana_2`, the real ID wrapped in `<<< >>>`, the character anchor chained as a further image reference, the segment's own `visualDescription`, and the approved `characterLook` restated plus any `wardrobeAddition`.
  - B-roll (`hasCharacter: false`): that segment's actual subject, no character.
  - Either kind with `stillReferenceOrder` set: also chain the referenced segment's frame. Generate in ascending order so it exists first.
  - Always the exact configured `aspect_ratio` and `resolution`.
- Then report and stop. No `generate_video` in this phase under any circumstances.

**PHASE: shoot — one `generate_video` per segment, after a human approved the frames:**

`generate_video` (model `seedance_2_0`, `generate_audio: true`) — that segment's own approved still job ID as `start_image`, a duration worked out from the spoken line's word count, exact configured `aspect_ratio`, and the segment's `spokenPortion` written either as on-camera dialogue (`hasCharacter: true`, mentioning `characterLook` per Golden Rule 4) or an off-screen narrator's line (`hasCharacter: false`, natural-continuity phrasing with the real ID value per Golden Rule 8). This call's output IS the segment's final `videoUrl`. Job IDs chain within the session — never pass a raw URL.

`PHASE: regenerate_segment` redoes the `generate_video` step for one segment from its already-approved frame. Only generate a replacement frame if the complaint is about the frame rather than the motion — and then chain that segment's anchors again, plus the Step 0 character anchor if it's an avatar segment, exactly as in PHASE: stills.

## Segment prompt structure (for the `generate_video` call above)

```
[VIDEO TYPE: Cinematic <genre>. ~<duration>-second segment.]

[SUBJECT: <<<the-real-reference-element-id-value>>> — substitute the actual ID from your brief, never the literal word "elementId" (Golden Rule 1), wearing <characterLook> — or the b-roll subject itself if not hasCharacter]
[VISUAL ACTION: <what's happening on screen this segment, matching visualDescription>]
[ENVIRONMENT: <the verbatim description of this segment's place anchor — the Loft for most segments, or wherever the plan sent this one>]
[DIALOGUE / NARRATION: <the segment's spokenPortion — literal on-camera dialogue if hasCharacter, or an off-screen narrator's line otherwise, phrased per Golden Rule 8 if the character's voice should carry through>]
[COLOUR TONE: <direction>]
[LIGHTING AND MOOD: <sources, quality>]
```

No `[SFX:]` block — background music is mixed in separately by the backend after assembly; don't design ambient sound in the prompt.

See `content-filter-reference.md` for the specific trigger phrases to avoid and their safe replacements, and `narration-phrasing.md` for how to word the spoken line in an avatar vs. b-roll segment prompt.
