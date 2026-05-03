# Changelog

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
- **Forms** — Zod schemas in `app/(protected)/dashboard/categories/forms/` and `.../topics/forms/`; Metronic `Dialog` + React Hook Form + TanStack Query mutations (aligned with user-management pattern).
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
- **Sidebar menu** — completely replaced the Metronic demo navigation with a Kingsgate-specific structure grouped into five sections: **Overview**, **Command**, **Content**, **Planning**, and **Administration**; routes all point into `/dashboard/*`
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

- Metronic demo references moved to `_archive/metronic-demos/` with a README noting they are retained for UI pattern reference only and are not part of the Kingsgate product
