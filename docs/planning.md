# Weapon planning and built-in plan generation

How the weapon planner works, what the built-in "story" plans optimise, how they are generated, and
the measurements behind the settings. Code lives in `src/lib/planner/` (model and rules),
`src/lib/guide/fromPlan.ts` (plans to guides) and `scripts/planner/` (generation).

## What a plan is

A plan builds a weapon along a **route** of build-ups (Battle Wrench → True Battle Wrench → … →
Grade Zero). Each **stage** works on one weapon: level it, synth items, synth **spheres** (side
weapons levelled to at least +5 and spectrumized onto it). Between weapons the weapon is built up
once the next one's stat requirements are met (and, for some, its enemies defeated).

`simulate.ts` is the source of truth for the rules: every plan the optimiser returns is checked by
it, and the guide pages derive stats, costs and requirements from it (nothing is stored). Rules that
matter for planning:

- Levelling costs ABS that grows with the level and with the weapon (`absForNextLevel`), gives SP
  (plus 1 with the support ally for wrenches/hammers, swords and guns: Cedric, Milane, Gerald; Lin
  is only along for part of chapter 3, so armbands never get it; clubs have no ally) and Attack.
- Unused SP carries over every build-up. SP spent straight on a weapon is gone for good.
- A sphere costs the receiving weapon SP equal to its level and passes on 60% of each stat (Attack
  by its own rule) and its abilities (from +5). Opposite abilities cancel.

## The model

`solve.ts` builds a mixed-integer program per route (HiGHS, run in a worker): per stage the level,
the items and the spheres from a set of **templates** (`templates.ts`: side weapons, also built up
from cheaper ones like Battle Wrench +3 → True Battle Wrench +5). `plan.ts` ranks routes by the
continuous relaxation and solves the best few exactly; wanted abilities come from spheres of side
weapons that carry them, coins only as a fallback; finally a finished weapon a point short of its
target stats is topped up with items (levelling it for SP, to at most +5).

Exact solves stop at a time limit and keep the best plan found. Measured over all built-in plans
against 60 s per route: 10 s costs about 3% more ABS, 15 s about 2%, 30 s under 1%; below about
10 s solves often end without any plan (then one retry with 4× the time).

## Story plans

