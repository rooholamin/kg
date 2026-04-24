# Automation Magazine Dashboard

Private internal dashboard for an AI-assisted content operations platform. Manages the full lifecycle of magazine content — from planning through publishing — using AI, automation, and structured workflows.

> **Public website:** WordPress (separate — not managed from this dashboard)  
> **UI foundation:** Metronic Next.js v9.4.10  
> **Delivery:** Milestones 0–10 — see [`PRODUCT_OVERVIEW.md`](./PRODUCT_OVERVIEW.md)

---

## Project Documents

| Document | Purpose |
|---|---|
| [`PRODUCT_OVERVIEW.md`](./PRODUCT_OVERVIEW.md) | Product context, system sections, milestone plan, key rules |
| [`METRONIC_MASTER_ANALYSIS.md`](./METRONIC_MASTER_ANALYSIS.md) | Metronic structure, routing, components, theming, safe customization rules |
| [`CHANGELOG.md`](./CHANGELOG.md) | Version history and per-milestone deliverables |

Both documents are required reading before starting any milestone.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| UI | Metronic v9.4.10 + Tailwind CSS v4 + shadcn/ui-style components |
| Auth | NextAuth v4 (JWT, Credentials + Google) |
| Database | PostgreSQL 17 via Prisma ORM |
| Data fetching | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Storage | AWS S3 (SDK v3) |
| Email | Nodemailer |
| Automation | n8n (Milestone 10) |
| AI | TBD (Milestone 9) |
| Publishing | WordPress REST API (Milestone 8) |

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
- **Milestone 3** — **Categories and topics**: full CRUD (create, edit, archive or delete with dependency rules), `ContentLog` entries on changes, Kingsgate home-service seed (`prisma/data/kg-content.js`, run `npx prisma db seed`). List and detail under `/dashboard/categories` and `/dashboard/topics`. Articles remain list/detail from DB without article CRUD until Milestone 4.

---

## Project Structure

```
app/
├── (auth)/          # Sign in, sign up, password reset
├── (protected)/     # All dashboard pages (auth-guarded, Demo1Layout)
│   ├── account/     # My account (built-in Metronic)
│   ├── user-management/  # Users, roles, permissions (built-in Metronic)
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

additional-concepts/ # Pre-built Metronic concept apps (reference only — do not import directly)
```

---

## Milestone Status

| # | Milestone | Status |
|---|---|---|
| 0 | Metronic Master Analysis | ✅ Complete |
| 1 | Full Dashboard UI (Non-Functional) | ✅ Complete |
| 2 | Backend Foundation + Auth | ✅ Complete |
| 3 | Categories & Topics (CRUD + seed) | ✅ Complete |
| 4 | Articles + Pipeline | ⬜ Pending |
| 5 | Tasks + Kanban System | ⬜ Pending |
| 6 | Editorial Calendar + Readiness Rule | ⬜ Pending |
| 7 | Logs, Versions, Activity Tracking | ⬜ Pending |
| 8 | WordPress Integration | ⬜ Pending |
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

See [`METRONIC_MASTER_ANALYSIS.md`](./METRONIC_MASTER_ANALYSIS.md) for the full safe customization rules.
