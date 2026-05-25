# Product Overview — Automation Magazine Dashboard

> **Type:** Private internal dashboard  
> **Stack:** Next.js (KGHub) — see `KGHub_MASTER_ANALYSIS.md` for technical foundation  
> **Public site:** WordPress (separate — never managed from this dashboard)  
> **Delivery:** 11 milestones (Milestone 0–10) — this document is the permanent product context for all of them

---

## What This Is

An **AI-powered content operations OS** for running a magazine/business at scale.

It is not a CMS. It combines content management, workflow orchestration, AI assistance, automation control, and full operational tracking into one internal system.

The public website (WordPress) is the output destination. This dashboard is the operational brain that produces everything that goes there.

---

## Who Uses It

| Role | Access | Key Actions |
|---|---|---|
| Admin | Full system control | Manage users, approve actions, configure automation, view all logs |
| User | Scoped to assigned work | Create content, run pipelines, use AI, submit for approval |

> More roles may be defined per milestone. Permissions are granular and role-based (KGHub `UserRole` + `UserPermission` system already exists).

---

## Core Content Structure

```
Categories
  └── Topics
        └── Articles
              └── Pipeline Stages → Tasks → Outputs
```

| Level | Description | Example |
|---|---|---|
| Category | Broad content area | "Finance", "Technology", "Lifestyle" |
| Topic | Specific subject within a category | "Retirement Planning", "AI Tools" |
| Article | A content piece produced for a topic | "5 Best AI Tools in 2026" |

Every article belongs to exactly one topic. Every topic belongs to exactly one category.

---

## System Sections

### 1. AI Chat Command Center

The **intended primary interface** for the entire system — implemented in full in Milestone 9.

> **Sequencing note:** The AI Chat UI is built as a visual shell in Milestone 1 and uses simulated/mock responses through Milestones 1–8. Real AI behavior — intent parsing, action execution, confirmation flows — is wired in Milestone 9.

**Example commands (active from Milestone 9):**
- "Create a new topic under Finance called Budgeting Basics"
- "Plan 5 articles for this topic"
- "What articles are at risk this week?"
- "Generate a draft for article #42"
- "What's the status of the publishing pipeline?"

**Full behavior (Milestone 9+):**
- Understands natural language intent
- Asks questions when input is ambiguous
- Proposes a structured action plan before executing
- Requires explicit confirmation for writes, deletes, and publishes
- Logs every action it takes

**Before Milestone 9:** The chat UI exists (input, thread display, message bubbles, model selector) but responses are static mock replies. No real actions are executed through chat.

---

### 2. Content Hierarchy Management

Full CRUD management for Categories, Topics, and Articles.

**Categories:**
- Title, description, slug, status (active/archived)
- Article count, topic count

**Topics:**
- Title, description, category, target keyword, status
- Article count, readiness overview

**Articles:**
- Title, topic, category, status, target keyword, publish date
- Pipeline stage, assigned users, SEO score, internal link count
- Version history, AI attempt log, activity feed

Every article has a **pipeline** — a defined sequence of stages from planning to post-publish.

---

### 3. Article Production Pipeline

Each article moves through defined stages:

| Stage | Description |
|---|---|
| Planning | Topic confirmed, article brief created |
| Research | Source gathering, keyword research |
| Writing | Draft creation (manual or AI-assisted in Milestone 9+) |
| Asset Generation | Images, graphics, social assets |
| Review | Editorial review |
| Approval | Final sign-off |
| Scheduling | Publish date confirmed |
| Publishing | Sent to WordPress (real publish in Milestone 8+) |
| Post-Publish | Social content created, workflows triggered (Milestone 10+) |

- Each stage can generate tasks
- Each stage has a responsible user (AI agent assignment active from Milestone 9)
- Stages are trackable and auditable
- Blocked stages surface as alerts

**Kanban view:** Articles as cards, columns as pipeline stages.  
**Table view:** Sortable/filterable list with stage + status indicators.

---

### 4. Editorial Calendar & 7-Day Readiness Rule

A full calendar showing scheduled articles by publish date.

**The 7-day rule:**
> Every article must reach "Ready" status at least 7 days before its scheduled publish date.

The system:
- Calculates readiness score per article
- Flags articles that are behind
- Surfaces at-risk articles on the calendar (color-coded)
- Sends alerts when the 7-day window is breached

**Calendar views:** Month, Week, Day, Agenda (using `EventCalendar` from `additional-concepts/calendar/`).

