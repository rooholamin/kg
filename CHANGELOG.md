# Changelog

## [1.3.0] — Roles, Access Control & User Management — 2026-06-08

### Added

- **3 editorial roles** — `superadmin` (owner, full access), `admin` (settings, engines, taxonomy), `editor` (articles, approvals); seeded via `prisma/data/roles.js` + migration `20260608250000_editorial_roles`.
- **`roleSlug` in JWT/session** — `auth-options.js` now stores `token.roleSlug = role?.slug` alongside `roleName`; exposed as `session.user.roleSlug` for all slug-based checks.
- **`lib/require-role.js`** — replaces `lib/require-admin.js`; `requireRole(session, ...allowedSlugs)` throws `FORBIDDEN` if the session role is not in the allowed list.
- **API route guards** added to:
  - Pipeline engine start/pause/settings/unstick → `superadmin`, `admin`
  - Sections, categories, topics POST/PUT/DELETE → `superadmin`, `admin`
  - Articles POST/PUT/DELETE and approval/decision → `superadmin`, `admin`, `editor`
  - User-management users PUT/DELETE → `superadmin` only
- **Approval attribution** — `approvedById`, `approvedAt`, `rejectedById`, `rejectedAt` fields added to `Article` model. Migration `20260608260000_article_approval_attribution`. `approveArticle`/`rejectArticle` services now set these fields; both article GET endpoints include them.
- **Approvals page — live history tabs** — Approved and Rejected tabs now fetch real data (`?approvedBy=set` / `?rejectedBy=set`); resolve actor names from the users select API; show "Approved/Rejected by X · date" on each card with counts in tab badges.
- **Users page** (`/dashboard/users`) — fully replaced mock with real data: live user list from `/api/user-management/users`, role stats cards, role badge per user, last sign-in column. Superadmin sees a "Change role" action per row (dialog, uses `PUT /api/user-management/users/[id]`).
- **Public signup disabled** — `POST /api/auth/signup` now returns `403` immediately. `/signup` page replaced with a static "Registration is closed — contact an administrator" screen.
- **Fake seed users removed** — `prisma/data/users.js` emptied; 49 `@example.com` demo users and their system logs deleted from both local and production databases.

### Changed

- All existing `requireAdmin` callers (project-progress, idea-backlog routes) updated to `requireRole(session, 'superadmin', 'admin')`.
- `useIsAdmin()` hooks in project-progress and idea-backlog UI components updated to use `roleSlug` comparison instead of display-name string.
- `prisma/seed.js` — owner user now gets `superadmin` role; fake user seeding loop and system log generation block removed.

---

## [1.2.0] — WordPress Publishing Integration — 2026-06-08

### Added

- **WordPress credentials on `Section`** — `wpSiteUrl`, `wpUsername`, `wpAppPassword`, `wpAuthorId` fields; each section can publish as a different WordPress author/persona.
- **`wpCategoryId` on `Category` and `Topic`** — stores the matching WordPress category ID after sync; applied directly via `prisma db execute`.
- **`services/wordpress.service.js`** — centralised WordPress REST API service:
  - `syncCategoryToWordPress(categoryId)` — creates or links a top-level WP category; idempotent (search-then-create).
  - `syncTopicToWordPress(topicId)` — creates or links a WP child category under the parent; requires parent category to be synced first.
  - `publishArticleToWordPress(articleId)` — converts TipTap JSON to HTML, sets WP post status to `future` or `publish` based on `publishDate`, attaches category/topic WP IDs and author; saves `wordpressPostId`; on failure logs error and leaves status as `scheduling` for retry.
  - `contentToHtml` / `nodesToHtml` — server-side TipTap JSON → HTML converter (no DOM, safe in Next.js route handlers).
- **`POST /api/articles/[id]/approval/decision`** — approve or reject an article; approve advances status to `scheduling` and fire-and-forgets `publishArticleToWordPress`.
- **`POST /api/articles/[id]/wordpress/publish`** — manual retry endpoint for WordPress publishing.
- **`POST /api/categories/wordpress/sync-all`** — bulk-syncs all unsynced (`wpCategoryId: null`) active categories; returns `{ synced, skipped, errors }` summary.
- **`POST /api/topics/wordpress/sync-all`** — bulk-syncs all unsynced active topics; skips topics whose parent category is not yet synced.
- **WordPress credentials tab in section form** — "WordPress Integration" section in `section-form-dialog.jsx` with Site URL, Username, Application Password, and WP Author ID fields; validated via Zod (`section-schema.js`).
- **WP Sync column on categories and topics list pages** — shows the WordPress category ID or `—` for unsynced items.
- **"Sync to WordPress" toolbar button** on categories and topics list pages — bulk-syncs unsynced items; shows count of pending items and a spinner during sync; placed via the new `secondaryAction` prop on `MockTableToolbar`.

