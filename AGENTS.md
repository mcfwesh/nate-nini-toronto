# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
A single, self-contained static Progressive Web App (PWA): the "Nate & Nini Bear · Toronto" trip guide. There is **no build step, no bundler, and no in-repo backend**. The entire app is vanilla HTML/CSS/JS inside `index.html` (and an identical copy `trip-guide.html`, which is the PWA `start_url`). State lives in `localStorage`, with optional cross-device sync to an external Cloudflare Worker (`SYNC_URL` in `index.html`) that is not part of this repo.

### Running the app (development)
Serve the repo root over HTTP (a `file://` open breaks the service worker and routing):
- `python3 -m http.server 4175` from `/workspace`, then open `http://127.0.0.1:4175/` (or `/trip-guide.html`).
There is no `dev`/`start` npm script — serving static files is the dev workflow.

### Tests
- `npm run test:e2e` runs the Playwright suite in `tests/`. Playwright auto-starts `python3 -m http.server 4175` (see `playwright.config.mjs`) unless `BASE_URL` is set, and it mocks the sync Worker and seeds `localStorage` (user = "Nate").
- Requires the Chromium browser binary (installed by the update script). If a fresh VM is missing browser system libraries, run `npx playwright install --with-deps chromium`.

### Important non-obvious gotcha: tests are date-dependent
`defaultPanel()` in `index.html` picks the active day panel from the **real current date**: `getDay()` maps `5→fri`, `6→sat`, `0→sun`, else `fri`. The trip is **Aug 7–9, 2026 (Fri/Sat/Sun)**. Several e2e tests assume `#panel-fri` is the active panel, so they only pass when the current weekday maps to Friday (i.e. any day that is not Sat/Sun). **On a Saturday or Sunday — including during the trip weekend — those 4 tests fail purely because a different day panel (`sat`/`sun`) is active, not because of an environment or dependency problem.** The 2 date-independent tests (theme persistence, desktop rail) pass on any day. Do not "fix" this as an env issue.

### Lint / build
There is no linter config and no build: no lint or build commands exist in this repo.
