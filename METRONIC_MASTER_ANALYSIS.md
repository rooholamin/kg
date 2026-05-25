# KGHub Master Analysis Report — Automation Magazine Dashboard

> **Version:** KGHub Next.js v9.4.10 · Next.js App Router · Tailwind CSS v4 · TanStack Query v5 · NextAuth v4 · Prisma ORM  
> **Purpose:** Single source of truth for all future dashboard milestones. Do not re-analyze unless theme version changes.  
> **Last updated:** Added `additional-concepts/` analysis (AI Chat, Todo/Kanban, Calendar, Mail, CRM, Real Estate, Store Inventory)

---

## 1. Executive Summary

The project uses KGHub's Next.js starter with App Router, a config-driven sidebar, shadcn/ui-style component library, CSS custom-property theming (Tailwind v4), and real NextAuth + Prisma auth. All navigation is declared in one config file. All custom code should live in `app/(protected)/` with no edits to core theme files.

`additional-concepts/nextjs/` contains **7 fully-built standalone concept apps** (AI Chat, Todo/Kanban, Calendar, Mail, CRM, Real Estate, Store Inventory) — each with its own layout, components, mock data, and types. These are not wired into the main app; they are copy-paste sources for our dashboard modules. They also contain a richer `components/ui/` set (including `EventCalendar`, `Kanban`, `DataGrid`, `ProgressCircle`, `FileUpload`, etc.) that may be more complete than the main app's `components/ui/`.

---

## 2. Dashboard Context

| Aspect | Detail |
|---|---|
| Product | Automation Magazine — AI-assisted content ops platform |
| Dashboard purpose | Internal ops: AI chat, article pipeline, editorial calendar, social, SEO, tasks, users, approvals |
| Public site | WordPress (separate — never touch from this dashboard) |
| External systems | n8n, AI APIs, WordPress REST — **not connected yet** |
| Auth | NextAuth v4 JWT; role-based (UserRole + UserPermission in Prisma) |
| DB | PostgreSQL via Prisma |
| UI foundation | KGHub Demo1Layout (light sidebar variant) |

---

## 3. KGHub Project Structure

```
/
├── app/                        # Next.js App Router root
│   ├── layout.jsx              # Root: stacks all providers
│   ├── (auth)/                 # Route group — BrandedLayout (2-col card+image)
│   │   ├── layout.jsx
│   │   ├── layouts/branded.jsx | classic.jsx
│   │   └── signin/ signup/ reset-password/ verify-email/ change-password/
│   ├── (protected)/            # Route group — Demo1Layout + auth guard
│   │   ├── layout.jsx          # useSession() guard → Demo1Layout
│   │   ├── account/            # My Account (multi-section)
│   │   ├── user-management/    # Users, Roles, Permissions, Logs, Settings
│   │   ├── store-client/       # E-commerce demo pages
│   │   ├── public-profile/     # Profile variants
│   │   ├── network/            # User card/table listings
│   │   └── components/         # Layout shell + demo page content
│   │       └── layouts/demo1/  # THE active layout (see §4)
│   ├── api/                    # Route Handlers
│   │   ├── auth/[...nextauth]/ # NextAuth handler + auth-options.js
│   │   └── user-management/    # CRUD for users/roles/permissions/account/settings
│   ├── components/
│   │   ├── layouts/demo1/      # Mirror of above (same files, alias resolves both)
│   │   └── partials/           # Cards, topbar, dialogs, mega-menu panels, etc.
│   └── models/                 # user.js, system.js
│
├── components/                 # Global UI primitives
│   ├── ui/                     # ~70 components (shadcn-style + custom)
│   ├── common/                 # container, toolbar, content, screen-loader, icons
│   └── keenicons/              # Custom icon font (duotone/filled/outline/solid)
│
├── config/
│   ├── menu.config.jsx         # ALL navigation defined here (6 exports)
│   └── settings.config.js      # Layout settings with localStorage persistence
│
├── css/
│   ├── styles.css              # Entry: @import tailwindcss + all partials
│   ├── config.reui.css         # Design tokens (CSS vars + @theme inline)
│   └── demos/demo1.css         # Layout vars: sidebar-width, header-height, animations
│
├── hooks/                      # use-menu, use-mounted, use-body-class, use-scroll-position, etc.
├── i18n/                       # i18next config + message files
├── lib/                        # prisma.js, api.js, s3-client.js, db.js, storage.js
├── prisma/                     # schema.prisma, migrations/, seed.js
├── providers/                  # QueryProvider, AuthProvider, SettingsProvider, ThemeProvider, I18nProvider, ModulesProvider
├── services/                   # send-email.js, system-log.js
└── types/                      # TypeScript type declarations
```

**Path alias:** `@/*` resolves to BOTH project root `./*` AND `./app/components/*`. So `@/partials/topbar/x` → `app/components/partials/topbar/x`, and `@/lib/api` → `lib/api.js`.

---

## 4. Routing & Layout System

### Route Groups

| Group | Layout | Purpose |
|---|---|---|
| `(auth)` | `BrandedLayout` | 2-col grid: form card + image panel |
| `(protected)` | `Demo1Layout` | Full app shell with sidebar + header |
| Bare `app/` | Root `layout.jsx` | Provider stack only |

