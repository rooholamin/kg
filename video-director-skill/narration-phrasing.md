# Narration Phrasing in Segment Prompts

Every segment carries `generate_audio: true` and every segment speaks — avatar segments as on-camera dialogue, b-roll segments as the same narrator continuing off screen. The narration and the segment breakdown arrive already written and approved; the only thing this file covers is HOW to phrase the spoken line inside a `generate_video` prompt so Seedance renders it correctly and in the right voice.

**`<<<elementId>>>` below is illustrative shorthand.** It stands for "the character's real Reference Element ID value." In an actual API call you MUST substitute the real ID from your brief (e.g. `<<<fa81a933-0850-47ab-bd6b-f994283eb97e>>>`) — never the literal text `elementId`. Doing so caused a real production failure: Higgsfield receives no reference at all and generates a random, wrong-looking person. See SKILL.md Golden Rule 1.

## Avatar segment (`hasCharacter: true`)

The line is literal on-camera dialogue, and the prompt mentions the approved `characterLook` so wardrobe holds across independently-generated segments:

```
<<<the-real-id-value>>>, wearing <characterLook>, speaks directly to camera: "Not all brick is the same — the type you pick changes how your wall ages." Audio: spoken voice and natural room tone only — no background music, no score, no musical sting.
```

## B-roll segment (`hasCharacter: false`)

Nobody is visible, but the SAME voice must carry the script. Phrase it as scene continuity, never as an identity or voice-cloning claim:

```
<<<the-real-id-value>>> continues speaking from just off camera: "Red clay brick is fired hot, so it hardens and weathers well over decades." Audio: spoken voice and natural room tone only — no background music, no score, no musical sting.
```

Confirmed in testing: this renders real, intelligible narration in the character's voice with nobody on screen.

## The no-music tail is required on every prompt

Both examples end with the same audio note, and that isn't decoration. A single music bed is mixed over the finished video in post; anything Seedance scores into a clip fights it and can't be stripped out later, because the dialogue shares that track. Voice and room tone only, every segment, every phase.

**Phrasing that gets refused:** framing it as an identity/voice claim — e.g. "she is not visible, she narrates in her own voice" — triggered agent refusal twice. A generic "warm narrator reads:" is a safe fallback but won't hold the same voice across segments, so only fall back to it if the continuity phrasing fails.
