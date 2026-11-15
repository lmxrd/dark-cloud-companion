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

| Five-Star Armlet   | Last step ABS | Prepare steps (for all its work steps) |
| ------------------ | ------------- | -------------------------------------- |
| Without            | 29,952        | –                                      |
| With prepare steps | 3,328         | ch3 2,832 · ch5 6,224 · ch6 23,040 ABS |

On the other plans the last step drops the same way (Supernova 31,037 → 2,805, LEGEND 29,064 →
832). So far only Five-Star Armlet's committed guide has them; the others get them when
regenerated (or by applying `prepareSpheresEarly` to their file).

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
valid first (simulator-clean, maxed, every wanted ability); then, for story plans, the least story
cost: the solver's objective recomputed from the guide with the plan's current settings
(`storyCost`: effort-weighted ABS, chapter delay, early stats, items on the main weapon, stat floor,
build-up levels), so a change of settings is judged fairly against the committed plan; then the
earliest finish chapter, the least earning effort, the least ABS, the earliest pace, the least
gilda. The committed file only changes when a run is better; `--replace` leaves the committed plan
out of the comparison.

Review regenerated plans in the app before committing them; `src/lib/guide/plans.test.ts` checks
that every plan is simulator-valid and reaches its goal.

## The planner page

`/tools/planner` runs the same planner in a worker: target and start, required stats, abilities
(with a help popup), item set (everyday or crystals), buyable-only, solve time (Quick 15 s,
Thorough 30 s, Best 60 s, Excellent 120 s per route; twice that when following the story), and
"Follow the story" with its story style. It starts at chapter 2 or later (Conda's Goods).