### Changed

- **`approveArticle` / `rejectArticle`** added to `services/article-automation.service.js` — approve sets status to `scheduling`; reject sets status back to `writing`.
- **`app/(protected)/dashboard/approvals/page.jsx`** — fully rewritten from mock data to live queue:
  - Fetches articles with `status=approval` via TanStack Query.
  - `ArticleApprovalCard` — card layout with proper `p-5` padding (no `CardHeader`), title, category badge, publish date, SEO score, summary, and Open / Edit / Approve / Reject actions.
  - `ArticlePreviewModal` — wide (`max-w-5xl`) scrollable dialog; featured image shown as a hero with title and meta overlaid via gradient; falls back to plain text header when no image; summary shown as lead text above article body.
- **`app/(protected)/dashboard/components/mock-table-toolbar.jsx`** — added `secondaryAction` prop for consistent secondary button placement.
- **`app/api/categories/route.js`** and **`app/api/topics/route.js`** — `GET` responses now include `wpCategoryId`.
- **`app/api/sections/[id]/route.js`** — `GET` and `PUT` include all four WordPress credential fields.

---

## [1.1.0] — Three-Engine Pipeline (Research / Writing / Images) — 2026-06-08

### Added

- **3 independent pipeline engines** — `research`, `writing`, `images` — each runs its own fire-and-forget processing loop targeting only its slice of the article pipeline (`planning/research` → `writing` → `assets`).
- **`PipelineEngine.delayMinutes`** — configurable rate-limit delay between jobs per engine (0 = no delay, max 1440 min); saved to DB and respected by `setTimeout`-based chaining.
- **`PipelineEngine.lastJobCompletedAt`** — timestamp of last completed job; used to compute remaining rate-limit wait after a server restart.
- **`PipelineEngineLog.engineId`** — which engine produced each log entry (`research | writing | images | null` for legacy rows).
- **`updateEngineSettings(engineId, { delayMinutes })`** — new service function; exposed via `PATCH /api/pipeline-engine/[type]/settings`.
- **`PATCH /api/pipeline-engine/[type]/settings`** — update per-engine rate limit.
- **`POST /api/pipeline-engine/[type]/start`** — start a specific engine (replaces generic `/start`).
- **`POST /api/pipeline-engine/[type]/pause`** — pause a specific engine (replaces generic `/pause`).
- **Always-on polling** — when a queue is empty, the engine stays `running` and re-checks every 60 s instead of going idle; new `isWaiting` flag surfaced in status.
- **`EngineCard` component** — per-engine card with status badge, current article, live countdown ("Next job in Xm Ys"), rate-limit input, processed/failed stats, and start/pause controls.
- **Migration `20260608235900_pipeline_engine_multi`** — adds `delayMinutes`, `lastJobCompletedAt`, `engineId`; seeds `research / writing / images` rows; removes `singleton`.

### Changed

- **`getEngineStatus()`** — now returns `{ engines: { research, writing, images }, ... }` with `isStalled`, `isWaiting`, `nextRunMs` enriched per engine; combined queue and stage counts still included.
- **`startEngine(engineId)`** — clears `currentArticleId` on every start so stale claims from previous sessions never block the new chain.
- **`processNext`** — chain is now bulletproof: claim-release update runs first (unconditionally); log creation and `lastJobCompletedAt` update are fire-and-forget so a Prisma client mismatch can't silently kill the chain.
- **`EngineDashboard`** — redesigned around 3 engine cards; `EditorInChief` character reflects the most active running step; stage breakdown shows queue per engine type.
- **`config/menu.config.jsx`** — "Editor in Chief" nav entry moved under Planning.

### Removed

- **`app/api/pipeline-engine/start/route.js`** and **`app/api/pipeline-engine/pause/route.js`** — replaced by `[type]/start` and `[type]/pause` dynamic routes.

---

## [1.0.0] — Single Pipeline Engine ("Editor in Chief") — 2026-06-08

### Added