### Active Layout: `Demo1Layout`

File: `app/components/layouts/demo1/layout.jsx`

```
Root layout.jsx
  └── (protected)/layout.jsx   ← useSession guard
        └── Demo1Layout
              ├── <Sidebar />         (desktop only, fixed left)
              │     ├── SidebarHeader (logo + collapse toggle)
              │     └── SidebarMenu   (AccordionMenu from MENU_SIDEBAR)
              ├── .wrapper div
              │     ├── <Header />    (mobile sidebar sheet, mega-menu, search, notifs, user)
              │     ├── <main>        ← {children} rendered here
              │     └── <Footer />
```

**Body classes added:** `demo1 sidebar-fixed header-fixed layout-initialized`

**Sidebar collapse:** `storeOption('layouts.demo1.sidebarCollapse', bool)` → persisted to localStorage. CSS vars in `demo1.css` handle width transitions (`--sidebar-width: 280px` ↔ `--sidebar-width-collapse: 80px`).

**Mobile sidebar:** Hidden via `{!isMobile && <Sidebar />}`. Header opens it as a `Sheet` (Radix UI slide-in drawer).

**Adding a new protected page:**

```
app/(protected)/my-module/page.jsx    ← auto-routed, wrapped in Demo1Layout
```

No layout wiring needed — the route group handles it.

---

## 5. Navigation & Menu System

**Single config file:** `config/menu.config.jsx`

| Export | Consumer | Description |
|---|---|---|
| `MENU_SIDEBAR` | `SidebarMenu` | Main accordion sidebar nav |
| `MENU_SIDEBAR_CUSTOM` | Store variant | Alt sidebar config |
| `MENU_SIDEBAR_COMPACT` | Compact variant | Compact sidebar config |
| `MENU_MEGA` | `MegaMenu` (desktop) | Header dropdown mega-menu |
| `MENU_MEGA_MOBILE` | `MegaMenuMobile` | Mobile sheet mega-menu |
| `MENU_HELP` | Help dropdown | Help center links |
| `MENU_ROOT` | Root-level nav | Top-level items with child refs |

### Menu Item Shape

```js
{
  title: 'string',          // required for leaf & parent
  icon: LucideIcon,         // optional icon component
  path: '/route',           // leaf items only
  children: [...],          // nested items
  heading: 'Section Label', // renders a group label row
  disabled: true,           // shows "Soon" badge
  badge: 'string',          // text badge on group
  separator: true,          // horizontal rule
  collapse: true,           // collapsible sub-group
  collapseTitle: 'See less',
  expandTitle: 'See more',
}
```

### How to Add a New Section

1. Open `config/menu.config.jsx`
2. Add an entry to `MENU_SIDEBAR` (heading + children)
3. Use a Lucide icon or KeenIcons wrapper
4. The `SidebarMenu` + `AccordionMenu` components render it automatically — no component edits needed

---

## 6. Reusable Components

### `components/ui/` — Core Primitives (~70 total)

| Category | Components |
|---|---|
| Form | `button`, `input`, `select`, `checkbox`, `radio-group`, `switch`, `textarea`, `label`, `form` |
| Overlay | `dialog`, `sheet`, `drawer`, `popover`, `tooltip`, `alert-dialog` |
| Navigation | `tabs`, `accordion`, `accordion-menu`, `breadcrumb`, `pagination` |
| Display | `card`, `badge`, `avatar`, `separator`, `skeleton`, `alert`, `progress`, `table` |
| Data | `data-grid`, `data-grid-table`, `data-grid-pagination`, `data-grid-column-filter`, `kanban`, `sortable`, `tree` |
| Animation | `counting-number`, `sliding-number`, `shimmering-text`, `marquee`, `typing-text`, `word-rotate`, `text-reveal`, `hover-background`, `gradient-background` |
| Charts | `chart` (recharts-based wrapper) |
| Menu | `dropdown-menu`, `context-menu`, `menubar`, `command` |
| Feedback | `toaster` (sonner), `scroll-area`, `collapsible` |

### `components/common/` — Layout Helpers

| Component | Usage |
|---|---|
| `Container` | Max-width page wrapper (`container fixed` class) |
| `Toolbar` | Page-level toolbar bar (title + actions) |
| `Content` | Main page content wrapper with padding |
| `ScreenLoader` | Full-page spinner (auth loading state) |
| `ContentLoader` | Skeleton placeholder for async content |
| `Icons` | Wrapper for KeenIcons |

### `app/components/partials/` — High-Level Page Sections

| Dir | Contents |
|---|---|
| `cards/` | ~25 card variants: author, campaign, project, user-mini, team, NFT, etc. |
| `topbar/` | UserDropdown, Notifications sheet, Chat sheet, Apps dropdown |
| `dialogs/` | Search dialog, ShareProfile, WelcomeMessage, GiveAward |
| `mega-menu/` | Panel components for profiles, account, network, apps, auth |
| `activities/` | Timeline/activity feed item variants |
| `common/` | Hero, FAQ, Engage, Rating, HexagonBadge, AvatarInput |
| `navbar/` | Scrollspy navbar, NavbarMenu |
| `dropdown-menu/` | 9 pre-built dropdown variants |

