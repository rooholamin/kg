# Example Multi-Shot Sequences

Reference sequences to adapt, not templates to fill in blindly — always ground the actual beats in the article being covered. These are for the silent `seedance_2_0` base video (production chain step 2); the narration audio and lip-sync happen separately afterward, but write the shots as if the character is speaking throughout — lip-sync needs a face to animate, so keep the character on-screen and reasonably front-facing for most of the runtime, even in shots built around a prop or detail.

## Market/data story (~15s, 3 shots)

```
00:00-00:05: Medium, static. Character faces camera in the KG Media Loft, morning
light across the room — this is where the narration's opening line lands.
00:05-00:11: Medium-close, slow push-in. Character stays on camera as the
narration gets to the specific stat/finding — the push-in tracks the emphasis.
00:11-00:15: Close, static. Character delivers the closing line direct to
camera, measured and confident.
```

## Design/reveal story (~15s, 3 shots)

```
00:00-00:05: Medium, static. Character direct-to-camera, one hand gesturing
toward a material/texture detail relevant to the article as the narration
introduces it — the detail is present in frame with the character, not an
isolated cutaway.
00:05-00:11: Medium-close, slow reveal (rack focus or gentle pan) as the
narration gets specific about the technique/material — character stays
visible and speaking throughout.
00:11-00:15: Close on the character delivering the payoff line, direct to
camera.
```

## Explainer/how-to story (~15s, 3 shots)

```
00:00-00:05: Medium, static. Character direct-to-camera intro line, establishing
what the viewer is about to learn.
00:05-00:11: Medium-close, slight handheld drift. Character stays on camera
while gesturing toward a chart/model/prop relevant to the article, still
speaking.
00:11-00:15: Close, static. Character delivers the payoff line, direct to
camera.
```

No `[SFX:]` block in any of these — the base video's own audio is discarded (`generate_audio: false`); the only audio in the final output is the lip-synced narration track (see SKILL.md's Production chain).
