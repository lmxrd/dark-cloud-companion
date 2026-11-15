# Dark Chronicles Companion

An unofficial companion web app for **Dark Chronicles (Dark Cloud 2)**, made to be used on a phone while playing. It is a static site: everything you track stays in your browser, and it works offline once loaded.

It is published at <https://lmxrd.github.io/dark-cloud-companion/>.

## Features

- **Dashboard** – follow your current chapter, see an overview of all chapters, or follow one guide at a time. Each chapter shows its collectables (scoops, photo ideas, inventions, power-ups, Georama, recruits, badges), medals and prizes, floor facts, missable warnings and the steps of every guide you switched on. Progress counts only the guides you switched on; the main walkthrough is on by default.
- **Guides** – the main walkthrough, built-in weapon guides and your own guides. There are two built-in guides per final weapon: a **Story** guide that follows the story (each step placed in the chapter it can be done, with the ally to bring, what each sphere passes on and the enemies a build-up needs) and a **Fastest** guide that finishes as early as possible. A weapon guide also shows as a map of its steps with each step's stats, or a detailed map of every sphere and item that goes in. Duplicate any guide to edit it; export and import your guides as JSON.
- **Tools**
  - **Planner** – an optimal weapon build from any start weapon to any end weapon (existing or custom), by least ABS, gilda or steps, with limits on chapter, gilda and items, and optionally following the story. Save the result as a guide or edit it.
  - **Shopping list** – add inventions, Georama parts, build steps or items and get one list of what to buy, grouped by shop.
  - **Synth sphere calculator** – what a filled sphere passes on.
- **Database** – a page for every weapon, item, enemy, monster, Ridepod part, shop, person, fish, invention, photo, Georama part, town, dungeon, floor and ability, linked to each other; lists to browse and compare them, and build-up maps; the Ridepod, Monster and Spheda trackers; and a search across everything.
- **Profiles** – several playthroughs side by side, with JSON export and import.

## Offline and your data

Your progress, guides and settings are stored in your browser (`localStorage`) and never leave it; export a profile from Settings to back it up or move it. After the first visit the app works offline. Database pages are saved when you open them; Settings → Offline database saves all of them at once.

## Run it yourself

```sh
pnpm install
pnpm dev
```

Node ≥ 22.12 and pnpm 10. Setting up, the checks and how the game data and built-in plans are maintained: [CONTRIBUTING.md](CONTRIBUTING.md).

### Deploying

`pnpm build` writes a static site to `dist/`; any static host works. Set `PUBLIC_SITE_URL` to the final URL: its path becomes the site's base (the GitHub Pages deploy in `.github/workflows/ci.yml` uses `/dark-cloud-companion`). Recommended headers: `Cache-Control: no-cache` for `sw.js`, long-lived caching for `_astro/*` (hashed file names), and `application/wasm` for the planner's solver file.

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) – setup, commands, checks and workflows.
- [AGENTS.md](AGENTS.md) – where things are in the code, the conventions that keep it working, and known pitfalls (written for coding agents, useful for anyone changing the code).
- [docs/planning.md](docs/planning.md) – how the weapon planner and the built-in plans work, and the measurements behind their rules.

## Credits and legal

Unofficial fan project, not affiliated with Level-5 or Sony Interactive Entertainment. Dark Cloud 2 / Dark Chronicles is © Level-5 / Sony Interactive Entertainment. The game data was cross-checked against the _Dark Cloud 2 Walkthrough_ v1.20 by Sky Render and the _Dark Cloud 2 Weapon FAQ_ v3.1 by JungleJim; none of their prose is reproduced. Licence: see [LICENSE](LICENSE).