### KeenIcons

Custom icon font at `components/keenicons/`. Usage:

```jsx
import { KeenIcon } from '@/components/keenicons';
<KeenIcon icon="abstract-14" style="duotone" />
// styles: duotone | filled | outline | solid
```

---

## 7. Styling & Theming Rules

### Stack

- **Tailwind CSS v4** — no `tailwind.config.js`. Uses `@import 'tailwindcss'` in `css/styles.css`.
- **CSS custom properties** — all design tokens in `css/config.reui.css`.
- **Dark mode** — `next-themes` with `attribute="class"`. Toggle `.dark` on `<html>`.

### Token Structure (`css/config.reui.css`)

```css
:root {
  --background: white;
  --foreground: zinc-950;
  --primary: blue-500;
  --secondary: zinc-100;
  --muted: zinc-100;
  --accent: zinc-100;
  --border: zinc-200;
  --ring: blue-500;
  /* ... */
}
.dark {
  --background: zinc-950;
  --primary: blue-600;
  /* ... */
}
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  /* maps CSS vars → Tailwind utility classes */
}
```

### Layout Variables (`css/demos/demo1.css`)

```css
.demo1 {
  --sidebar-width: 280px;
  --sidebar-width-collapse: 80px;
  --header-height: 70px;
}
```

### Theming Rules for Custom Modules

| Rule | Detail |
|---|---|
| Use token classes | `bg-background`, `text-foreground`, `border-border`, `text-primary`, etc. |
| Never hardcode colors | No `bg-zinc-950` or `text-blue-500` in custom code |
| Dark mode | Handled automatically via `.dark` on `<html>` — no manual dark: prefix usually needed |
| Sidebar dark | Sidebar independently supports dark theme via `.dark` class on sidebar `<div>` |
| Custom CSS | Add to `css/components/` or `css/demos/` — never edit `config.reui.css` |
| New CSS vars | Define in a new file, import in `styles.css` |

---

## 8. Data, Auth & API Patterns

### Auth

| Aspect | Detail |
|---|---|
| Library | NextAuth v4 + PrismaAdapter |
| Strategy | JWT, 24h session |
| Providers | Credentials (email + bcrypt) + Google OAuth |
| Token payload | `id`, `email`, `name`, `avatar`, `status`, `roleId`, `roleName` |
| Route protection | Client-side in `app/(protected)/layout.jsx` via `useSession()` |
| No middleware.ts | Auth is not enforced at edge — server receives all requests |
| Auth APIs | `/api/auth/signup`, `reset-password`, `verify-email`, `change-password` |

### Database (Prisma)

| Model | Key Fields |
|---|---|
| `User` | id, email, password (bcrypt), name, roleId, status (INACTIVE/ACTIVE/BLOCKED), avatar, isTrashed, isProtected |
| `UserRole` | slug, name, isDefault, isProtected, permissions[] |
| `UserPermission` | slug, name |
| `UserRolePermission` | join table |
| `SystemLog` | userId, entityId, entityType, event, description, ipAddress |
| `SystemSetting` | name, logo, address, social links, notification prefs |
| NextAuth tables | Account, Session, VerificationToken |

### API Pattern

```
app/api/[feature]/
  route.js          ← GET (list) + POST (create)
  [id]/route.js     ← GET (one) + PUT (update) + DELETE
```

All use Next.js Route Handlers. No tRPC. Prisma accessed via `lib/prisma.js` singleton.

### Client Data Fetching

- **TanStack Query v5** via `QueryProvider`
- Fetch wrapper: `lib/api.js`
- Feature-level hooks in `[feature]/hooks/` directory
- Pattern: `use-[entity]-query.js` (list), `use-[entity]-[id]-query.js` (single)

### Storage

- S3-compatible uploads via `lib/s3-client.js` + `lib/s3-upload.js` (AWS SDK v3)
- Email via `services/send-email.js` (Nodemailer)
- Audit logging via `services/system-log.js`

---

## 9. Safe Customization Rules

| Rule | Rationale |
|---|---|
| Add pages only in `app/(protected)/[module]/` | Protected route group auto-applies Demo1Layout + auth guard |
| Add menu items only in `config/menu.config.jsx` | SidebarMenu is purely config-driven — no component editing needed |
| Add custom components in `app/(protected)/[module]/components/` | Keeps feature code co-located |
| Add shared custom components in `components/custom/` (create) | Separate from KGHub's `components/ui/` |
| Add API routes in `app/api/[module]/` | Follows existing route handler pattern |
| Add custom hooks in `[module]/hooks/` | Co-location with TanStack Query pattern |
| Add Prisma models by extending `prisma/schema.prisma` | Add new models; never alter User/UserRole/NextAuth tables |
| Add CSS in new files under `css/components/` or `css/modules/` | Import in `styles.css` |
| Never edit `css/config.reui.css` | Break design token system |
| Never edit `components/ui/` files | KGHub updates will overwrite; extend instead |
| Never edit `app/components/layouts/demo1/` | Core layout — create new layout files if needed |
| Never edit `config/settings.config.js` layout definitions | Add new keys via `setOption`/`storeOption` in feature code |
| Keep mock data in `[module]/mock/` or `[module]/data/` | Clear separation from real API logic |