Story plans (`progression`, the built-in guides and the planner page's "Follow the story") make a
plan you can follow while playing:

- **Chapters.** Every stage gets a chapter (at most two after the earliest it can be done). It may
  only use the items, spheres, ABS and gilda available by the end of that chapter: the ABS and gilda
  from clearing each floor and fight once, plus a grind allowance (30%). No ally-dependent work
  before chapter 2, when the allies can be recruited.
- **Items.** Everyday +2 items by default (Conda's Goods, and Antidote Drink for Scale, as the
  weapon guide's recipes use); "crystals" adds the +3 crystals and Knight Boots for Attack.
- **Spheres are shells.** The model chooses what goes into each side weapon (to its SP), with an
  exact bound on the 60% transfer, so spheres carry what the main weapon needs.
- **Levels.** Weapons on the way are capped at +10, the last at +15.
- **Start.** Work on the first weapon starts in the first chapter it can (`firstStageWindow` 0);
  otherwise effort weighting can leave it unlevelled until chapter 4.
- **In-between stages.** When a build-up is locked to a later chapter (enemies not met yet), the
  weapon gets an earlier stage that already meets the next weapon's requirements, so only the
  build-up waits. In the guide it is a separate work step; the build-up is its own step.
- **Abilities** come from spheres placed where no later build-up brings the opposite.
- **Margins.** Requirements get a 1-point margin; a retry uses 3 and keeps a few SP spare.

### What a story plan minimises

The objective adds up (in ABS-equivalent units):

| Term                        | What it does                                                  | Setting             |
| --------------------------- | ------------------------------------------------------------- | ------------------- |
| ABS, weighted by **effort** | ABS spent in a chapter counts by how hard it is to earn there | `effortPower`       |
| Chapter delay               | every stage one chapter later costs this much in all          | `delayCost` 10,000  |
| Early stats                 | each stat point at the end of each stage is worth this        | `earlyStatBonus` 2  |
| Items on the main weapon    | each costs this (its SP is gone for good)                     | `mainItemCost` 30   |
| Stat floor                  | each point a stat is below its floor after a stage            | `statFloorCost` 150 |

**Effort.** The story pays far more ABS later: an ABS-paying floor or fight pays about 230 ABS in
chapter 2, 540 in 3, 1,100 in 4, 1,600 in 5, 1,750 in 6, 3,500 in 7. So 1,000 ABS is about four
floors of grinding in chapter 2 but a third of one in chapter 7. The weight of a chapter is its ABS
per floor relative to chapter 4 (chapter 2 ≈ 4.8, chapter 7 ≈ 0.3), raised to `effortPower`.
Without weighting (power 0) the cheapest plan levels the first weapon hard (Baselard +7) because a
level there costs few ABS, even though those ABS are slow to earn.

### Story styles

Two presets (`STORY_PRESETS` in `plan.ts`; `storyStyle` in `plans.config.ts`; "Story style" on the
planner page):

- **Balanced** (default, the built-in plans): `effortPower` 0.5. Works from chapter 2 without heavy
  early levelling and puts the effort where ABS comes fast.
- **Least effort**: `effortPower` 1. The least earning effort and, for some weapons, the strongest
  mid-game weapon, but it may leave chapters 2–3 to later (an unlevelled first weapon meanwhile).

Measured on two weapons (ABS · earning effort in floors' worth · first step · stats along the route
as % of the weapon's maximum):

| Dark Cloud                   | ABS    | Effort | First | Stats                                  |
| ---------------------------- | ------ | ------ | ----- | -------------------------------------- |
| Before (no effort weighting) | 33,752 | 26.8   | ch2   | 57 → 57 → 70 → 63 → 63 → 85 → 98 → 100 |
| Least effort                 | 37,312 | 14.9   | ch4   | 82 → 76 → 75 → 61 → 91 → 90 → 100      |
| Balanced                     | 39,656 | 21.8   | ch2   | 42 → 35 → 88 → 64 → 75 → 94 → 100      |

| Five-Star Armlet | ABS    | Effort | First | Stats                                  |
| ---------------- | ------ | ------ | ----- | -------------------------------------- |
| Before           | 49,752 | 33.4   | ch2   | 41 → 44 → 63 → 61 → 71 → 84 → 93 → 100 |
| Least effort     | 59,160 | 34.7   | ch2   | 55 → 44 → 70 → 69 → 98 → 100 → 100     |
| Balanced         | 51,208 | 31.0   | ch2   | 42 → 45 → 71 → 70 → 77 → 89 → 100      |

(Effort weighting in full without the stronger early-stats term skipped chapters 2–3 for both.)

### Stat floor

Without it, stats that no build-up on the route asks for wait for the end: on the Island King route
only the Evilcise build-up needs Lightning (9), so Lightning sat at 12–36% of each weapon's maximum
until Griffon Fork in chapter 8 filled it from 18 to 200 with spheres full of Scrap of Metal. Stats
carry over every build-up, so adding them late is cheapest, but the weapon is lopsided all game.

`statFloor` asks for every stat to be at least that share of the stage weapon's maximum (capped by
the final target) after each stage. It is soft: each point short costs `statFloorCost` per stage,
so early on, when SP is scarce, a stat can stay below it. At 60 per point some plans still left a
stat near 0 (LEGEND's Scale, Supernova's Charge): raising it needed extra levels whose ABS cost
more than the shortfall. At 150 every plan keeps its stats at about half of the maximum or more.

Lowest stat after each work step (% of that weapon's maximum) and total ABS:

| Plan             | No floor                          | Floor 0.5 at 150 (60 where marked)    |
| ---------------- | --------------------------------- | ------------------------------------- |
| Island King      | 44,328 · 4 28 16 14 12 91         | 46,640 · 51 62 53 54 81 98            |
| LEGEND           | 87,488 · 11 21 24 18 12 10 100 85 | 46,752 · 42 42 65 52 51 50 50 52      |
| Supernova        | 51,200 · 0 0 0 0 40 42            | 52,558 · 52 56 56 58 51 61            |
| Grade Zero       | 27,608 · 0 11 6 13 15 13 11       | 29,472 · 53 53 47 65 51 47 70 64 (60) |
| Five-Star Armlet | 56,200 · 3 2 2 12 45 68           | 56,840 · 44 40 58 45 46 73 63 (60)    |
| Love             | 45,592 · 0 0 3 2 2 1 84           | 48,144 · 38 51 52 56 56 48 100        |

Grade Zero and Five-Star Armlet use 60 (`plans.config.ts`): at 150 they cost 38,024 and 60,968 ABS
for no evener stats. The cost is part of both story styles (0.5 at 150), so "Follow the story" on
the planner page uses it too.

### First weapon and build-up levels

With the floor in full the first weapon is levelled hard while ABS is slow to earn (Island King:
Bone Rapier +6 for 2,880 ABS in chapter 2, then +3, +3, +2, +2, +5, +4). Two settings, part of both
story styles, spread the levels out:

- `firstStatFloor` 0.3: the floor on the first weapon (instead of 0.5);
- `buildUpLevel` 4: every weapon on the way is levelled to at least +4 before its build-up.

| Island King        | ABS    | Effort | Levels               | Last step ABS | Finishes |
| ------------------ | ------ | ------ | -------------------- | ------------- | -------- |
| Floor 0.5          | 46,640 | 31.5   | +6 +3 +3 +2 +2 +5 +4 | 17,648        | ch7      |
| First 0.3, min. +4 | 45,792 | 24.5   | +4 +4 +4 +4 +4 +4 +2 | 15,168        | ch8      |

Over all plans: total ABS from 6% less (Five-Star Armlet) to 15% more (LEGEND); every weapon on
the way at +4 or +5 (a `+0` step is a weapon's first chapter, spheres only, levelled in the next);
stats start lower on the first weapon (16–32% of its maximum) and are about half or more after.
Supernova now finishes in chapter 8 (was 7).

### Uneven levels are expected

Each level costs more ABS than the last and later weapons cost more per level (Baselard 16 ABS per
SP at its first level, Dark Cloud 59), and SP carries over. So plans level the early weapons until a
level costs about as much as on later ones, then only a few levels per weapon; the last weapon has
nothing after it, so it is levelled for the SP and Attack its final spheres and stats need. The
weapon guide's recipes have the same shape (Island King: +6, +5, +3, +2, +2, +2, +2).

### Rejected ideas (measured)

- **Switching main weapon mid-game** (e.g. invent a Heavy Hammer in chapter 5 instead of waiting
  for the chapter 6 kills, the old Digi Hammer as a sphere): LEGEND cost 53,800 ABS instead of
  43,384, finishing in the same chapter. A sphere keeps only 60% of the old weapon's stats.
- **Higher levels on built-up side weapons** (Battle Wrench +4/+5 before True Battle Wrench, more SP
  to fill): Island King 44,048 vs 43,712 ABS, no gain. Kept as `extraAuxLevels`, off.
- **Free route search** for weapons with a recipe in the weapon guide: it found the guide's routes.

## Built-in plans

Configured in `scripts/planner/plans.config.ts` (one story plan per final weapon, keyed
`<target>/<variant>`, mostly on the weapon guide's route; Love, Last Resort and Sigma Bazooka on the
route a free search found). Each is committed as `data/generated/plans/<guide id>.json`
(`{ name, spec, guide }`); the guide id is the target plus a hash of its first content and never
changes. Builds and tests only assemble the files into `src/data/plans.json`; they never re-solve.

Generating (`scripts/planner/predefined.ts`):

```sh
pnpm plans                              # configured plans that have no file yet
pnpm plans island-king/story            # re-solve one (same id)
pnpm plans --all                        # re-solve every plan
pnpm plans --all --runs 3               # more runs per plan (default 2)
pnpm plans --all --replace              # after changing settings: take the best new run
pnpm plans island-king/story --new      # a new guide next to the old one (new id)
```

Each plan is solved `--runs` times in parallel worker processes (120 s per route; runs differ a
little). The runs and the committed plan are scored (`plan-score.ts`) and the best is kept:
valid first (simulator-clean, maxed, every wanted ability), then the earliest finish chapter, the
least earning effort, the least ABS, the earliest pace, the least gilda. The committed file only
changes when a run is better; `--replace` leaves the committed plan out of the comparison.

Review regenerated plans in the app before committing them; `src/lib/guide/plans.test.ts` checks
that every plan is simulator-valid and reaches its goal.

## The planner page

`/tools/planner` runs the same planner in a worker: target and start, required stats, abilities
(with a help popup), item set (everyday or crystals), buyable-only, solve time (Quick 15 s,
Thorough 30 s, Best 60 s, Excellent 120 s per route; twice that when following the story), and
"Follow the story" with its story style. It starts at chapter 2 or later (Conda's Goods).
