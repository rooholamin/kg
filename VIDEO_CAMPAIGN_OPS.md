# Video Campaign Pipeline — Ops Setup Checklist

One-time setup to get the Video Campaign feature from "code merged" to "first campaign runs." Do these in order.

## 1. Environment variables

Add to `.env` (production) and your local `.env`:

```bash
HIGGSFIELD_KEY_ID=your_higgsfield_key_id
HIGGSFIELD_KEY_SECRET=your_higgsfield_key_secret
```

Get these from your Higgsfield account (server-side API credentials, **not** the CLI's interactive `higgsfield login` — that flow issues short-lived tokens meant for local/CI use and isn't suitable for a long-running server process). See [`services/higgsfield.service.js`](services/higgsfield.service.js) for how they're used.

`ANTHROPIC_API_KEY` and `BUFFER_ACCESS_TOKEN` are already set for the Social pipeline and are reused as-is — no new Anthropic or Buffer secrets are needed.

## 2. Create the two Managed Agents

Two agent config files are at the project root, ready to hand to the Anthropic Console (or the `ant beta:agents create` CLI):

- [`video-approval-agent.yaml`](video-approval-agent.yaml) — selects which articles get a video each cycle.
- [`video-director-agent.yaml`](video-director-agent.yaml) — writes the script and directs the shoot per approved article. References a skill by ID that doesn't exist yet — see step 3 before creating this one.

For each: create the agent, then create a matching **environment** (a `cloud` sandbox is fine — the director agent's tools are all custom/client-executed, so it doesn't need network access or installed packages). Record all four IDs.

## 3. Upload the Director Agent's skill

The skill bundle lives at [`video-director-skill/`](video-director-skill/) (`SKILL.md` + `content-filter-reference.md` + `ad-shot-structures.md`).

```bash
ant beta:skills create --file video-director-skill/SKILL.md --file video-director-skill/content-filter-reference.md --file video-director-skill/ad-shot-structures.md
# or zip the folder and upload as a single file — see Skills docs
```

Paste the returned `skill_*` ID into `video-director-agent.yaml`'s `skills[0].skill_id` field before creating the director agent in step 2 (or update the agent afterward to attach it).

## 4. Record agent/environment IDs in the app

Go to **Video → Settings** (`/dashboard/video/settings`) and paste in:
- Approval Agent ID + Environment ID
- Director Agent ID + Environment ID

Also review the production defaults there (duration, aspect ratio, genre, max videos per cycle, max generations per video) and the publishing channels toggle (which Buffer channels — reusing Social's existing channel IDs — every video fans out to).

## 5. Train a Soul Character per section

Go to **Video → Characters** (`/dashboard/video/characters`). Every section needs:
- An existing `characterImage` (already set for the WordPress author persona — reused here), and/or extra reference shots in `videoRefImageUrls`.
- An outfit description (free text, used in the director's prompts).

Click **Train Character** per section. This calls Higgsfield's Soul Character training (`createCharacter` in [`services/higgsfield.service.js`](services/higgsfield.service.js)) and stores the returned ID on `Section.videoCharacterId`. Training takes a few minutes. A campaign can't produce a video for a section that hasn't been trained yet — `runVideoApproval` filters those articles out automatically.

## 6. Write the KG Media Loft descriptor

Go to **Video → Environment** (`/dashboard/video/environment`) and write the shared studio's text descriptor — architecture, texture, scale, atmosphere, light, colour, mood (7-point structure, same pattern as `env-descriptors.md` in the `Universal AI Cinematic Automation` reference folder). This is injected as **text** into every director session, never as an image reference (image refs of a location bleed their exact composition into the output).

An optional reference image URL can be attached for human eyeballing only — it is never passed to the agent as a generation ref.

## 7. Confirm Buffer's video-asset schema

`services/buffer.service.js`'s `scheduleVideoPost()` sends a `{ video: { url } }` asset and, for Instagram, `metadata.instagram.type: 'reel'`. These follow the same pattern as the existing image/PDF asset handling but haven't been exercised against a real video post yet — before running a real campaign, fire one test video through **Video → [a test campaign] → Send to Buffer** and check the raw request/response in that post's run log (`Run Log` panel on the campaign detail page) against Buffer's current GraphQL schema. Adjust the asset/metadata shape in `scheduleVideoPost` if Buffer's API has moved since this was written.

## 8. Confirm the Higgsfield generation endpoint

`services/higgsfield.service.js` defaults to Higgsfield's own `dop-standard` model (`/v1/image2video/dop`) for video and `/v1/text2image/soul` for stills. If your account's plan surfaces a different model (Seedance, Kling, etc.) that you'd rather direct with, override via env vars — no code changes needed:

```bash
HIGGSFIELD_IMAGE_ENDPOINT=/v1/text2image/soul
HIGGSFIELD_VIDEO_ENDPOINT=/v1/image2video/dop
```

## 9. Run a first campaign

Once steps 1–6 are done for at least one section: **Video → New Campaign**, pick a short cycle window, leave the brief blank the first time, and watch the run log. Expect:

1. `approval_*` steps — the Approval Agent picks articles.
2. `director_session` / `director_ai_send` / `tool_generate_image` / `tool_generate_video` / `tool_get_generation_status` — the Director Agent scripting and shooting one video.
3. `export_start` — the finished still/video re-uploaded to DigitalOcean Spaces.
4. If Review Mode is on (default), the campaign lands in **reviewing** — check the video, then **Schedule All** or schedule individually.

## Ongoing: the content-filter learning loop

`VideoPromptLearning` rows (`/api/video/prompt-learnings`) are the DB-backed equivalent of the reference folder's `seedance-failures.md` — the last 10 are injected into every new director session automatically. Add an entry whenever a generation fails with `nsfw`/`ip_detected` and you find the safe rewrite, so future sessions avoid the same trigger without needing to re-upload the skill.