---

## 10. Recommended Custom Folder Structure

```
app/(protected)/
│
├── ai-chat/                    # AI Chat Command Center
│   ├── page.jsx
│   ├── content.jsx
│   ├── components/
│   ├── hooks/
│   └── mock/
│
├── content/                    # Content hierarchy (categories → topics → articles)
│   ├── categories/page.jsx
│   ├── topics/page.jsx
│   ├── articles/
│   │   ├── page.jsx            # Article list
│   │   ├── [id]/page.jsx       # Article detail / editor
│   │   └── pipeline/page.jsx   # Article pipeline view
│   ├── components/
│   ├── hooks/
│   └── mock/
│
├── editorial/                  # Editorial Calendar + 7-day readiness rule
│   ├── calendar/page.jsx
│   ├── components/
│   ├── hooks/
│   └── mock/
│
├── social/                     # Social Output Tracking
│   ├── page.jsx
│   ├── components/
│   ├── hooks/
│   └── mock/
│
├── seo/                        # SEO / Internal Linking
│   ├── page.jsx
│   ├── components/
│   ├── hooks/
│   └── mock/
│
├── tasks/                      # Tasks / Kanban / Timeline
│   ├── kanban/page.jsx
│   ├── timeline/page.jsx
│   ├── components/
│   ├── hooks/
│   └── mock/
│
├── logs/                       # Logs / Attempts / Versions / Activity History
│   ├── page.jsx
│   ├── components/
│   ├── hooks/
│   └── mock/
│
├── approvals/                  # Approvals workflow
│   ├── page.jsx
│   ├── components/
│   ├── hooks/
│   └── mock/
│
│   # Built-in KGHub modules (already exist — extend, don't rebuild)
├── user-management/            # Users, Roles, Permissions ← already functional
└── account/                    # My Account ← already functional

app/api/
├── content/
│   ├── categories/route.js
│   ├── topics/route.js
│   └── articles/route.js
├── editorial/route.js
├── social/route.js
├── seo/route.js
├── tasks/route.js
├── logs/route.js
└── approvals/route.js

components/
├── ui/                         # KGHub — DO NOT EDIT
├── common/                     # KGHub — DO NOT EDIT
├── keenicons/                  # KGHub — DO NOT EDIT
└── custom/                     # Our custom shared components
    ├── pipeline-card.jsx
    ├── readiness-badge.jsx
    ├── status-pill.jsx
    └── ...

css/
├── styles.css                  # Add @import for new files here only
├── config.reui.css             # KGHub — DO NOT EDIT
├── demos/demo1.css             # KGHub — DO NOT EDIT
└── modules/                    # Our custom module CSS
    ├── editorial.css
    ├── pipeline.css
    └── ...

prisma/
└── schema.prisma               # Add new models here; never alter existing User/NextAuth models
```

---

## 11. Mapping: Dashboard Modules → KGHub

> **Bold** = copy from `additional-concepts/`. Regular = from main `components/ui/` or `partials/`.

| Dashboard Module | KGHub/Concept Source | Route | Status |
|---|---|---|---|
| AI Chat Command Center | **`additional-concepts/ai/`** — ChatStarter, ChatMessages, ChatMessage, AIModelSelector, RecentChats, PinnedChats + `ScrollArea`, `Avatar`, `Input`, `Button` | `/ai-chat` | New |
| Categories / Topics | `DataGrid`+`DataGridPagination`, `Dialog`, `Form`, `Sheet` — pattern from **Store Inventory tables** | `/content/categories`, `/content/topics` | New |
| Articles | `DataGrid` (cols from **`tables/product-list.jsx`**), `Card`, `Badge`, `Tabs`, `Toolbar` | `/content/articles` | New |
| Article Pipeline | **`additional-concepts/todo/` Kanban** — KanbanBoard, KanbanColumn, KanbanItem, KanbanOverlay | `/content/articles/pipeline` | New |
| Article Detail / Editor | **CRM `company/` split-view** — left tabs (content/versions/activity/notes) + right meta panel (`ResizablePanel`) | `/content/articles/[id]` | New |
| Editorial Calendar | **`additional-concepts/calendar/` EventCalendar** — full drop-in; map colors to article status | `/editorial/calendar` | New |
| Social Output Tracking | `Chart` (recharts), `DataGrid`, `Card`, `Badge`, `Tabs`, `ToggleGroup` period selector from **Store Inventory Orders widget** | `/social` | New |
| SEO / Internal Linking | `Tree`, `DataGrid`, `Badge`, `Chart` | `/seo` | New |
| Tasks / Kanban | **`additional-concepts/todo/` Kanban** — task-column + task-card; AI aside for AI suggestions | `/tasks/kanban` | New |
| Tasks / Timeline | `DataGrid` + **CRM activity timeline** pattern | `/tasks/timeline` | New |
| Logs / Activity History | `DataGrid`, **`store-inventory/components/customers/activity/`** timeline items, `partials/activities/` | `/logs` | New |
| Approvals | `DataGrid`, **CRM `TaskList`** with tabs, `Dialog`, `Badge`, `Button` | `/approvals` | New |
| Notifications | **`additional-concepts/mail/`** MailListMessages pattern + **NotificationsSheet** (20 items) from Store Inventory | `/notifications` | New |
| Users / Roles | Already functional in KGHub `user-management/` | `/user-management/*` | Extend |
| My Account | Already functional in KGHub `account/` | `/account/*` | Extend |

