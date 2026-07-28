# Video Campaign Pipeline — Ops Setup Checklist

One-time setup to get the Video Campaign feature from "code merged" to "first campaign runs." Do these in order.

The pipeline is directed via **Higgsfield's hosted MCP server** (`mcp.higgsfield.ai`), not Higgsfield's Developer/Partner REST API — this is what actually unlocks Seedance 2.0 (multi-shot, native audio) and Kling 3.0, which the REST API's account plan doesn't expose. There is no Higgsfield API key in this app; authentication is a single OAuth credential stored in an **Anthropic Vault** and referenced by every session that talks to Higgsfield.

## 1. Environment variables

No Higgsfield secrets are needed. `ANTHROPIC_API_KEY` and `BUFFER_ACCESS_TOKEN` are already set for the Social pipeline and are reused as-is.

## 2. Authorize Higgsfield MCP and create a Vault

In the Anthropic Console, connect the `https://mcp.higgsfield.ai/mcp` MCP server via OAuth (this is an interactive, one-time authorization — sign in with the Higgsfield account whose credits/plan you want the pipeline to use) and save the resulting credential as a **Vault**. Record the Vault ID (`vlt_...`) — it goes into Video → Settings in step 4.

## 3. Create the three Managed Agents

Three agent config files are at the project root, ready to hand to the Anthropic Console (or the `ant beta:agents create` CLI):

- [`video-approval-agent.yaml`](video-approval-agent.yaml) — selects which articles get a video each cycle. No MCP server, no vault needed.
- [`video-director-agent.yaml`](video-director-agent.yaml) — writes the script and directs the shoot per approved article via Higgsfield MCP (`generate_image`/`generate_video`/`job_status`/`models_explore`). References a skill by ID — see step 5 before creating this one. Needs the vault from step 2 on every session.
- [`video-character-admin-agent.yaml`](video-character-admin-agent.yaml) — admin-only, one-off sessions that create a Higgsfield Reference Element per section (`media_import_url` + `show_reference_elements`). Also needs the vault from step 2.

For each: create the agent, then create a matching **environment**. Record all six IDs (agent + environment per agent).

## 4. Record agent/environment/vault IDs in the app

Go to **Video → Settings** (`/dashboard/video/settings`) and paste in:
- Approval Agent ID + Environment ID
- Director Agent ID + Environment ID
- Character Admin Agent ID + Environment ID
- Higgsfield Vault ID (used by both the Director and Character Admin agents)

Also review the production defaults there (duration — capped at 15s per generation call, aspect ratio, genre, max videos per cycle) and the publishing channels toggle (which Buffer channels — reusing Social's existing channel IDs — every video fans out to).

## 5. Upload the Director Agent's skill

The skill bundle lives at [`video-director-skill/`](video-director-skill/) (`SKILL.md` + `content-filter-reference.md` + `ad-shot-structures.md`).

```bash
ant beta:skills create --file video-director-skill/SKILL.md --file video-director-skill/content-filter-reference.md --file video-director-skill/ad-shot-structures.md
# or zip the folder and upload as a single file — see Skills docs
```

Paste the returned `skill_*` ID into `video-director-agent.yaml`'s `skills[0].skill_id` field before creating the director agent in step 3 (or update the agent afterward to attach it).

## 6. Create a Reference Element per section

Go to **Video → Characters** (`/dashboard/video/characters`). Every section needs:
- An existing `characterImage` (already set for the WordPress author persona — reused here), and/or extra reference shots in `videoRefImageUrls`.
- An outfit description (free text, used in the director's prompts).

Click **Create Character**. This runs the Character Admin Agent (`createReferenceElement` in [`services/video-ai.service.js`](services/video-ai.service.js)), which imports the reference images and creates a Higgsfield Reference Element — the whole call is synchronous, so the button resolves once the element actually exists, no polling needed. The resulting element ID is stored on `Section.videoCharacterId` and embedded as a `<<<elementId>>>` placeholder inside the director agent's prompts. A campaign can't produce a video for a section without one — `runVideoApproval` filters those articles out automatically.

## 7. Write the KG Media Loft descriptor

Go to **Video → Environment** (`/dashboard/video/environment`) and write the shared studio's text descriptor — architecture, texture, scale, atmosphere, light, colour, mood (7-point structure, same pattern as `env-descriptors.md` in the `Universal AI Cinematic Automation` reference folder). This is injected as **text** into every director session, never as an image reference (image refs of a location bleed their exact composition into the output).

An optional reference image URL can be attached for human eyeballing only — it is never passed to the agent as a generation ref.

## 8. Confirm Buffer's video-asset schema

`services/buffer.service.js`'s `scheduleVideoPost()` sends a `{ video: { url } }` asset and, for Instagram, `metadata.instagram.type: 'reel'`. These follow the same pattern as the existing image/PDF asset handling but haven't been exercised against a real video post yet — before running a real campaign, fire one test video through **Video → [a test campaign] → Send to Buffer** and check the raw request/response in that post's run log (`Run Log` panel on the campaign detail page) against Buffer's current GraphQL schema. Adjust the asset/metadata shape in `scheduleVideoPost` if Buffer's API has moved since this was written.

## 9. Run a first campaign

Once steps 1–7 are done for at least one section: **Video → New Campaign**, pick a short cycle window, leave the brief blank the first time, and watch the run log. Expect:

1. `approval_*` steps — the Approval Agent picks articles.
2. `director_session` / `director_ai_send` — the Director Agent scripting and shooting one video via Higgsfield MCP (its `generate_image`/`generate_video`/`job_status` calls happen server-side on Anthropic's end and won't show up as separate `tool_*` log rows the way the old custom-tool flow did).
3. `export_start` — the finished still/video re-uploaded to DigitalOcean Spaces.
4. If Review Mode is on (default), the campaign lands in **reviewing** — check the video, then **Schedule All** or schedule individually.

## Ongoing: the content-filter learning loop

`VideoPromptLearning` rows (`/api/video/prompt-learnings`) are the DB-backed equivalent of the reference folder's `seedance-failures.md` — the last 10 are injected into every new director session automatically. Add an entry whenever a generation fails with `nsfw`/`ip_detected` and you find the safe rewrite, so future sessions avoid the same trigger without needing to re-upload the skill.
