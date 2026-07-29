# Example Plans (Narration + Segment Breakdown)

Reference sequences to adapt, not templates to fill in blindly — always ground the actual beats in the article being covered. Every segment below carries `generate_audio: true` — avatar segments render on-camera dialogue, b-roll segments render off-screen narration continuing the exact same script. No segment is ever silent.

**IMPORTANT — `<<<elementId>>>` below is illustrative shorthand only, for these written examples.** It stands for "insert the character's real Reference Element ID value here." When you actually write a `generate_image`/`generate_video` prompt during PHASE: execute, you MUST substitute the real ID value from your brief (e.g. `<<<fa81a933-0850-47ab-bd6b-f994283eb97e>>>`) — never copy the literal text `<<<elementId>>>` into an actual API call. Doing so has caused a real production failure: Higgsfield receives no reference at all and generates a random, wrong-looking person. See SKILL.md Golden Rule 1.

## Explainer style (~24s, 3 segments — article: "Types of brick for a garden wall")

Full continuous narration (written first, then split below):
> "Not all brick is the same — the type you pick changes how your wall ages. Red clay brick is the classic choice: fired hot, it gets harder and more weather-resistant over decades. Concrete brick costs less up front but chips more easily in a hard freeze. If you want texture with a story, reclaimed brick brings both — just budget more time for sourcing it."

```
Segment 1 — order 1, hasCharacter: true, ~10s
  spokenPortion: "Not all brick is the same — the type you pick changes how your wall ages."
  visualDescription: Medium shot, character direct-to-camera in the KG Media Loft, morning light — this is the hook.

Segment 2 — order 2, hasCharacter: false, ~6s
  spokenPortion: "Red clay brick is the classic choice: fired hot, it gets harder and more weather-resistant over decades."
  visualDescription: Close b-roll on a stacked red clay brick wall section, warm directional light raking across the texture. <<<elementId>>> continues narrating from just off camera.

Segment 3 — order 3, hasCharacter: false, ~6s
  spokenPortion: "Concrete brick costs less up front but chips more easily in a hard freeze."
  visualDescription: Close b-roll on a grey concrete brick corner showing a small chip/weathering detail, cooler flat light. <<<elementId>>> continues narrating from just off camera.

Segment 4 — order 4, hasCharacter: true, ~8s
  spokenPortion: "If you want texture with a story, reclaimed brick brings both — just budget more time for sourcing it."
  visualDescription: Medium-close, character delivers the payoff line direct to camera, same Loft setting as segment 1 for continuity.
```

## DIY / tutorial style (~30s, 4 segments — article: "Building a backyard fire pit in a weekend")

Full continuous narration:
> "You can build a real backyard fire pit in a weekend, no mason required. Start with a compacted gravel base — it's what keeps the whole ring from shifting after the first frost. Stack your fire-rated block dry first to check the fit before you ever touch mortar. Once it's mortared and cured, you've got a fire pit that'll outlast the patio furniture around it."

```
Segment 1 — order 1, hasCharacter: true, ~9s
  spokenPortion: "You can build a real backyard fire pit in a weekend, no mason required."
  visualDescription: Medium shot, character direct-to-camera in the Loft, confident and casual — the intro/hook.

Segment 2 — order 2, hasCharacter: false, ~6s
  spokenPortion: "Start with a compacted gravel base — it's what keeps the whole ring from shifting after the first frost."
  visualDescription: Close b-roll, hands tamping a gravel base into a circular outline, overhead-ish angle. <<<elementId>>> continues narrating from just off camera.

Segment 3 — order 3, hasCharacter: false, ~6s
  spokenPortion: "Stack your fire-rated block dry first to check the fit before you ever touch mortar."
  visualDescription: Close b-roll, fire-rated blocks being dry-stacked in a ring, natural daylight. <<<elementId>>> continues narrating from just off camera.

Segment 4 — order 4, hasCharacter: true, ~9s
  spokenPortion: "Once it's mortared and cured, you've got a fire pit that'll outlast the patio furniture around it."
  visualDescription: Medium-close, character delivers the payoff line direct to camera, same Loft setting as segment 1.
```

## Listicle style (~28s, 4 segments — article: "3 cooling paint colors for a south-facing room")

Full continuous narration:
> "Three paint colors that actually cool down a south-facing room. First: a chalky pale blue — it reads calm and pulls the eye away from the heat of direct sun. Second: soft sage green, close enough to blue-green to feel cooler than it measures on a swatch. Third, and the boldest of the three: a true dove grey with a blue undertone, especially at midday. Any of these will make a hot room feel a few degrees calmer."

```
Segment 1 — order 1, hasCharacter: true, ~8s
  spokenPortion: "Three paint colors that actually cool down a south-facing room."
  visualDescription: Medium shot, character direct-to-camera in the Loft — sets up the list.

Segment 2 — order 2, hasCharacter: false, ~5s
  spokenPortion: "First: a chalky pale blue — it reads calm and pulls the eye away from the heat of direct sun."
  visualDescription: Close b-roll on a pale blue painted wall swatch in soft daylight. <<<elementId>>> continues narrating from just off camera.

Segment 3 — order 3, hasCharacter: false, ~5s
  spokenPortion: "Second: soft sage green, close enough to blue-green to feel cooler than it measures on a swatch."
  visualDescription: Close b-roll on a sage green painted wall swatch, similar lighting. <<<elementId>>> continues narrating from just off camera.

Segment 4 — order 4, hasCharacter: false, ~5s
  spokenPortion: "Third, and the boldest of the three: a true dove grey with a blue undertone, especially at midday."
  visualDescription: Close b-roll on a dove grey painted wall swatch, brighter midday-toned light. <<<elementId>>> continues narrating from just off camera.

Segment 5 — order 5, hasCharacter: true, ~5s
  spokenPortion: "Any of these will make a hot room feel a few degrees calmer."
  visualDescription: Medium-close, character delivers the closing line direct to camera, same Loft setting as segment 1.
```

## Testimonial style (~20s, 2 segments — avatar-forward, minimal b-roll)

Full continuous narration:
> "I get asked constantly whether it's worth resealing a deck every year — honestly, it depends more on sun exposure than most people think. A deck that gets full afternoon sun needs it annually; one that's mostly shaded can often go two years without visible damage."

```
Segment 1 — order 1, hasCharacter: true, ~11s
  spokenPortion: "I get asked constantly whether it's worth resealing a deck every year — honestly, it depends more on sun exposure than most people think."
  visualDescription: Medium shot, character direct-to-camera in the Loft, conversational and direct — testimonial format is avatar-forward throughout, minimal cutaways.

Segment 2 — order 2, hasCharacter: true, ~9s
  spokenPortion: "A deck that gets full afternoon sun needs it annually; one that's mostly shaded can often go two years without visible damage."
  visualDescription: Slight reframe (push-in or angle change) on the same character/setting, delivering the payoff detail direct to camera.
```