- **`PipelineEngine` + `PipelineEngineLog` Prisma models** — singleton engine state row and per-article processing history. Migration: `prisma/migrations/20260608220000_pipeline_engine/migration.sql`.
- **`PipelineEngineStatus` enum** — `idle | running | paused`.
- **`services/pipeline-engine.service.js`** — `getEngineStatus`, `startEngine`, `pauseEngine`, `processNext` (fire-and-forget chain), `processArticle` (research → writing → assets), `cleanupStaleState` (resets orphaned `generating` assets and `running` automation runs on startup), stall detection (`isStalled` after 15 min without `updatedAt` change), per-session `skippedArticleIds` set.
- **`GET /api/pipeline-engine`**, **`POST /api/pipeline-engine/start`**, **`POST /api/pipeline-engine/pause`**, **`GET /api/pipeline-engine/history`**, **`POST /api/pipeline-engine/unstick`**.
- **`/dashboard/pipeline-engine`** — "Editor in Chief" dashboard with animated character (`EditorInChief`), pipeline node progress (`PipelineProgress`), queue list (`QueueList`), completed list (`CompletedList`), stage breakdown by article status, stall warning banner.
- **`config/menu.config.jsx`** — "Editor in Chief" entry added under Planning with `Cpu` icon.

---

## [0.9.0] — Content Taxonomy Rebuild (Excel Import) — 2026-05-25

### Changed

- **Full category + topic replacement** — all previous categories and topics removed from the database and replaced with 70 categories and 700 topics sourced from `KGHub Categories.xlsx`.
- **`prisma/data/kg-sections-content.js`** — new auto-generated data file (do not hand-edit); 10 categories per section × 7 sections = 70 categories; 10 topics per category × 70 = 700 topics; all records carry stable deterministic UUIDs in the `30000000-*` and `40000000-*` ranges.
- **`prisma/seed.js`** — seed now deletes all topics and categories before re-inserting from `kg-sections-content.js`, ensuring a clean slate on every run; old magazine-content and kg-content category/topic blocks removed.

### Seed structure (per section)

| Section | Categories |
|---|---|
| KG Living | Smart Home Living, Luxury Lifestyle, Wellness at Home, Comfort Engineering, Future Living, Home Entertainment, Family Living, Lifestyle Technology, Outdoor Living, Hospitality-Inspired Living |
| KG Build | Construction Materials, Structural Systems, Building Methods, Construction Technology, Interior Construction, Exterior Construction, Mechanical & Electrical, Construction Management, Specialized Construction, Future Building Systems |
| KG Data | Real Estate Analytics, Artificial Intelligence, Smart Property Data, PropTech, Visualization & Dashboards, Urban Intelligence, Construction Intelligence, Consumer & Lifestyle Data, Financial Intelligence, Future Intelligence Systems |
| KG Design | Architecture Styles, Interior Design, Materials & Finishes, Lighting Design, Landscape Design, Furniture & Decor, Spatial Design, Design Innovation, Luxury Aesthetics, Visual Identity in Design |
| KG Eco | Green Building, Renewable Energy, Water Sustainability, Sustainable Materials, Energy Efficiency, Sustainable Communities, Climate Resilience, Waste Reduction, Clean Technology, Future Sustainability |
| KG Develop | Land Development, Urban Planning, Housing Development, Infrastructure Development, Project Strategy, Mega Developments, Development Economics, Regulations & Governance, Future Cities, Global Development Vision |
| KG Invest | Investment Strategies, Market Analysis, ROI Optimization, Financing, Luxury Real Estate, Development Investments, Risk Management, Real Estate Economics, Investor Intelligence, Wealth & Lifestyle Investing |

---

## [0.8.0] — Milestone 7 Logs, Versions, Attempts + Sections + Idea Backlog — 2026-05-06

### Added

