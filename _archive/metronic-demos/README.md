# Metronic demo routes (archived from navigation)

The main sidebar (`config/menu.config.jsx` → `MENU_SIDEBAR`) is scoped to the **Automation Magazine Dashboard** under `/dashboard/*`.

**Metronic’s stock demo pages remain in the App Router** so theme upgrades stay mergeable, but they are **not** linked from the product navigation after Milestone 1.

## Demo route groups (not in product menu)

- `/` — original Metronic “Light Sidebar” home (`app/(protected)/page.jsx`)
- `/dark-sidebar` — dark sidebar demo
- `/public-profile/**` — profile & campaign demos
- `/network/**` — user card/table demos
- `/account/**` — My Account variants
- `/store-client/**`, `/store-admin/**` — e-commerce demos
- `/i18n-test` — i18n test page
- `/user-management/*` — **still functional** Metronic user CRUD; linked from our `/dashboard/users` for admins who need the full module

## Policy

- **Do not delete** these routes unless a Metronic upgrade explicitly removes them.
- **Do not** add them back to `MENU_SIDEBAR` without product approval.
- New product work belongs under `app/(protected)/dashboard/`.

## Optional re-archive

If you need a physical file tree of demos under `_archive/`, **copy** (do not move) after locking imports — moving breaks relative paths. Navigation-only hiding (current approach) is the safest default.
