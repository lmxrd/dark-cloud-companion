# Contributing

Thanks for helping. Issues and pull requests are welcome: wrong or missing game data, bugs, and improvements to the guides, planner or database pages.

Read [README.md](README.md) for what the app does. Before changing code, read [AGENTS.md](AGENTS.md): it maps the code and lists the conventions every change has to keep (stored data, hydration, URL state, strings). How the planner works is in [docs/planning.md](docs/planning.md).

## Setup

Node ≥ 22.12 and pnpm 10.

```sh
pnpm install
pnpm dev
```

For readable diffs of the game database, run once:

```sh
git config diff.sqlite.textconv "echo .dump | sqlite3"
```

## Commands

```sh
pnpm dev              # dev server
pnpm build            # static site in dist/ (also writes the service worker)
pnpm preview          # serve dist/
pnpm fmt              # format (oxfmt); pnpm fix also applies lint fixes
pnpm check            # format check, lint (oxlint) and type check
pnpm typecheck        # type check only
pnpm test             # unit tests (Vitest): logic, planner, game-data rules
pnpm e2e              # end-to-end tests (Playwright, Chromium desktop and phone); builds and serves the site itself
pnpm test:all         # check, test and e2e
pnpm db:studio        # edit the game data (Drizzle Studio)
pnpm db:generate      # write a migration after changing src/db/schema.ts
pnpm db:migrate       # apply new migrations to drizzle/game.db
pnpm db:check         # broken links and cross-row rules in the game data
pnpm db:export        # write src/gamedata/ from the database (dev, build, typecheck and test do this themselves)
pnpm plans            # generate built-in plans (see below)
```

`pnpm e2e` needs a Chromium for Playwright the first time: `pnpm exec playwright install chromium`.

## Before you open a pull request

- Run `pnpm check` and `pnpm test`. Also run `pnpm e2e` when you changed UI, routing, stored data, the service worker or the planner.
- CI (`.github/workflows/ci.yml`) runs the same checks; the `main` branch deploys to GitHub Pages.
- Keep a pull request to one change, and say in its description what you could not verify (for example, something not checked in the game).
- Commit messages: one line saying what changed, in plain words.

## Game data

All game data lives in one SQLite database, `drizzle/game.db`, which is committed. The app never reads it directly: `pnpm db:export` writes JSON files into `src/gamedata/` (git-ignored), and dev, build, typecheck and test run it for you.

- Edit data with `pnpm db:studio`, then run `pnpm db:check` and `pnpm test`.
- Only facts go in: names, numbers, recipes, locations. No guide prose or advice, and nothing that can be calculated from other data.
- To change the schema, edit `src/db/schema.ts` (every column gets a doc comment), run `pnpm db:generate` and `pnpm db:migrate`, and commit the migration and `game.db` together. A test fails if they drift apart.
- If two sources disagree, say which you followed and why in the pull request.

## Built-in plans

The built-in weapon guides are plans made by the planner, committed in `data/generated/plans/`. Builds and tests never re-solve them, so a planner change does not change them by itself.

```sh
pnpm plans                         # generate the missing plans
pnpm plans <target>/<variant>      # re-solve one plan (keys are in scripts/planner/plans.config.ts)
pnpm plans --all                   # re-solve every plan
```

Options: `--runs n` (parallel solves per plan, default 2), `--jobs n` (solves at once, default 4; more at once leaves each one far less done in its time limit), `--replace` (ignore the committed plan after a change of rules) and `--new` (keep the old guide and add a new one). A plan file only changes when a run beats the committed plan. Solving takes minutes per plan. Review the guides in the app before committing them; what "better" means is in [docs/planning.md](docs/planning.md).

## Planner benchmarks

```sh
pnpm exec vite-node --config vitest.config.ts scripts/planner/bench.ts profile
pnpm exec vite-node --config vitest.config.ts scripts/planner/bench.ts start <weaponId> [root|optimal]
pnpm exec vite-node --config vitest.config.ts scripts/planner/bench-time-limits.ts [--limits 3,5,10]
```

`profile` times the heaviest realistic requests (every final weapon from its line's root weapon); `bench-time-limits.ts` compares the built-in plans at several solver time limits. Re-run them after touching the solver settings.

## What not to commit

- `.local/` (git-ignored): the source guides and working notes. Never commit text from the guides.
- Generated files: `src/gamedata/`, `src/data/plans.json`, `dist/`, test reports.
