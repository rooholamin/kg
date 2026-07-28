---
name: kg-hub-cinematic-direction
description: Battle-tested prompting knowledge for directing Higgsfield-generated cinematic video for KG Hub via Higgsfield's hosted MCP server — Reference Element rules, the multi-shot prompt structure, the narration/TTS/lip-sync production chain, content-filter avoidance, and per-genre shot patterns. Use whenever writing a narration + shotList script or calling generate_image/generate_video/generate_audio/job_status.
---

# KG Hub Cinematic Direction

Distilled from an internal production playbook (`Universal AI Cinematic Automation`) after many real shoots. Read `content-filter-reference.md` before writing any prompt that includes physical contact, steam/fog/mist, or camera/film-stock language.

## Golden rules

1. **Narration is the point, not a nice-to-have.** A video with no spoken content is a failed video, even if it's visually polished — the whole reason this pipeline exists is to turn an article into something that actually explains the article. Write the narration script first, from the article's real substance (its actual claim/number/technique), before touching any visual generation call.
2. **One character reference is enough.** The section's `elementId` is a Higgsfield Reference Element — embed it as a `<<<elementId>>>` placeholder directly inside the `prompt` text of every `generate_image`/`generate_video` call instead of stacking separate char-sheet/outfit-sheet image refs. Only reach for extra image refs if a shot needs something the character/environment text can't express (e.g. a specific prop).
3. **Environment is TEXT, not an image ref.** Passing a location photo as an image ref causes "ref bleeding" — the model copies the reference photo's exact composition into your output instead of just matching its mood. Write the KG Media Loft descriptor straight into the `Scene:` portion of your prompt instead.
4. **Use the model's structured multi-shot fields for real cuts.** Seedance 2.0 (`generate_video` with `params.model: "seedance_2_0"`) supports genuine hard cuts via structured multi-shot parameters, not just "CUT" written in prose — check `models_explore` for the exact field shape (something like `multi_shots`/`multi_prompt`) before your first call in a session. Writing timestamped camera directions in prose (see "Multi-shot prompt structure" below) still shapes what happens within/across those structured shots — use both together.
5. **The base video's own audio is thrown away — don't bother designing it.** `generate_audio: false` on the seedance call is deliberate: the final audio track is entirely the narration, applied later by `sync_so`. Spend your prompt budget on camera/action/lighting, not sound design.
6. **Block every shot as if the character is mid-speech.** The lip-sync pass needs a reasonably front-facing, expressive face across the clip — don't write a shot where the character turns fully away from camera or where their mouth would be obscured for the whole beat.
7. **Retry once before rewriting on a content-safety flag.** Some `nsfw`/`ip_detected` flags are transient. If the exact same call fails twice in a row, the trigger is real — rewrite the specific phrase (see the reference table) rather than the whole prompt.
8. **Never name real camera or film-stock brands.** "Arri Alexa 65", "Kodak Vision3", "Ilford HP5" etc. read as IP triggers. Say "large-format cinema camera" / "fine-grain cinematic film" instead.
9. **Genre shapes risk, not just mood.** `drama` trips content filters on intimate/atmospheric beats more than `epic` or `action` — if a dramatic beat fails, retry the same shot with `epic` before rewriting the text.
10. **Isolate one variable per retry.** If a working prompt pattern suddenly fails, change exactly one thing (the flagged phrase, then the genre, then the still) rather than rewriting everything at once — otherwise you can't tell what actually fixed it.
11. **A still first, always.** Generate the start-frame still before the video call. It anchors identity/composition and gives you something to inspect before spending video credits.
12. **Don't pad the narration to hit a duration.** Write however many words the actual point takes to make (aim ~12-15s worth, ~30-45 words) — `sync_so`'s `remap` mode reconciles the final length to the narration automatically, so there's no reason to stretch content thin just to fill time.
13. **Watch for `preset_recommendation`.** A generation call may come back suggesting a canned Higgsfield preset instead of starting your job. Unless directed to use a preset/template look, decline it and resubmit with `declined_preset_id` to force literal generation of your own script.

## Production chain

Four generation calls, always in this order, each feeding the next via same-session job IDs (never raw URLs):

1. **`generate_image`** (model `soul_2` or similar) — the start-frame still. Character + Loft, framed for whatever the first shot needs.
2. **`generate_video`** (model `seedance_2_0`, `generate_audio: false`) — the silent base shot(s), using the still's job ID as `start_image`. This is pure visual direction: camera, action, lighting.
3. **`generate_audio`** (model `seed_audio`) — the narration voiceover, `prompt` = the exact narration script and nothing else. No `voice_type`/`voice_id` — omit them; there is no discoverable preset voice catalog through this toolset, and every guessed ID has failed with "Voice not found" in testing. The model's default voice is the only currently-reliable path (a known limitation — see `content-filter-reference.md` if this changes).
4. **`generate_video`** (model `sync_so`, `sync_mode: "remap"`) — lip-syncs step 2's video to step 3's audio. `medias: [{value: <step 2 job id>, role: "input_video"}, {value: <step 3 job id>, role: "input_audio"}]`. This job's output is the final `videoUrl`.

Steps 2 and 3 are independent of each other (neither needs the other's output) — fire both, then poll both.

## Multi-shot prompt structure (for the seedance base video, step 2 above)

```
[VIDEO TYPE: Cinematic <genre>. ~<duration>-second sequence, matched to the narration's length.]

[CAMERA DIRECTION & ANGLE:
* 00:00-00:05: <shot 1 — angle, movement>
* 00:05-00:10: <shot 2 — angle, movement>
* 00:10-00:15: <shot 3 — angle, movement>]

[SUBJECT: <<<elementId>>> — <character description + outfit, from the CHARACTER brief>]
[VISUAL ACTION: <per-beat action matching the timestamps above — face reasonably visible/front-facing throughout, consistent with mid-speech (see Golden Rule 6)>]
[ENVIRONMENT: <KG Media Loft text descriptor>]
[COLOUR TONE: <direction>]
[LIGHTING AND MOOD: <sources, quality>]
```

Mirror this same structure into the model's structured multi-shot fields (per `models_explore`) so the hard cuts are enforced mechanically, not just implied by the prose. Each beat must be meaningfully distinct — a different angle, distance, or movement, not just a rephrase of the last one. No `[SFX:]` block — see Golden Rule 5.

## Shot-pattern defaults by story type

Adapt to what the article is actually about; these are starting points, not requirements. All of them assume the character is speaking the narration throughout — vary the camera, not whether they're talking.

- **Market/data story**: wide establishing shot in the Loft as the narration opens → medium shot delivering the key stat/finding, camera pushing in slightly → close-up for the payoff line.
- **Design/reveal story**: medium shot introducing the subject → camera drifts closer as the narration gets specific about the material/technique → close on the character's final line.
- **Explainer/how-to story**: direct-to-camera medium shot for the setup line → slight reframe/push for the core explanation → close for the payoff line.

## Narration writing principles

- Paraphrase the article's actual substance — a real number, technique, or claim — never a generic teaser ("you won't believe what we found").
- Write it as something a person would naturally say out loud: contractions, short clauses, no bullet-point phrasing.
- Target ~30-45 words (roughly 12-15s spoken at a measured pace) — see Golden Rule 12.
- One clear idea per video. Don't try to cram the whole article in; pick the single most interesting, specific point.

See `content-filter-reference.md` for the specific trigger phrases to avoid and their safe replacements, and `ad-shot-structures.md` for longer example sequences.
