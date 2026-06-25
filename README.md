# Automation Magazine Dashboard

Private internal dashboard for an AI-assisted content operations platform. Manages the full lifecycle of magazine content — from planning through publishing — using AI, automation, and structured workflows.

> **Public website:** WordPress (separate — not managed from this dashboard)  
> **UI foundation:** KGHub Next.js v9.4.10  
> **Delivery:** Milestones 0–10 — see [`PRODUCT_OVERVIEW.md`](./PRODUCT_OVERVIEW.md)

---

## Project Documents

| Document | Purpose |
|---|---|
| [`PRODUCT_OVERVIEW.md`](./PRODUCT_OVERVIEW.md) | Product context, system sections, milestone plan, key rules |
| [`KGHub_MASTER_ANALYSIS.md`](./KGHub_MASTER_ANALYSIS.md) | KGHub structure, routing, components, theming, safe customization rules |
| [`CHANGELOG.md`](./CHANGELOG.md) | Version history and per-milestone deliverables |

Both documents are required reading before starting any milestone.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| UI | KGHub v9.4.10 + Tailwind CSS v4 + shadcn/ui-style components |
| Auth | NextAuth v4 (JWT, Credentials + Google) |
| Database | PostgreSQL 17 via Prisma ORM |
| Data fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Storage | AWS S3 (SDK v3) |
| Email | Nodemailer |
| Automation | n8n (Milestone 10) |
| AI | TBD (Milestone 9) |
| Publishing | WordPress REST API (Basic Auth + Application Passwords) |

---

## Prerequisites

- Node.js 18+
- PostgreSQL 17
- npm

---

## Setup

**1. Install dependencies**

```bash
npm install --force
```

> `--force` required to resolve React 19 peer dependency conflicts.

**2. Configure environment**

```bash
cp .env.example .env.local
```

Fill in required values:

```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:4000

# Optional: Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Optional: AWS S3
AWS_REGION=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
```

**3. Setup database**

```bash
npx prisma db push
npx prisma generate
```

**4. Seed database** *(optional)*

```bash
npx prisma db seed
```

**5. Start development server**

```bash
npm run dev
```