- **`ArticleVersion` model** — snapshot of article body before each update (`title`, `summary`, `content`, `versionLabel`, `createdBy`); cascades on article delete. Migration: `prisma/migrations/20260502120000_milestone_7_logs_versions_attempts/migration.sql`.
- **`AIAttempt` model** — records every AI generation call (`articleId?`, `prompt`, `result`, `model`, `status: success | failed`); indexes on `articleId`, `status`, `createdAt`. Same migration as above.
- **`ContentLog` columns** — `action` (create | update | delete | archive | status_change), `metadata` (JSON), `createdBy`; `type` index added. Same migration.
- **`GET /api/articles/[id]/versions`** — lists all versions for an article; session-protected.
- **`GET /api/ai-attempts`** + **`POST /api/ai-attempts`** — list and record AI generation attempts; session-protected.
- **`GET /api/logs`** + **`GET /api/logs/[entityType]`** — filterable content-log queries; session-protected.
- **`Section` model** — top-level content taxonomy node (`name`, `slug`, `description`, `summary`, `icon`, `status`, `characterName`, `characterBiography`, `characterPersona`, `characterImage`). Migration: `prisma/migrations/20260525120000_milestone_sections/migration.sql`. `Category.sectionId` FK added with `SET NULL` on delete.
- **`services/section.service.js`** — `getSections`, `getSectionById`, `createSection`, `updateSection`, `archiveOrDeleteSection` (archive if has categories, hard delete otherwise), slug auto-generation, `ContentLog` on every mutation.
- **`services/ai-attempt.service.js`** — `createAttempt`, `getAttempts` (filterable by `articleId`), `deleteAttempt`.
- **Sections CRUD** — full UI at `/dashboard/sections`: `sections-table.jsx`, `section-form-dialog.jsx`, `section-archive-dialog.jsx`, `section-detail-actions.jsx`, detail page at `/dashboard/sections/[id]`.
- **`/api/sections`** + **`/api/sections/[id]`** — `GET`, `POST`, `PUT`, `DELETE`; session-protected; admin gate on writes.
- **`IdeaBacklog` model** — `title`, `description`, `priority (low | medium | high)`, `status (new | under_consideration | accepted | rejected | parked)`, `tags[]`. Migration: `prisma/migrations/20260506120000_idea_backlog/migration.sql`.
- **`services/idea-backlog.service.js`** — `getIdeas`, `getIdeaById`, `createIdea`, `updateIdea`, `deleteIdea`; input normalisation, `ContentLog` on mutations.
- **`/api/idea-backlog`** + **`/api/idea-backlog/[id]`** — `GET`, `POST`, `PUT`, `DELETE`; admin gate on writes.
- **Idea backlog UI** — `/dashboard/idea-backlog` with `idea-backlog-content.jsx`.
- **Row-level security** — enabled on all tables. Migration: `prisma/migrations/20260506180000_enable_row_level_security/migration.sql`.
- **`/dashboard/logs/attempts`** — dedicated layout (`layout.jsx`) for the AI attempts log view; `page.jsx` updated to use real API data.

### Changed

- **`/dashboard/logs/page.jsx`** — now queries `/api/logs` for real `ContentLog` data with entity-type and date filters.
- **`services/content-log.service.js`** — extended with `getLogs` (pagination, entity-type filter, date range) to support the logs API.

---

## [0.6.0] — Milestone 6 Editorial Calendar + Readiness — 2026-05-02

### Added

- **`computeReadiness` + `getCalendarArticles`** in [`services/article.service.js`](./services/article.service.js) — derives `ok | warning | risk | null` from pipeline status and `readinessDeadline` (7-day rule vs publish date).
- **`GET /api/calendar`** — [`app/api/calendar/route.js`](./app/api/calendar/route.js); session-protected; optional `topicId`, `categoryId`, `status` query params; returns articles with `readinessStatus`, `topic`, and `category` for the calendar UI.
- **`EventCalendar` `onEventClick`** — [`components/custom/calendar/event-calendar.jsx`](./components/custom/calendar/event-calendar.jsx); when set and the event has `articleId`, invokes the callback instead of opening the edit dialog.

### Changed

- **[`lib/calendar-article-events.js`](./lib/calendar-article-events.js)** — Publish events use readiness-based colors (`emerald` / `amber` / `rose` / `violet`); readiness deadline events use `sky`, title prefix `⚑ Deadline:`, and `eventKind` / `readinessStatus` on events for filtering.
- **[`/dashboard/calendar`](./app/(protected)/dashboard/calendar/components/calendar-module.jsx)** — Loads `/api/calendar`; **At risk** summary card with count; quick filters (risk / warning); sources **All** / **Content** / **Social** (social remains mock); **Upcoming (14 days)** sidebar list with readiness dots; article navigation from calendar and sidebar; Milestone 10 callout for social placeholders.
- **[`prisma/data/project-progress.js`](./prisma/data/project-progress.js)** — Build track: **Project Progress** and **Calendar** milestones at 100%; calendar-related blocker resolved; new progress report `RP(2)` for M6 snapshot. Re-apply with `npm run seed` (or your usual seed command) to refresh DB fixtures.