---

## 12. Future Milestone Rules

**Every future AI prompt working on this dashboard MUST follow these rules:**

1. **Use this document as the KGHub source of truth.** Do not re-analyze the theme structure unless the KGHub version changes.
2. **Scope each milestone to one module.** Do not mix article pipeline with editorial calendar in one PR/prompt.
3. **This is part of the larger Automation Magazine Dashboard.** Every feature must fit the overall data model (categories → topics → articles → pipeline → calendar → social → SEO).
4. **Reuse KGHub components first.** Check `components/ui/`, `components/common/`, and `app/components/partials/` before creating anything new. Then check `additional-concepts/nextjs/` for pre-built concept implementations — copy relevant components into the main app, never import across the boundary.
5. **Never edit core theme files.** No edits to `components/ui/`, `components/common/`, `components/keenicons/`, `css/config.reui.css`, `css/demos/demo1.css`, or `app/components/layouts/demo1/`.
6. **Place all custom code in recommended folders.** See §10. Custom components → `components/custom/`. Feature code → `app/(protected)/[module]/`. APIs → `app/api/[module]/`.
7. **Naming and styling must stay consistent.** Use token-based Tailwind classes (`bg-background`, `text-primary`, etc.). Follow existing file-naming conventions (`content.jsx`, `components/index.js`, `hooks/use-*-query.js`).
8. **Isolate mock data.** Store mock data in `[module]/mock/` or `[module]/data/`. Never mix mock logic into hooks that will later call real APIs.
9. **Do not connect WordPress, n8n, or AI APIs** unless the milestone explicitly requests external integrations.
10. **Extend Prisma schema in `prisma/schema.prisma`.** Never alter `User`, `UserRole`, `UserPermission`, `Account`, `Session`, or `VerificationToken` models.
11. **Add menu items only in `config/menu.config.jsx`.** Use the existing menu item shape. Never hard-code navigation into components.
12. **Auth is already wired.** Do not rebuild auth. Use `useSession()` for client-side user context. Use `getServerSession()` in Route Handlers.

---

## 13. Additional Concepts — Pre-Built Reference Implementations (`additional-concepts/nextjs/`)

Located at `additional-concepts/nextjs/`. These are **standalone apps** — not mounted in the main app router. Each has its own `app/`, `components/layouts/`, `components/ui/`, and `mock/` folders. **Do not import from these directly.** Instead, copy relevant components into the main app's custom folders.

---

### Shared Patterns Across All Concepts

**Layout Pattern (identical in every concept):**
```
app/[concept]/layout.jsx          → 1s loading state → renders DefaultLayout
components/layouts/[concept]/     → applies CSS vars + providers + Wrapper
  index.jsx                       → DefaultLayout
  components/wrapper.jsx          → Sidebar + main card + optional Aside
  components/context.jsx          → LayoutProvider (isSidebarOpen, isMobile)
```

**CSS vars per concept** (set on the wrapper element, not body class):

| Concept | --sidebar-width | --aside-width | --header-height | Special |
|---|---|---|---|---|
| AI Chat | 255px | — | 60px | — |
| Todo | 250px / collapsed 60px | 320px | 60px | AI aside panel |
| Calendar | 260px | — | 60px (mobile) | Dark bg forced |
| Mail | 240px / collapsed 60px | 50px (icon strip) | — | `--mail-list-width: 400px` |
| CRM | — | 500px (extended) | — | Pinnable sidebar nav |
| Real Estate | — | — | 120px + 60px navbar | No sidebar, top-nav only |
| Store Inventory | — | — | — | Demo1 body classes (closest to main app) |

**Toolbar pattern (universal):**
```jsx
<Toolbar>
  <ToolbarHeading>
    <ToolbarPageTitle />
    <ToolbarDescription />
  </ToolbarHeading>
  <ToolbarActions>{/* buttons */}</ToolbarActions>
</Toolbar>
```

**Sheet pattern (CRM + Store Inventory):** List pages open create/edit/detail in `Sheet` overlay (slides from right), keeping the list visible. Used for all CRUD operations — no full page navigation.

---

### 13a. AI Chat (`additional-concepts/nextjs/app/ai/`)

| Item | Detail |
|---|---|
| Routes | `/ai/start` (new chat), `/ai/chat?chatId=<id>` (existing) |
| Layout | Floating card sidebar (rounded, `top/bottom/start: 2.5`) + floating main card |
| Sidebar | AI model selector dropdown, pinned chats, recent chats (with delete), quick actions |
| Chat UI | `ChatStarter` (welcome screen + persona cards) → `ChatMessages` (scrollable thread) |
| Message rendering | User bubble (primary bg, right) vs assistant bubble (muted bg, left); inline markdown parser (bold, lists, headers) |
| Message actions | Copy, ThumbsUp, ThumbsDown, Share, Regenerate, More |