Colors map to article status:
- Sky = Draft
- Amber = In Review
- Emerald = Ready
- Rose = At Risk / Overdue
- Violet = Scheduled
- Orange = Published

---

### 5. Post-Publish & Social Output

After an article is published, the system tracks and manages follow-up social content.

> **Sequencing note:** Social output tracking (UI, status, linking to articles) is built in Milestone 10. Before that, the data model exists but no social content is generated automatically.

**Social outputs may include:**
- Instagram post (image + caption)
- X/Twitter thread
- YouTube description or short-form script
- LinkedIn post
- Newsletter excerpt

Each social output:
- Is tracked in the system
- Has its own status (draft / approved / published)
- Is linked back to the source article
- Is created manually first; AI-assisted generation added in Milestone 10

**Automation trigger (Milestone 10+):** Publishing an article can trigger an n8n workflow that generates and queues social content. Before Milestone 10, social outputs are created and tracked manually.

---

### 6. SEO & Internal Linking

Ensures content quality and site interconnection. This feature evolves gradually — rule-based first, AI-assisted later.

> **Sequencing note:** Basic SEO fields (keyword, score, link count) are part of the article data model from Milestone 4. Rule-based checks and link suggestions are built in Milestone 10. AI-powered SEO recommendations are also Milestone 10+.

**Features — by phase:**

| Feature | Phase |
|---|---|
| Keyword field, SEO score field per article | Milestone 4 (data model) |
| Internal link count tracking | Milestone 4 (data model) |
| Rule-based structural checks (word count, meta, headings) | Milestone 10 |
| Internal link suggestions (article → article) | Milestone 10 |
| Links to Kingsgate business website | Milestone 10 |
| Link coverage report | Milestone 10 |
| AI-powered SEO recommendations | Milestone 10 |

**Data view:** Table of articles with SEO score, link count, and suggestions.  
**Graph view (future):** Internal link network visualization.

---

### 7. Tasks, Kanban & Timeline

All work in the system is tracked through tasks.

**Task sources:**
| Source | Example |
|---|---|
| Manual (user) | "Write introduction section" |
| AI | "Review this draft and leave comments" |
| Workflow | "Upload social image to Instagram" |
| Pipeline stage | "Article entered Review stage → assign reviewer" |

**Views:**
- **Kanban board** — columns: To Do / In Progress / Done (+ custom columns)
- **Timeline** — Gantt-style view of tasks with dates
- **Today / Upcoming / Priority lists** — filtered task lists

Tasks have: title, description, priority, assignee, due date, linked article/stage, status, tags.

---

### 8. Logs, Versions & Activity History

**Everything is recorded. Nothing is overwritten.**

| Log Type | What Is Tracked |
|---|---|
| Article versions | Full content snapshots on every save |
| AI attempts | Every AI-generated output (prompt, result, model, timestamp) |
| Pipeline actions | Stage transitions, who moved what and when |
| Approval events | Approved by / rejected by / comments |
| Workflow runs | n8n execution logs with success/failure |
| System errors | Failed AI calls, failed publishes, integration errors |
| User activity | Login, actions taken, settings changed |

**Views:**
- Per-article activity feed (timeline of all events)
- Global system log (admin-only, filterable by type/user/date)
- AI attempt log (compare versions, see rejection reasons)

---

### 9. Users, Roles & Approvals

Built on top of KGHub's existing `user-management/` module.

**Users:** Invite, activate, deactivate, assign roles.

**Roles:**
- Admin: full access
- User: scoped access
- (Future) Editor, Writer, Reviewer — per milestone

**Approvals:**
- Certain actions require explicit approval before execution
- Examples: publish article, delete topic, bulk AI generation, WordPress push
- Approval requests appear in a queue
- Approvers receive notification
- All approval decisions are logged

---

### 10. Automation Layer

The system connects to external tools to execute and monitor workflows. **This layer is not active until Milestone 8–10.** Earlier milestones prepare the data models, UI, and structure — but nothing is wired externally.

| Integration | Purpose | Active From |
|---|---|---|
| WordPress | Article publishing destination | Milestone 8 |
| AI models | Content generation, SEO suggestions, chat commands | Milestone 9 |
| n8n | Workflow engine — triggers multi-step automations | Milestone 10 |
| Social platforms | Output destination (Instagram, X, YouTube, LinkedIn) | Milestone 10 |
| Email | Notifications, approval requests | Milestone 10 |

**Dashboard role:** Trigger, monitor, and log automations. It does not replace these tools — it orchestrates them.

