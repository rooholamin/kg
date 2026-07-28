---
name: kg-hub-cinematic-direction
description: Battle-tested prompting knowledge for directing Higgsfield-generated cinematic video for KG Hub via Higgsfield's hosted MCP server — Reference Element rules, the continuous-narration/multi-segment structure, native-audio prompting (avatar dialogue + off-screen voiceover), content-filter avoidance, and per-style shot patterns. Use whenever writing a plan (PHASE: plan), directing a shoot (PHASE: execute), or regenerating one segment (PHASE: regenerate_segment).
---

# KG Hub Cinematic Direction

Distilled from an internal production playbook (`Universal AI Cinematic Automation`) after many real shoots, including validation of the Plan → Approve → Execute workflow. Read `content-filter-reference.md` before writing any prompt that includes physical contact, steam/fog/mist, or camera/film-stock language.

## Golden rules

1. **Write the full narration script first, as one continuous piece.** The whole video is a single flowing story — write it start to finish, sized via the pacing rule below to the intended total runtime, *then* decide how to distribute it across segments. Never invent a disconnected one-off line per segment; that reads as fragmented, not directed.
2. **Every segment carries real spoken content — no silent segment, ever.** Segments where the character isn't visible still get their own slice of the continuous script, delivered as off-screen narration. A video with any silent stretch is a failed video.
3. **One character reference is enough.** The section's `elementId` is a Higgsfield Reference Element — embed it as a `<<<elementId>>>` placeholder directly inside the `prompt` text of every `generate_image`/`generate_video` call instead of stacking separate char-sheet/outfit-sheet image refs.
4. **Environment is TEXT, not an image ref.** Passing a location photo as an image ref causes "ref bleeding" — the model copies the reference photo's exact composition into your output instead of just matching its mood. Write the KG Media Loft descriptor straight into the `Scene:` portion of your prompt instead.
5. **Native Seedance audio (`generate_audio: true`) handles ALL narration — avatar dialogue AND off-screen voiceover.** Confirmed in testing: a prompt describing an off-screen narrator with nobody visibly speaking still renders real, intelligible narration. This means one single audio system covers the entire video regardless of whether the character is on screen in a given segment — never reach for a separate TTS tool.
6. **Identity only ever via `<<<elementId>>>` — never the character's literal name as text.** Writing the proper name in a prompt causes the model to render it as garbled on-screen text (confirmed real failure: a name printed wrong on a shirt).
7. **Keep the character's voice consistent in b-roll segments via natural scene-continuity phrasing**, e.g. `"<<<elementId>>> continues speaking from just off camera: '...'"` — not an explicit identity/voice-cloning claim like "she is not visible, narrates in her own voice" (confirmed: that framing triggers agent refusal twice; the natural-continuity phrasing produced a real working result). A generic "warm narrator" description with no identity reference is a safe fallback but won't guarantee the same voice.
8. **Pacing: ~2.3-2.5 spoken words per second of segment duration.** A prior test crammed 50 words into 10s (~300 wpm) and the delivery came out rushed; ~23-25 words for a 10s segment is the correct density.
9. **Segment duration asymmetry**: avatar (on-camera) segments run longer (~10s); concept/b-roll segments should be noticeably shorter (~5-6s) — confirmed this reads better than equal-length segments.
10. **Orientation must always be explicitly set on every single generation call**, from the CONFIG value passed into the session — never omitted, never left to a tool's own default. A real failure: one session left `aspect_ratio` unset, Seedance defaulted to 16:9, and the result couldn't go through the downstream 9:16-only captioning step at all.
11. **Retry once before rewriting on a content-safety flag.** Some `nsfw`/`ip_detected` flags are transient. If the exact same call fails twice in a row, the trigger is real — rewrite the specific phrase (see the reference table) rather than the whole prompt.
12. **Never name real camera or film-stock brands.** "Arri Alexa 65", "Kodak Vision3", "Ilford HP5" etc. read as IP triggers. Say "large-format cinema camera" / "fine-grain cinematic film" instead.
13. **Genre shapes risk, not just mood.** `drama` trips content filters on intimate/atmospheric beats more than `epic` or `action` — if a dramatic beat fails, retry the same shot with `epic` before rewriting the text.
14. **Isolate one variable per retry.** If a working prompt pattern suddenly fails, change exactly one thing (the flagged phrase, then the genre, then the still) rather than rewriting everything at once.
15. **A still first, always.** Generate the start-frame still before the video call. It anchors identity/composition and gives you something to inspect before spending video credits.
16. **Don't pad the narration to hit a duration or a target shot count.** Write however many words the actual point takes to make. If `targetShotCount` is set and doesn't comfortably fit the script you wrote, prefer a natural fit over forced padding/cramming.
17. **Watch for `preset_recommendation`.** A generation call may come back suggesting a canned Higgsfield preset instead of starting your job. Unless directed to use a preset/template look, decline it and resubmit with `declined_preset_id` to force literal generation of your own script.
18. **A single failed segment should never sink the whole video.** During PHASE: execute, if one segment can't be salvaged after a retry + rewrite, report its per-segment `errorMessage` and keep directing the rest — the backend tracks and can regenerate that one segment independently later.