## [0.5.0] — Milestone 5 Project Progress — 2026-04-25

### Added

- **Project-progress Prisma models** — `ProjectPhase`, `ProjectWorkstream`, `ProjectMilestone`, `ProjectBlocker`, and `ProjectProgressReport` plus enums for phase slug, workstream/milestone status, milestone type, blocker severity/status. Applied via `prisma db push` because migration shadow DB drifted (same drift pattern from earlier milestones).
- **Project-progress seed data** — `prisma/data/project-progress.js` with 2 explicit phases (Build + Automation), a single Build workstream with 10 milestones, 6 detailed Automation workstreams (design → implement in n8n → test → calibrate → stabilize), blockers, and baseline progress reports.
- **Admin authorization helper** — `lib/require-admin.js` blocks write operations unless role is `Administrator` or `Owner`.
- **Service layer** — `services/project-progress.service.js` with full read/write coverage (phases, workstreams, milestones, blockers, reports), auto-rollup recalculation from milestone → workstream → phase, and `ContentLog` writes for all mutations.
- **Validation schemas** — new project-progress Zod schemas under `app/(protected)/dashboard/project-progress/forms/`.
- **API routes** — new `/api/project-progress/*` surface:
  - `GET /api/project-progress` (tree payload for UI)
  - `POST /api/project-progress/phases`, `PUT/DELETE /api/project-progress/phases/[id]`
  - `POST /api/project-progress/workstreams`, `PUT/DELETE /api/project-progress/workstreams/[id]`
  - `POST /api/project-progress/milestones`, `PUT/DELETE /api/project-progress/milestones/[id]`
  - `GET/POST /api/project-progress/blockers`, `PUT/DELETE /api/project-progress/blockers/[id]`
  - `GET/POST /api/project-progress/reports`, `DELETE /api/project-progress/reports/[id]`
  - All writes: session + admin gate; reads: session-protected.

### Changed

- **`/dashboard/project-progress`** now uses real database data and a split-phase UI:
  - Build vs Automation cards with separate progress bars.
  - Phase timeline/Gantt-style chart where Automation visibly extends longer than Build.
  - Workstreams grouped by phase with detailed Automation focus.
  - Milestone table with status/progress editing for admins and type badges (`build` / `automation`).
  - Blockers panel that clearly highlights automation blockers.
  - Reports panel showing build progress, automation progress, and current calibration/testing focus.
- **Role behavior**
  - Admin: create/update/delete milestones, workstreams, blockers, reports.
  - Non-admin users: read-only visibility for the full project-progress dashboard.

### Removed

- Project-progress mock exports (`MOCK_PROJECT_MILESTONES`, `MOCK_WORKSTREAMS`, `MOCK_BLOCKERS`) from `app/(protected)/dashboard/_mock/index.js`, since this module is now fully backend-backed.

## [0.4.0] — Milestone 4 Articles System — 2026-04-24

### Added

- **Prisma `Article` fields** — `summary`, `content` (TipTap JSON), `featuredImage`, `galleryImages` (string array), `videoUrl`, `isEditorsChoice`, `views`, `likes`, `commentsCount`; index on `isEditorsChoice`. Migration SQL: `prisma/migrations/20260424190000_article_rich_content/migration.sql`. Schema synced with `npx prisma db push` as needed.
- **TipTap** — `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-youtube`, `@tiptap/extension-placeholder`.
- **Image upload** — `POST /api/uploads` (session, mime/size caps, `directory` allow-list) using `lib/s3-upload.js` → DigitalOcean Spaces (`STORAGE_*`). UI: `components/custom/image-upload-input.jsx`, `gallery-upload-input.jsx`.
- **Editor & renderer** — `components/custom/rich-text-editor.jsx` (toolbar, image + YouTube), `content-renderer.jsx` (read-only).
- **Article service** — `createArticle`, `updateArticle`, `archiveOrDeleteArticle` (topic/category relation check, 7-day readiness from publish date, `contentLog`); `getArticleContentLogs`.
- **API** — `POST /api/articles`, `PUT` + `DELETE /api/articles/[id]`; expanded `GET` payloads.
- **Forms & UI** — `article-schema.js`, `article-form-dialog.jsx`, `article-archive-dialog.jsx`, `article-detail-actions.jsx`; `articles-table.jsx` (`useQuery`, thumbs, editor’s choice, stats, edit/delete, readiness filter, create).
- **Article detail** — Hero, six tabs (Overview, Content, Pipeline, Social, SEO, Activity with real `ContentLog`); `toYoutubeEmbedUrl` in `lib/utils.js`.
- **Seeds** — 12 Kingsgate articles in `prisma/data/kg-articles.js` + `seed.js` upsert; four magazine articles enriched with body/summary/stats. `next.config.mjs` `images.remotePatterns` for `picsum.photos`.