**Mock data files:**
```
mock/chat-threads.js      → RECENT_CHATS: { id, title, model, timestamp, messageCount, isPinned }
mock/messages.js          → getMessagesForChat(chatId), createInitialMessages()
mock/ai-models.js         → model list with locked/upgrade flags
mock/chat-starter.js      → CHAT_STARTER_MODEL_OPTIONS
mock/model-options.js     → model selector options
```

**Key components to reuse for AI Chat Command Center:**

| Component | File | Reuse |
|---|---|---|
| `ChatStarter` | `app/ai/components/chat-starter.jsx` | Welcome/new-chat screen |
| `ChatStarterInput` | `app/ai/components/chat-starter-input.jsx` | Prompt input + model selector |
| `ChatMessages` | `app/ai/components/chat-messages.jsx` | Message thread container |
| `ChatMessage` | `app/ai/components/chat-message.jsx` | Individual message bubble |
| `AIModelSelector` | `components/layouts/ai/components/model-selector.jsx` | Model switcher dropdown |
| `PinnedChats` | `components/layouts/ai/components/pinned-chats.jsx` | Sidebar pinned list |
| `RecentChats` | `components/layouts/ai/components/recent-chats.jsx` | Sidebar recent list |
| `ShareDialog` | `components/layouts/ai/components/share-dialog.jsx` | Share chat dialog |

**UI components used:** `ScrollArea`, `Avatar`/`AvatarImage`/`AvatarFallback`/`AvatarIndicator`/`AvatarStatus`, `Button`, `Input`, `DropdownMenu`, `Separator`, `Sheet`, sonner toast

---

### 13b. Todo / Kanban (`additional-concepts/nextjs/app/todo/`)

| Item | Detail |
|---|---|
| Routes | `/todo/today`, `/todo/all-tasks`, `/todo/upcoming`, `/todo/completed`, `/todo/priority` |
| Layout | Collapsible sidebar (250px/60px) + collapsible AI aside (320px) + main content card |
| AI Aside | Embedded chat panel with streaming indicator, typing dots, `Badge` suggestion chips |
| Kanban | 3-column board (Todo / In Progress / Done) with DnD |
| Stats cards | `ProgressCard` (ProgressCircle), `HighPriorityCard`, `StreakCard` |

**Mock data files:**
```
mock/tasks.js         → initialTasks: { todo: [], inProgress: [], done: [] }, COLUMN_TITLES
mock/today.js         → initialTodayTasks: [{ priority, completed, dueDate, ... }]
mock/upcoming.js      → upcoming task list
mock/completed.js     → completed task list
mock/priority.js      → priority-filtered list
mock/priority-options.js
mock/tags.js
mock/todo-lists.js
mock/chat.js          → initialMessages, suggestions (for AI aside)
mock/focus-progress.js
```

**Key components to reuse for Tasks/Kanban:**

| Component | File | Reuse |
|---|---|---|
| Kanban board | `app/todo/all-tasks/page.jsx` | Full kanban setup with 3 columns |
| `task-column.jsx` | `app/todo/all-tasks/task-column.jsx` | Column with handle, badge, add button |
| `task-card.jsx` | `app/todo/all-tasks/task-card.jsx` | Draggable task card |
| `today/task-list.jsx` | `app/todo/today/task-list.jsx` | Checklist view |
| `today/stats-cards.jsx` | `app/todo/today/stats-cards.jsx` | ProgressCircle stats |
| AI Aside | `components/layouts/todo/components/aside.jsx` | Embedded AI chat panel |
| `SidebarTodoList` | `components/layouts/todo/components/sidebar-todo-list.jsx` | List picker in sidebar |

**UI components used:** `Kanban`/`KanbanBoard`/`KanbanColumn`/`KanbanColumnContent`/`KanbanColumnHandle`/`KanbanItem`/`KanbanItemHandle`/`KanbanOverlay`, `Card`/`CardContent`, `Badge`/`BadgeDot`, `Button`, `ScrollArea`, `Avatar`, `ProgressCircle`

---

### 13c. Calendar (`additional-concepts/nextjs/app/calendar/`)

| Item | Detail |
|---|---|
| Routes | `/calendar` (single page) |
| Layout | Dark bg (`bg-zinc-950`), sidebar always dark (`.dark` forced), no header |
| Sidebar | Mini month-picker + calendar category checklist (My calendars, Other calendars) |
| EventCalendar | Full calendar: month/week/day/agenda views + DnD |

**`EventCalendar` component** (`components/ui/calendar/event-calendar.jsx`):

| Feature | Detail |
|---|---|
| Props | `events[]`, `onEventAdd`, `onEventUpdate`, `onEventDelete`, `initialView` |
| Views | `month`, `week`, `day`, `agenda` — keyboard shortcuts: M/W/D/A |
| Navigation | Prev/Next/Today buttons + view dropdown |
| DnD | `CalendarDndProvider` wraps all views; events draggable across days |
| Event dialog | Create/edit/delete: title, description, start, end, allDay, color, location |
| Colors | `sky`, `amber`, `orange`, `emerald`, `violet`, `rose` |
| Time indicator | Live moving line in week/day views (`use-current-time-indicator.js`) |
| Toasts | Event added/moved/deleted confirmations via sonner |

