# Content Filter Reference

Known trigger phrases/patterns and their safe replacements. Append new entries here as they're discovered — this file is re-uploaded with the skill when it changes. Fast-moving discoveries (specific to one recent campaign) should instead be logged as `VideoPromptLearning` rows in the app, which are injected into the session dynamically without needing a skill re-upload.

## Status types

| Status | Meaning |
|---|---|
| `nsfw` | Content safety filter triggered — prompt or reference image flagged |
| `ip_detected` | Brand / product / camera-model name detected in prompt text |

## Known `nsfw` triggers

| Trigger phrase / element | Why it flags | Safe alternative |
|---|---|---|
| `"breathes in"` near steam / fog / vapour | Reads as drug inhalation | `"stands still in the mist"` / `"holds"` |
| `"grabs [someone's] arm/forearm"` | Physical contact read as assault | `"extends a hand"` / describe the other party's own independent action instead |
| `"hauling themselves/upward"` | Physical-struggle language | `"reaching the top"` / `"driving upward"` |
| Two characters in close physical proximity | Contact/proximity detection | Describe each one's own independent action; keep them spatially separate in the prompt |

## Known `ip_detected` triggers

| Trigger | Why it flags | Safe alternative |
|---|---|---|
| `"Arri Alexa 65"` | Camera brand name | `"large-format cinema camera"` |
| `"Kodak Vision3 500T"` | Film stock brand | `"cinematic film stock"` / `"fine grain film"` |
| `"Ilford HP5"` | Film stock brand | `"black and white film grain"` |
| Real estate brand/company names in the article | Third-party brand mention | Describe generically (e.g. "a national brokerage") unless the article's own subject requires naming it factually |

## General rules

- Retry once, unchanged, before rewriting — some flags are transient.
- If a prompt fails twice unchanged, isolate one variable: rewrite the suspect phrase first, then try a different genre, then (last resort) regenerate the start-frame still.
- Genre matters: `drama` flags more often than `epic`/`action` on intimate or atmospheric beats.
