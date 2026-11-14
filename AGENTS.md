# Agent guide — Dark Chronicles Companion

Unofficial companion web app for Dark Chronicles (Dark Cloud 2): chapter/collectable tracking, guides, and an optimal weapon-build planner. Static site (Astro 7 SSG) with React islands, shadcn/ui (base-nova, neutral) and Tailwind v4. Everything user-specific lives in the browser (localStorage).

Read `README.md` for the overview and `.local/plan.md` for decisions, status and the backlog (`.local/` is git-ignored: it also holds the source guides, never commit those).

## Commands

```sh
pnpm dev              # astro dev  (agents: use `astro dev --background`, manage with `astro dev stop|status|logs`)
pnpm build            # static site -> dist/ (also writes dist/sw.js via integrations/pwa.mjs)
pnpm check            # oxfmt --check + oxlint        (pnpm fmt / pnpm fix to apply)
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest: logic + data cross-checks
pnpm e2e              # Playwright (Chromium, desktop + Pixel 7): builds and serves the site itself
pnpm test:all         # all of the above
pnpm db:studio        # edit the game data in drizzle/game.db (Drizzle Studio)
pnpm db:generate      # after changing src/db/schema.ts: write a migration in drizzle/
pnpm db:migrate       # apply new migrations to drizzle/game.db
pnpm db:check         # broken links and cross-row rules in drizzle/game.db
pnpm db:export        # write src/gamedata/ from drizzle/game.db (dev, build, typecheck and test do this themselves)
```

Before finishing a change run `pnpm check && pnpm typecheck && pnpm test`, plus `pnpm e2e` when UI, routing, storage, the service worker or the planner changed. Mention in your summary anything you could not verify.

## Where things are

- `src/db/schema.ts` – the game-data database schema (Drizzle, SQLite); `drizzle/` holds its migrations and `game.db`, the committed database and the single source of truth for game data. `scripts/db/` checks it and exports it (`export.ts`) into `src/gamedata/` (generated, git-ignored; shapes in `src/lib/gamedata/types.ts`), via the `integrations/gamedata.ts` Astro integration and a Vitest global setup. The app reads it through `src/lib/gamedata/` (`index.ts`: names, chapters/sections, collectables; one module per other file; floor detail and the bestiary load on demand). `src/lib/data.ts` turns it into chapters, sections, checklist items and medals; tick ids are `<kind>:<id>` (`gamedata/ticks.ts`); `gamedata/legacy-ids.json` maps the ids from before the database (state version 2, content files version 2) and must be kept.
- `src/generated/plans.json` – the built-in plans, generated (git-ignored) from `scripts/planner/plans.config.ts` whenever Astro starts or the tests run, and cached in `node_modules/.cache/dcc-plans` (see `integrations/plans.ts`): each plan by its own hash (game data, planning code and its settings), so only changed plans are solved, in parallel worker processes (`scripts/planner/predefined.ts`); a cold run takes about a minute. `src/lib/schemas.ts` – the planner's weapon/stat shapes (zod).
- `src/lib/weapons/` – pure game mechanics (ABS curve, levelling, spectrumize, build-up). Verified against the weapon FAQ's worked examples; do not "simplify" the formulas.
- `src/lib/planner/` – `simulate.ts` is the source of truth for rules; `solve.ts` builds a MILP (HiGHS wasm, `highs.ts`) per build-up chain; `plan.ts` ranks chains, solves the best, adds ability coins; `templates.ts` generates sphere-weapon templates; `worker.ts`/`client.ts` run it off the main thread.
- `src/lib/guide/` – the unified guide model (`types.ts`), generated main walkthrough (`main.ts`), derived build data (`derive.ts`, never stored), progress/dashboard helpers, legacy converters.
- `src/lib/profiles.ts` (schema v2 + migration from `profiles-v1.ts`), `src/lib/store.ts` (nanostores, persistence key `dcc:state`).
- `src/components/` – React islands (`dashboard/`, `guide/`, `guides/`, `planner/`, `items/`, `weapons/`, `minigames/`, `settings/`, `ui/` = shadcn). `src/pages/` – Astro routes; client-only pages use `client:only="react"` and read `?id=` etc.
- `scripts/` – database checks and export (`db/`), planner scripts, icon generation. `e2e/` – Playwright specs.