## [0.3.0] — Milestone 3 Categories & Topics CRUD — 2026-04-24

### Added

- **Kingsgate seed data** — `prisma/data/kg-content.js` (6 home-service categories, 24 topics, fixed UUIDs, mix of `active` / `archived`); upserted in `prisma/seed.js` after magazine content. Idempotent: `npm run seed` or `npx prisma db seed`.
- **`contentLog` service** — `services/content-log.service.js` for content-operation events (separate from `SystemLog`).
- **Category & topic services** — create, update, archive-or-delete with relation checks (category: archive if any topics or articles, else hard delete; topic: archive if any articles, else hard delete), case-insensitive duplicate name checks, `ContentLog` on every change.
- **CRUD API** (session-guarded) — `POST /api/categories`, `PUT` + `DELETE /api/categories/[id]`, `POST /api/topics`, `PUT` + `DELETE /api/topics/[id]`; Zod validation; clear 400/404/409 responses.
- **Forms** — Zod schemas in `app/(protected)/dashboard/categories/forms/` and `.../topics/forms/`; KGHub `Dialog` + React Hook Form + TanStack Query mutations (aligned with user-management pattern).
- **UI** — Create/edit and archive-or-delete (confirmation `AlertDialog`) on categories and topics list and detail pages; `useQuery` for lists; toasts, loading/error/empty states, `router.refresh()` after mutations.

### Changed

- Categories and topics list pages no longer use placeholder sheets or non-persistent create flows; detail pages use real actions instead of disabled “Save” placeholders.

### Unchanged (still mock / future milestones)

- Articles CRUD (M4+); main dashboard AI, calendar, SEO, project progress, approvals, logs content; topic **Readiness** column (M6); **Activity** cards on category/topic detail (M7); Kingsgate business links block (M10).

### Next (Milestone 4)

- Articles CRUD and pipeline integration.

## [0.2.0] — Milestone 2 Backend Foundation — 2026-04-24

### Added

- **Prisma models** — `Category`, `Topic`, `Article` (pipeline `ArticleStatus` enum), `ContentLog`, `Approval`; indexes on common foreign keys. Schema applied to Supabase with `npx prisma db push` (existing DB had migration history drift; avoid `migrate reset` on shared DBs).
- **Service layer** — `services/category.service.js`, `services/topic.service.js`, `services/article.service.js` (all DB access via these; `lib/prisma` unchanged).
- **Read-only API** (session-guarded `GET` only) — `/api/categories`, `/api/categories/[id]`, `/api/topics`, `/api/topics/[id]`, `/api/articles`, `/api/articles/[id]`.
- **Magazine seed data** — `prisma/data/magazine-content.js` + `prisma/seed.js` upserts categories, topics, articles, `ContentLog`, and `Approval` (fixed UUIDs, idempotent). Run `npm run seed` or `npx prisma db seed`.
- **Dashboard data** — categories, topics, and articles list pages fetch from API with loading, error, and empty states. Detail pages for category/topic/article load from services; article detail falls back to mock for legacy `art-*` ids.

### Unchanged (still mock-backed)

- Main dashboard, AI, calendar, SEO, logs, project progress, approvals; `PIPELINE_STAGES` import on articles list for filter labels.

## [0.1.0] — Milestone 1 UI Shell — 2026-04-24

### Added