**Sub-components:**
```
components/ui/calendar/
├── event-calendar.jsx       ← main export
├── month-view.jsx
├── week-view.jsx
├── day-view.jsx
├── agenda-view.jsx
├── event-dialog.jsx         ← create/edit/delete form
├── event-item.jsx
├── events-popup.jsx         ← "+N more" overflow popup
├── draggable-event.jsx
├── droppable-cell.jsx
├── calendar-dnd-context.jsx
├── constants.js
├── utils.js
└── hooks/
    ├── use-current-time-indicator.js
    └── use-event-visibility.js
```

**Key components to reuse for Editorial Calendar:**

| Component | Reuse |
|---|---|
| `EventCalendar` | Drop-in editorial calendar — wire to article publish dates |
| `EventDialog` | Repurpose for scheduling articles (add fields: article, status, readiness) |
| `SidebarCalendarMenu` | Repurpose for content category filters |
| Color coding | Map colors to article status: `sky`=draft, `amber`=review, `emerald`=ready, `rose`=overdue |

---

### 13d. Mail (`additional-concepts/nextjs/app/mail/`)

| Item | Detail |
|---|---|
| Routes | `/mail/inbox`, `/mail/sent`, `/mail/draft` |
| Layout | Sidebar (240px/60px) + icon aside (50px) + split: mail-list (400px) + mail-view |
| Compose | Full dialog: To/Cc/Bcc, Subject, Body textarea, formatting toolbar (H1-P, Bold, etc.), AI Generate |
| AI features | `AskAI` panel (Q&A inside mail view), `Generate` modal (accept/reject AI-written email) |

**Key components to reuse for Notifications/Messaging module:**

| Component | Reuse |
|---|---|
| `MailListMessages` | Notification/message list with read/unread state |
| `MailViewMessage` | Full message detail view |
| `ComposeMessage` | Content brief / assignment creation dialog |
| `SidebarLabels` | Status label navigation |
| `AskAI` | Inline AI assistant panel |

---

### 13e. CRM (`additional-concepts/nextjs/app/crm/`)

| Item | Detail |
|---|---|
| Routes | `/crm/dashboard`, `/crm/contacts`, `/crm/companies`, `/crm/company`, `/crm/tasks`, `/crm/notes` |
| Layout | Pinnable/unpinnable sidebar nav with workspace switcher |
| Nav | `AccordionMenu` with badge counts, pin/unpin context menus, hover-reveal "New" button |
| Company record | Split view: tabbed left panel (Overview/Activity/Notes/Tasks/Team/Files) + right extended panel (500px) |

**Key components to reuse:**

| CRM Component | Dashboard Equivalent | Reuse For |
|---|---|---|
| Company record split-view | Article detail view | Article editor (left) + meta/SEO panel (right) |
| `NewContactSheet` / `NewTaskSheet` pattern | Article/task creation | All sheet-based creation forms |
| `CompanyRecordsOverviewActivity` | Article activity feed | Version history, attempts, logs |
| `CompanyRecordsOverviewNotes` | Article editorial notes | Comments, reviewer notes |
| Dashboard stat cards | Pipeline dashboard stats | Article pipeline overview |
| `RecentDeals` table | Recent articles table | Article list with status |
| `TaskList` with tabs (Today/Week/Completed) | Editorial task management | Task list views |
| `NotesList` with favorites | Content notes | Pinned editorial notes |

**Mock data:**
```
crm/mock/
├── categories.js, companies.js, contacts.js, deals.js
├── deal-stage.js, connection-strengths.js
├── employee-ranges.js, estimated-arrs.js
```

---

### 13f. Store Inventory (`additional-concepts/nextjs/app/store-inventory/`)

| Item | Detail |
|---|---|
| Layout style | Closest to main app Demo1Layout (uses same `demo1 sidebar-fixed header-fixed` body classes) |
| Sidebar | Config-driven `AccordionMenu` from `app.config.jsx` (same pattern as `config/menu.config.jsx`) |
| Header | SearchBar + NotificationsSheet (20 items) + ChatSheet + AppsDropdownMenu + AvatarGroup + UserDropdownMenu |

**Key components to reuse:**

| Store Inventory Component | Dashboard Equivalent |
|---|---|
| `DataGrid` tables (all 12) | Article list, user list, log list, SEO table, social tracking table |
| `ProductFormSheet` pattern | Article creation/edit sheet |
| `CustomerDetailsSheet` with tabs | Article detail sheet (overview, versions, activity, SEO) |
| `ActivityTimeline` (in customers/) | Article activity timeline, version history |
| `OrderDetailsSheet` | Article pipeline stage detail |
| `SettingsSheet` | Dashboard settings overlay |
| `NotificationsSheet` (20 items) | Notification system reference |
| Dashboard chart widgets | Pipeline analytics, social output charts |
| `ToggleGroup` period selector | Chart period filter (used in Orders widget) |

**Tables (all `DataGrid`-based, copy column definitions):**
```
tables/product-list.jsx      → article list
tables/order-list.jsx        → pipeline/assignment list
tables/customer-list.jsx     → user list
tables/category-list.jsx     → categories list
tables/all-stock.jsx         → content inventory overview
tables/details-invoice.jsx   → billing/export reference
```