**Before Milestone 8:** All integration touchpoints (publish buttons, workflow triggers, AI actions) exist in the UI but are non-functional or mocked. Data models are designed to support them from the start.

---

## Milestone Plan (High Level)

| # | Milestone | Scope | AI/Integrations |
|---|---|---|---|
| 0 | KGHub Master Analysis | Analyze KGHub; create `KGHub_MASTER_ANALYSIS.md` as reusable technical reference | None |
| 1 | Full Dashboard UI (Non-Functional) | Build all pages, layouts, navigation, and shells using KGHub. No real backend. Mock data only. | UI shell only — chat UI exists, responses are mocked |
| 2 | Backend Foundation + Auth | Setup database schema, API routes, and authentication. Replace mock state with real data layer. | None |
| 3 | Categories & Topics (Real System) | First fully working feature: Categories + Topics with real CRUD, API, and DB. | None |
| 4 | Articles + Pipeline | Core content engine: article lifecycle, pipeline stages, stage transitions, task generation. | UI only — AI fields exist in data model, not wired |
| 5 | Tasks + Kanban System | Full task system: kanban, timeline, today/upcoming/priority views. Linked to articles and pipeline stages. | None |
| 6 | Editorial Calendar + Readiness Rule | Calendar with publish dates, 7-day readiness enforcement, at-risk detection, color coding. | None |
| 7 | Logs, Versions, Activity Tracking | Full transparency layer: article versions, AI attempt log (structure ready), pipeline events, system log. | Log structure for AI ready — AI not connected |
| 8 | WordPress Integration | Real publishing: connect to WordPress REST API, push articles, sync status. | First real external integration |
| 9 | AI Chat Integration (Real) | Connect AI models, implement intent parsing, action system, confirmation flows, real AI responses. | **AI fully active** — chat executes real actions |
| 10 | n8n Automation + SEO + Social | Automation layer: n8n workflows, SEO logic + link suggestions, social output generation, full integration wiring. | All integrations active |

> Each milestone prompt must reference both this document and `KGHub_MASTER_ANALYSIS.md`.  
> Milestone 0 is complete. The artifact it produced is `KGHub_MASTER_ANALYSIS.md`.

---

## Key Rules for All Milestones

1. **This document is the product source of truth.** All milestones must stay consistent with the structure, terminology, and behavior defined here.
2. **KGHub is the UI foundation.** See `KGHub_MASTER_ANALYSIS.md`. Do not re-analyze the theme.
3. **`additional-concepts/` is the component source.** Check it before building anything new.
4. **Scope each milestone tightly.** Do not implement future milestone features early.
5. **AI is visual/mocked until Milestone 9.** The chat UI is built in Milestone 1. Real AI intent, actions, and responses are wired in Milestone 9 only. Never connect AI behavior before Milestone 9 unless explicitly instructed.
6. **External integrations follow this order:** WordPress (M8) → AI models (M9) → n8n + social (M10). Nothing is wired before its milestone.
7. **Mock data is used until real APIs are ready.** Keep mock data isolated in `[module]/mock/`. Replace with real API calls only in the milestone that establishes the backend for that module.
8. **SEO and social features are rule-based first, AI-assisted in Milestone 10.** Do not build intelligent suggestions before Milestone 10.
9. **The 7-day readiness rule is enforced from Milestone 6.** Build it there; reference it in all later milestones.
10. **Nothing is overwritten.** All versions, attempts, and actions are logged. Log structure must be designed from Milestone 4 onward even if the log UI is built in Milestone 7.
11. **Important actions require approval.** Design with the approval layer in mind from Milestone 1.
12. **Content flows in one direction:** Categories → Topics → Articles → Pipeline → Calendar → Social → Logs.

---

## Terminology Reference

| Term | Meaning |
|---|---|
| Category | Broad content area grouping topics |
| Topic | Specific subject within a category; contains articles |
| Article | A single content piece with its full lifecycle |
| Pipeline | The ordered stages an article moves through |
| Stage | One step in the pipeline (Planning, Writing, Review, etc.) |
| Readiness | Whether an article is ready at least 7 days before publish |
| AI Attempt | One AI-generated output stored with prompt, result, and metadata |
| Version | A full snapshot of article content at a point in time |
| Workflow | An automated multi-step process (run via n8n) |
| Social Output | Post-publish content created for social platforms |
| Approval | A required confirmation from an authorized user before action executes |
| Log | An immutable record of a system event |
| Kingsgate | The main business website (WordPress) — SEO links point here |