Open [http://localhost:4000](http://localhost:4000) (dev port is set in `package.json`).

---

## Features (shipped in milestones)

- **Milestones 1–2** — Full dashboard UI shell, auth, and read-only Prisma-backed APIs for categories, topics, and articles. Magazine-style seed data.
- **Milestone 3** — **Categories and topics**: full CRUD (create, edit, archive or delete with dependency rules), `ContentLog` entries on changes, Kingsgate home-service seed (`prisma/data/kg-content.js`, run `npx prisma db seed`). List and detail under `/dashboard/categories` and `/dashboard/topics`.
- **Milestone 4** — **Articles**: rich content (TipTap), uploads, full CRUD APIs, article detail tabs, pipeline `ArticleStatus`, publish date with auto `readinessDeadline` (publish minus 7 days). See [`CHANGELOG.md`](./CHANGELOG.md) `[0.4.0]`.
- **Milestone 5 (release track)** — **Project progress**: Prisma models, admin-gated writes, `/api/project-progress/*`, `/dashboard/project-progress` with phases, workstreams, milestones, blockers, and reports. See [`CHANGELOG.md`](./CHANGELOG.md) `[0.5.0]`. *(Product doc “Milestone 5” is tasks + Kanban — that track is still pending.)*
- **Milestone 6** — **Editorial calendar + readiness**: `GET /api/calendar`, readiness states on the calendar, at-risk summary, filters, upcoming list, navigation to `/dashboard/articles/[id]`; social calendar remains mock until Milestone 10. See [`CHANGELOG.md`](./CHANGELOG.md) `[0.6.0]`.
- **Milestone 7** — **Logs, versions, AI attempts, sections, idea backlog**: `ArticleVersion` snapshots, `AIAttempt` tracking, enriched `ContentLog` (action, metadata, createdBy), `Section` model with character fields, sections CRUD at `/dashboard/sections`, `IdeaBacklog` model and UI at `/dashboard/idea-backlog`, real data in `/dashboard/logs` and `/dashboard/logs/attempts`. See [`CHANGELOG.md`](./CHANGELOG.md) `[0.8.0]`.
- **Content taxonomy rebuild** — all categories and topics replaced with 70 categories and 700 topics sourced from the KGHub Categories spreadsheet (10 categories × 7 sections, 10 topics per category). Re-run `npx prisma db seed` to apply. See [`CHANGELOG.md`](./CHANGELOG.md) `[0.9.0]`.
- **Pipeline Engine v1 ("Editor in Chief")** — single engine that chains research → writing → image generation for every article in the queue; dashboard at `/dashboard/pipeline-engine` with animated character, pipeline progress nodes, queue list, and history. See [`CHANGELOG.md`](./CHANGELOG.md) `[1.0.0]`.
- **Pipeline Engine v2 (3-engine)** — three independent engines (`research`, `writing`, `images`) that run in parallel on their respective article statuses; per-engine configurable rate-limit delay; always-on polling; per-engine start/pause/rate controls in the dashboard. See [`CHANGELOG.md`](./CHANGELOG.md) `[1.1.0]`.
- **WordPress Integration** — per-section WordPress credentials (`wpSiteUrl`, `wpUsername`, `wpAppPassword`, `wpAuthorId`); bulk category and topic sync to WP taxonomy; article approval triggers automatic publishing via `POST /wp-json/wp/v2/posts`; featured-image hero in approval preview modal; live approvals queue at `/dashboard/approvals`. See [`CHANGELOG.md`](./CHANGELOG.md) `[1.2.0]`.
- **Roles, Access Control & User Management** — 3 editorial roles (`superadmin`, `admin`, `editor`); `roleSlug` in JWT session; `lib/require-role.js` guard used on all write routes; approval attribution (`approvedById`/`rejectedById`) on articles; live approved/rejected history tabs; functional users page with change-role action for superadmin; public signup disabled; fake seed users removed. See [`CHANGELOG.md`](./CHANGELOG.md) `[1.3.0]`.
- **Articles Bulk Actions** — checkbox row-selection on the articles table; bulk delete (all selected) and bulk approve (selected articles in `approval` status) via `DELETE /api/articles/bulk` and `POST /api/articles/bulk`; contextual action bar with selection count and clear button; confirmation dialogs with per-operation success/failure counts. See [`CHANGELOG.md`](./CHANGELOG.md) `[1.3.1]`.

---

## Project Structure

```
app/
├── (auth)/          # Sign in, sign up, password reset
├── (protected)/     # All dashboard pages (auth-guarded, Demo1Layout)
│   ├── account/     # My account (built-in KGHub)
│   ├── user-management/  # Users, roles, permissions (built-in KGHub)
│   └── [modules]/   # Custom dashboard modules (added per milestone)
├── api/             # Route handlers
└── components/      # Layout shell + partials

components/
├── ui/              # ~70 primitive components (DO NOT EDIT)
├── common/          # Layout helpers (DO NOT EDIT)
├── keenicons/       # Icon font (DO NOT EDIT)
└── custom/          # Our custom shared components

config/
├── menu.config.jsx  # All navigation (edit to add menu items)
└── settings.config.js

css/
├── styles.css       # Entry point
├── config.reui.css  # Design tokens (DO NOT EDIT)
└── demos/demo1.css  # Layout variables (DO NOT EDIT)

prisma/
└── schema.prisma    # Database schema

additional-concepts/ # Pre-built KGHub concept apps (reference only — do not import directly)
```

---

## Milestone Status

| # | Milestone | Status |
|---|---|---|
| 0 | KGHub Master Analysis | ✅ Complete |
| 1 | Full Dashboard UI (Non-Functional) | ✅ Complete |
| 2 | Backend Foundation + Auth | ✅ Complete |
| 3 | Categories & Topics (CRUD + seed) | ✅ Complete |
| 4 | Articles + Pipeline | ✅ Complete |
| 5 | Tasks + Kanban System | ⬜ Pending |
| 6 | Editorial Calendar + Readiness Rule | ✅ Complete |
| 7 | Logs, Versions, Activity Tracking + Sections + Idea Backlog | ✅ Complete |
| — | Content Taxonomy Rebuild (Excel import) | ✅ Complete |
| — | n8n Article Automation (Research / Writing / Images) | ✅ Complete |
| — | Pipeline Engine v1 — single "Editor in Chief" engine | ✅ Complete |
| — | Pipeline Engine v2 — 3 parallel engines with rate limiting | ✅ Complete |
| — | WordPress Integration — publishing, category/topic sync, approvals queue | ✅ Complete |
| — | Roles, access control, user management, approval attribution | ✅ Complete |
| 8 | WordPress Integration — media upload, tags, full SEO meta | ⬜ Pending |
| 9 | AI Chat Integration (Real) | ⬜ Pending |
| 10 | n8n Automation + SEO + Social | ⬜ Pending |

---

## Development Rules

- Never edit files in `components/ui/`, `components/common/`, `components/keenicons/`, `css/config.reui.css`, or `css/demos/demo1.css`
- Add navigation only via `config/menu.config.jsx`
- Add custom pages only under `app/(protected)/[module]/`
- Add custom shared components only under `components/custom/`
- Keep mock data isolated in `[module]/mock/` — never mix with real API logic
- Every custom API route must include a `getServerSession()` auth check
- Use token-based Tailwind classes (`bg-background`, `text-primary`, etc.) — never hardcode colors

See [`KGHub_MASTER_ANALYSIS.md`](./KGHub_MASTER_ANALYSIS.md) for the full safe customization rules.