---

### Additional Concepts: Complete UI Component Inventory

The `additional-concepts/nextjs/components/ui/` contains this full set (may differ from or extend main app's `components/ui/`):

| Component | Key Exports | Dashboard Use |
|---|---|---|
| `accordion-menu.jsx` | AccordionMenu, AccordionMenuGroup, AccordionMenuItem, AccordionMenuLabel, AccordionMenuSub | Sidebar nav |
| `avatar.jsx` | Avatar, AvatarImage, AvatarFallback, **AvatarIndicator**, **AvatarStatus** | User presence indicators |
| `avatar-group.jsx` | AvatarGroup | Team assignments display |
| `badge.jsx` | Badge, **BadgeDot** | Status pills, priority dots |
| `calendar/event-calendar.jsx` | EventCalendar (full system) | Editorial calendar |
| `data-grid.jsx` | DataGrid + full TanStack Table setup | All list/table pages |
| `data-grid-table-dnd.jsx` | DnD row reordering | Article pipeline reorder |
| `file-upload.jsx` | Drag-drop file uploader | Article asset uploads |
| `kanban.jsx` | Kanban, KanbanBoard, KanbanColumn, KanbanItem, KanbanOverlay | Tasks kanban |
| `progress.jsx` | Progress, **ProgressCircle** | Readiness indicators |
| `resizable.jsx` | ResizablePanelGroup, ResizablePanel | Split views (article editor) |
| `scrollspy.jsx` | ScrollSpy | Long-form article nav |
| `toggle-group.jsx` | ToggleGroup, ToggleGroupItem | Chart period selectors |

---

## 14. Risks & Unknowns

| Risk | Detail | Mitigation |
|---|---|---|
| `@/*` dual alias | `@/` resolves to both project root AND `app/components/`. Import conflicts possible. | Always check actual path resolution; prefer explicit relative imports for ambiguous paths |
| No `middleware.ts` | Auth protection is client-side only. API routes are not server-protected by default. | Add `getServerSession()` checks in every custom Route Handler |
| Tailwind v4 (no config) | No `tailwind.config.js` means no `safelist`, no custom plugins via config. | Add custom utilities via `@layer utilities` in CSS files |
| Demo1Layout only | Only one layout is wired. demo2–demo5 page content exists but is inactive. | Do not rely on multi-layout switching unless explicitly planned |
| Prisma schema extension | New Prisma models may require migration coordination. | Always run `prisma migrate dev` on schema changes; document in milestone notes |
| S3 config | `lib/s3-client.js` expects AWS env vars. Not configured by default. | Required for any file upload feature — must set env vars in that milestone |
| i18n coverage | i18n is wired but translation files may not cover new modules. | Add translation keys to `i18n/messages/` for any user-facing text |
| No edge auth | Bots/crawlers can reach protected page HTML before client redirect fires. | Acceptable for internal tool; add `middleware.ts` if security posture changes |
| `additional-concepts` UI version drift | `components/ui/` in `additional-concepts/` may differ from main app's `components/ui/`. | Before copying a component, verify the version/API matches. Copy the component file too if needed, not just the usage. |
| `additional-concepts` not wired | These apps have their own `app/` root — they cannot be imported directly. | Always copy components into main app folder structure; never import across the `additional-concepts/` boundary. |
| Layout CSS var mismatch | Each concept uses different `--sidebar-width` values. Main app uses `demo1.css` vars. | When adapting concept layouts, map their CSS vars to `demo1.css` equivalents or use inline styles scoped to the module. |
| `EventCalendar` DnD dependency | Calendar uses `@dnd-kit` (via `calendar-dnd-context.jsx`). Main app may not have this installed. | Check `package.json` before using EventCalendar. Install `@dnd-kit/core` + `@dnd-kit/sortable` if missing. |

---

## 15. Completion Checklist

Use this checklist to verify any new module milestone is properly integrated:

- [ ] Checked `additional-concepts/nextjs/` for a matching pre-built concept to copy from
- [ ] Page file created at `app/(protected)/[module]/page.jsx`
- [ ] Route accessible under Demo1Layout (no extra layout wiring needed)
- [ ] Menu entry added to `MENU_SIDEBAR` in `config/menu.config.jsx`
- [ ] Feature components in `app/(protected)/[module]/components/`
- [ ] TanStack Query hooks in `app/(protected)/[module]/hooks/`
- [ ] Mock data in `app/(protected)/[module]/mock/` (if not connected to real API)
- [ ] API route(s) created at `app/api/[module]/route.js`
- [ ] API route(s) include `getServerSession()` auth check
- [ ] Prisma models added/migrated if required
- [ ] Only token-based Tailwind classes used (`bg-background`, `text-foreground`, etc.)
- [ ] No edits to core KGHub files
- [ ] Custom shared components placed in `components/custom/`
- [ ] Custom CSS (if any) added to `css/modules/[module].css` + imported in `styles.css`
- [ ] No WordPress / n8n / AI connections (unless milestone explicitly requires)
- [ ] Tested in both light and dark mode
- [ ] Translation keys added to `i18n/messages/` for new user-facing strings