#### Dashboard Pages
- **Main Dashboard** (`/dashboard`) — home overview with summary stats and project-level metrics
- **AI Command Center** (`/dashboard/ai`) — natural-language control surface with chat threads, sidebar, and mock message flow; full logic ships in Milestone 9
- **Articles** (`/dashboard/articles`) — list view with pipeline-stage and readiness badges; article detail view with mock data; real persistence in Milestone 4
- **Categories** (`/dashboard/categories`) — table listing broad content areas; CRUD in Milestone 3
- **Topics** (`/dashboard/topics`) — table of subjects within categories; CRUD in Milestone 3
- **Editorial Calendar** (`/dashboard/calendar`) — full custom event calendar with month, week, day, and agenda views; drag-and-drop event rescheduling via `@dnd-kit`
- **Project Progress** (`/dashboard/project-progress`) — milestone progress bars, workstream Gantt view, and blocker list backed by mock data
- **SEO & Linking** (`/dashboard/seo`) — internal linking overview and per-article SEO stats; rule engine in Milestone 10
- **Logs** (`/dashboard/logs`) — filterable activity log table with type, actor, and target columns
- **AI Attempts** (`/dashboard/logs/attempts`) — dedicated log view for AI generation events with status and token counts
- **Approvals** (`/dashboard/approvals`) — tabbed queue (Pending / Approved / Rejected) with risk badges, reviewer notes, and approve/reject actions; real workflow in Milestone 5
- **Users & Roles** (`/dashboard/users`) — paginated team roster with role and status badges; RBAC in Milestone 2
- **Settings** (`/dashboard/settings`) — content rules and notification preference placeholders; persistence in Milestone 2
- **Integrations** (`/dashboard/settings/integrations`) — connected-service cards (WordPress, Ahrefs, OpenAI, etc.); live connections in Milestone 7

#### Custom Components (`components/custom/`)
- **`EventCalendar`** — full-featured drag-and-drop calendar built on `@dnd-kit/core`; supports month, week, day, and agenda views with current-time indicator, event visibility hooks, event dialog, and overflow popup
- **`PageHeader`** — consistent page-level title and description block used across all dashboard routes
- **`MilestoneNote`** — inline callout that labels a feature as planned for a specific future milestone, keeping placeholder UI honest
- **`PipelineStageBadge`** — colour-coded badge for the content pipeline stages (Brief → Writing → Review → Assets → Approved → Published)
- **`ReadinessBadge`** — badge indicating article readiness level
- **`StatusBadge`** — generic status badge wrapper

#### Mock Data Layer
- Centralised mock data module (`app/(protected)/dashboard/_mock/index.js`) providing consistent fixture data (articles, categories, topics, users, logs, AI attempts, approvals, SEO stats, project milestones, workstreams, blockers) shared across all dashboard pages

### Changed

#### Navigation & Layout
- **Sidebar menu** — completely replaced the KGHub demo navigation with a Kingsgate-specific structure grouped into five sections: **Overview**, **Command**, **Content**, **Planning**, and **Administration**; routes all point into `/dashboard/*`
- **Sidebar active-state matching** — fixed over-eager matching where `/dashboard` was highlighted for every sub-route; the root dashboard path now requires an exact match
- **Header** — simplified to search, notification bell, and user avatar; removed `ChatSheet`, `AppsDropdownMenu`, `MegaMenu`, `MegaMenuMobile`, and `Breadcrumb` components; mobile sheet now contains only the sidebar
- **Footer** — replaced Keenthemes branding and links with "Kingsgate Dashboard © 2026 Glorist Smart Solutions"

#### Search Dialog
- Rebuilt with Kingsgate content: quick-action links to all major routes, a recent-articles list, and a team-member tab with live status badges; removed generic demo tabs (Mixed, Settings, Integrations, Docs, Empty, No Results)
- Search placeholder updated to "Search articles, topics, categories..."
- Tabs reduced from seven to three: **All**, **Articles**, **Team**

#### Notifications Sheet
- Replaced all demo notification items with content-workflow events: article stage moves, approval requests, `@mentions` in briefs, AI generation completions, and milestone progress updates; actors match the mock team roster (Sarah Chen, Marcus Webb, Alex Rivera, Jordan Lee, Priya Nair)
- Simplified settings dropdown to two actions: **Notification Preferences** and **Manage Team**
- Extracted repeated `<div className="border-b ...">` into a local `<Divider />` component

### Configuration

- **Dev/prod port** changed from default `3000` to `4000` (`package.json`)
- **Default theme** changed from `system` to `light`; system theme detection disabled (`providers/theme-provider.jsx`)
- **Language detection order** — removed `navigator` from the i18n detection chain, keeping `localStorage` and `htmlTag` only (`providers/i18n-provider.jsx`)

### Archived

- KGHub demo references moved to `_archive/KGHub-demos/` with a README noting they are retained for UI pattern reference only and are not part of the Kingsgate product
