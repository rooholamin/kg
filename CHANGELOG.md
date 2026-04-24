# Changelog

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