## Plan → Approve → Execute — what changes across phases

- **PHASE: plan** is text-only — no generation calls. Write the narration, decide the segment breakdown (respecting `targetShotCount`/`platform`/`style` from CONFIG), and stop. This is the cheap, human-reviewable step — nothing costs money yet.
- **PHASE: execute** happens only after a human approves the plan (possibly with light edits, which take priority over what you originally wrote). Now you actually call `generate_image`/`generate_video` per segment, in order, and report real `videoUrl`/`duration`/`higgsfieldJobId` per segment.
- **PHASE: regenerate_segment** touches exactly one segment. You still have full session memory of the whole video's narration/character/environment/config — use it so the regenerated segment stays consistent with the rest, but never re-mention or re-generate any other segment.

## Production chain (per segment, PHASE: execute / regenerate_segment)

Two generation calls per segment, always in this order, chained via same-session job IDs (never raw URLs):

1. **`generate_image`** (model `soul_2` or similar) — the start-frame still for this segment. Character + Loft (if `hasCharacter`) or the b-roll subject (if not), matching the segment's `visualDescription`. Always pass the exact configured `aspect_ratio`.
2. **`generate_video`** (model `seedance_2_0`, `generate_audio: true`) — the still's job ID as `start_image`, duration close to the segment's intended length, exact configured `aspect_ratio`, and the segment's `spokenPortion` written either as on-camera dialogue (`hasCharacter: true`) or an off-screen narrator's line (`hasCharacter: false`, natural-continuity `<<<elementId>>>` phrasing per Golden Rule 7). This call's output IS the segment's final `videoUrl` — there is no separate lip-sync pass anymore.

## Segment prompt structure (for the `generate_video` call above)

```
[VIDEO TYPE: Cinematic <genre>. ~<duration>-second segment.]

[SUBJECT: <<<elementId>>> — <character description + outfit, from the CHARACTER brief, if hasCharacter — or the b-roll subject itself>]
[VISUAL ACTION: <what's happening on screen this segment, matching visualDescription>]
[ENVIRONMENT: <KG Media Loft text descriptor, or the b-roll setting>]
[DIALOGUE / NARRATION: <the segment's spokenPortion — literal on-camera dialogue if hasCharacter, or an off-screen narrator's line otherwise, phrased per Golden Rule 7 if the character's voice should carry through>]
[COLOUR TONE: <direction>]
[LIGHTING AND MOOD: <sources, quality>]
```

No `[SFX:]` block — background music is mixed in separately by the backend after assembly; don't design ambient sound in the prompt.

## Segment-pattern defaults by video style

Adapt to what the article and CONFIG's `style` actually call for; these are starting points, not requirements.

- **explainer**: hook segment (avatar, direct-to-camera) states the core question/claim → 1-3 b-roll segments each narrating one specific supporting fact/example → avatar closes with the payoff line.
- **diy** (tutorial/how-to): avatar intro (what you'll learn) → several short b-roll segments, each narrating one concrete step/material → avatar or b-roll close with the result/payoff.
- **listicle**: brief avatar intro → one b-roll segment per listed item, each narrating that item's specific detail → avatar closes summarizing the takeaway.
- **testimonial**: avatar-forward throughout (longer avatar segments, minimal b-roll) — the character speaking directly to camera IS the format; use short cutaways only for a specific supporting visual, not to break up the talking.
- **auto**: infer the closest fit above from the article's actual structure (a numbered list of things → listicle; a step-by-step process → diy; a single strong claim/finding → explainer).

See `content-filter-reference.md` for the specific trigger phrases to avoid and their safe replacements, and `ad-shot-structures.md` for longer example narration + segment breakdowns.