## Invariants and conventions

- **Game data goes in `drizzle/game.db`**, edited with `pnpm db:studio`. Only facts go in (no guide advice), and nothing that can be calculated from them is stored. Schema changes: edit `src/db/schema.ts` (every column gets a doc comment), `pnpm db:generate`, `pnpm db:migrate`, commit the migration and `game.db` together; `scripts/db/rules.test.ts` fails if they drift apart. For readable `.db` diffs run once: `git config diff.sqlite.textconv "echo .dump | sqlite3"`.
- **No guide prose in the repo.** Only facts (names, numbers, recipes, locations). Walkthrough text in the app is user-authored. Never commit `.local/`.
- **Everything is a guide** (`Guide`/`Step`/entries `text | item | section`). Weapon builds are steps with a `build` stage; stats/costs are _derived_ by the simulator when shown. Built-in guides are read-only (`kind: "builtin"`); copy with `duplicateGuide`.
- **Ticks** live in `profile.checks`: data items/medals by their own ids (shared by every guide), text entries and step ticks as `g:<guide>:<step>[:<entry>]`. Progress is always computed from _switched-on_ guides only (`profile.activeGuides`).
- **Never lose stored data.** `loadState` reports unreadable data (kept as a `dcc:state:backup-*` copy) and data from a newer version (never written over); `$storageProblem` drives the banner.
- **State is versioned.** Changing the profile shape means: bump/extend the zod schema with defaults, keep old data loading (`parseState`), add a migration test. User-supplied content (imports) must pass `content-validate.ts` before it can reach the UI.
- **Planner changes** need a simulator re-check: every plan the optimiser returns must simulate with zero errors (see `plan.test.ts`). Items: "buyable" vs "found-only" is `itemAvailability()`; the profile setting `view.buyableOnly` drives the planner.
- **i18n:** all UI strings go through `useTranslations()` / `src/i18n/en.ts`; add keys there, don't hard-code text in components. Keys are typed, so dynamic keys need `as const` casts.
- **Islands hydrate late:** server-rendered markup is clickable before React takes over. In e2e use the `go()` helper (waits for hydration). Components must not render differently on the first client render than on the server: read app state through `useAppState` / `useProfile` / `useChecks` / `useReady` (`src/lib/useAppStore.ts`), never `useStore($state)` directly; other localStorage reads need a `mounted` flag. `e2e/hydration.spec.ts` catches mismatches.
- **Navigation state lives in the URL** (`src/lib/url.ts`): tabs are paths (`/overview`, `/chapters/c3`, `/planner/editor`), filters and searches are query parameters (`useQueryChoice`, `useQueryText`), tracker jumps are the hash. Islands whose first render depends on the query or on saved data wrap their content in `<Gate>` so the server's defaults never flash on reload. Client-only islands read the URL in `useState` initializers, not effects. Open/closed groups and dialogs stay in component state.
- Formatting is oxfmt; it rewrites files (including generated Markdown), so run `pnpm fmt` after generating and don't rely on exact source text when scripting edits.
- Shell: quote Astro dynamic route paths (`'src/pages/weapons/[id].astro'`) in zsh.
- `astro preview` keeps a lock file; Playwright's config passes `--ignore-lock` and never reuses a running server so it always tests a fresh build.

## Gotchas learned the hard way

- Servers that send `Vary: Origin` break cache matching for module scripts/fonts in the service worker; `integrations/sw-template.js` matches with `ignoreVary` (covered by the offline e2e).
- The in-app/desktop browser pane cannot register service workers; use Playwright for offline checks.
- YALPS was too slow for the planner's MILP; HiGHS (wasm, ~3.4 MB) is loaded lazily and run in a worker.
- Source guides contain typos and conflicting values; the data in `game.db` was cross-checked against several guides when imported, and the disagreements are noted in `.local/import-notes.md`.

## Astro documentation

Full documentation: https://docs.astro.build

- [Routing](https://docs.astro.build/en/guides/routing/) · [Astro components](https://docs.astro.build/en/basics/astro-components/) · [Framework components](https://docs.astro.build/en/guides/framework-components/) · [Content collections](https://docs.astro.build/en/guides/content-collections/) · [Styling / Tailwind](https://docs.astro.build/en/guides/styling/) · [i18n](https://docs.astro.build/en/guides/internationalization/)
