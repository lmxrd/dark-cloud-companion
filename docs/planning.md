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

### Rules and choices

A story plan follows fixed rules (`STORY_RULES` in `plan.ts`), the same for every plan; each was
added for a reason measured below. Only a few things are a plan's choice.

| Rule                             | Value                                                               | Why                                                   |
| -------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| Grind allowance                  | 30% of what the story pays                                          | a little grinding, not an insane amount               |
| Chapter delay (`delayCost`)      | 10,000 over all stages                                              | work happens as early as the story allows             |
| Level caps                       | +10 on the way, +15 last                                            | no over-levelling mid-game                            |
| Start weapon                     | obtainable by chapter 2                                             | the weapon is used through the story                  |
| Effort weighting (`effortPower`) | 0.5                                                                 | ABS counts by how hard it is to earn in its chapter   |
| Early stats (`earlyStatBonus`)   | 2 per point per stage                                               | stats above the floor come earlier                    |
| Items on the main weapon         | 1,000 each to halfway, then falling to 30 on the last step          | the early SP count most: a sphere is worth some gilda |
| Stat floor                       | 0.5 of the weapon's maximum (0.3 on the first), 150 per point short | every stat rises along the way                        |
| Least level before a build-up    | 3,000 per level short                                               | soft, so the planner page always gets a plan          |

| Choice                                         | Where                                        | Values                                       |
| ---------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| Route                                          | `plans.config.ts`; the planner page searches | the weapon guide's route for most plans      |
| Item set                                       | both                                         | everyday +2 items, or crystals too           |
| Least level before a build-up (`buildUpLevel`) | `plans.config.ts`                            | 4; 5 for LEGEND, Supernova, Five-Star Armlet |
| Prepare steps (`prepareSpheres`)               | `plans.config.ts`                            | Five-Star Armlet only                        |

**Which rules matter (switched off one at a time).** The solver alone varies by
about ±3% ABS between runs (same settings, re-solved), so smaller differences are noise.

| Switched off                                                     | Effect                                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Early stats                                                      | Dark Cloud 7% less ABS, but stats only just over the floor (lowest 47–56% instead of 51–97%): kept                                                                                                                       |
| Items on the main weapon                                         | the same ABS, but Island King got a stray stage with a stat at 0%: kept. At 30 each, seven plans still put a few cheap items on their first weapon, so it is now 1,000: SP matters more than a little gilda for a sphere |
| Floor cost 60 (was Grade Zero's and Five-Star Armlet's)          | within noise of 150: one value for all                                                                                                                                                                                   |
| Effort weighting in full (power 1, was the "least effort" style) | within noise on Island King and Dark Cloud, the same level pattern: removed                                                                                                                                              |
| Extra levels on built-up side weapons (`extraAuxLevels`)         | no gain (measured earlier): removed                                                                                                                                                                                      |

### What a story plan minimises

The objective adds up (in ABS-equivalent units):

| Term                        | What it does                                                  | Rule                                                                |
| --------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| ABS, weighted by **effort** | ABS spent in a chapter counts by how hard it is to earn there | `effortPower`                                                       |
| Chapter delay               | every stage one chapter later costs this much in all          | `delayCost` 10,000                                                  |
| Early stats                 | each stat point at the end of each stage is worth this        | `earlyStatBonus` 2                                                  |
| Items on the main weapon    | each costs this (its SP is gone for good)                     | `mainItemCost` 1,000, from halfway falling to `mainItemCostLast` 30 |
| Stat floor                  | each point a stat is below its floor after a stage            | `statFloorCost` 150                                                 |

**Effort.** The story pays far more ABS later: an ABS-paying floor or fight pays about 230 ABS in
chapter 2, 540 in 3, 1,100 in 4, 1,600 in 5, 1,750 in 6, 3,500 in 7. So 1,000 ABS is about four
floors of grinding in chapter 2 but a third of one in chapter 7. The weight of a chapter is its ABS
per floor relative to chapter 4 (chapter 2 ≈ 4.8, chapter 7 ≈ 0.3), raised to `effortPower`.
Without weighting (power 0) the cheapest plan levels the first weapon hard (Baselard +7) because a
level there costs few ABS, even though those ABS are slow to earn.

### Why effort power 0.5

There used to be two story styles: "balanced" (`effortPower` 0.5) and "least effort" (1, the least
earning effort, but it could leave chapters 2–3 to later with an unlevelled first weapon). Measured
on two weapons (ABS · earning effort in floors' worth · first step · stats along the route
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

Since the stat floor and the least level before a build-up, the two barely differ (within the
solver's noise on Island King and Dark Cloud), so only 0.5 is left.

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

Grade Zero and Five-Star Armlet were generated at 60; re-solved at 150 they are within the solver's
noise, so 150 is the rule for every plan, and for "Follow the story" on the planner page.

### First weapon and build-up levels

With the floor in full the first weapon is levelled hard while ABS is slow to earn (Island King:
Bone Rapier +6 for 2,880 ABS in chapter 2, then +3, +3, +2, +2, +5, +4). Two rules spread the levels
out:

- `firstStatFloor` 0.3: the floor on the first weapon (instead of 0.5);
- `buildUpLevel` 4: every weapon on the way is levelled to at least +4 before its build-up. Soft:
  each level short costs `buildUpLevelCost` (3,000 ABS), so an unusual start or target on the
  planner page still gets a plan.

| Island King        | ABS    | Effort | Levels               | Last step ABS | Finishes |
| ------------------ | ------ | ------ | -------------------- | ------------- | -------- |
| Floor 0.5          | 46,640 | 31.5   | +6 +3 +3 +2 +2 +5 +4 | 17,648        | ch7      |
| First 0.3, min. +4 | 45,792 | 24.5   | +4 +4 +4 +4 +4 +4 +2 | 15,168        | ch8      |

Over all plans: total ABS from 6% less (Five-Star Armlet) to 15% more (LEGEND); every weapon on
the way at +4 or +5 (a `+0` step is a weapon's first chapter, spheres only, levelled in the next);
stats start lower on the first weapon (16–32% of its maximum) and are about half or more after.
Supernova now finishes in chapter 8 (was 7).

### +5 before build-ups (LEGEND, Supernova, Five-Star Armlet)

These three have the costliest last steps, so they ask for +5 (`buildUpLevel: 5` in
`plans.config.ts`):

| Plan             | ABS             | Last step ABS   | Levels before build-ups | Finishes  |
| ---------------- | --------------- | --------------- | ----------------------- | --------- |
| LEGEND           | 53,896 → 49,480 | 29,424 → 29,064 | +4 → +5                 | ch7 → ch8 |
| Supernova        | 50,524 → 51,173 | 30,709 → 31,037 | +4 → +5                 | ch8 → ch7 |
| Five-Star Armlet | 53,216 → 53,528 | 32,408 → 29,952 | +4 → +5                 | ch7       |

The last step hardly shrinks: its ABS is not the final weapon's levels (LEGEND +2) but the 14–15
side weapons levelled to +5 for its spheres (mostly Moon Armlets). A weapon's stats are capped at its
maximum, and the final weapon's maximum is far above the one before, so those stat points can only
go in at the end. SP from earlier levels carries over, but it is not what the last step is short of.

### Preparing side weapons ahead of time (Five-Star Armlet so far)

The side weapons for a step's spheres don't have to be levelled in that step: they can be made as
soon as they are sold (or invented) and kept. With `prepareSpheres` (a plan setting in
`plans.config.ts`), `prepareSpheresEarly` (`src/lib/guide/prepare.ts`) moves each into a "Spheres
for …" prepare step in an earlier chapter: from chapter 2 and once it can be made (purchase, items,
build-up kills), to the chapter whose story ABS is least used by then, never past what the story
pays in that chapter. The sphere stays in its step, marked `prepared` (the simulator counts its
cost in the prepare step only), so the plan, its totals and its validity are unchanged.

| Five-Star Armlet   | Last step ABS | Prepare steps (for all its work steps) |
| ------------------ | ------------- | -------------------------------------- |
| Without            | 29,952        | –                                      |
| With prepare steps | 3,328         | ch3 2,832 · ch5 6,224 · ch6 23,040 ABS |

Tried on the others (not committed), the last step drops the same way (Supernova 31,037 → 2,805,
LEGEND 29,064 → 832, Island King 15,168 → 832).

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
  to fill): Island King 44,048 vs 43,712 ABS, no gain.
- **Free route search** for weapons with a recipe in the weapon guide: it found the guide's routes.

## Built-in plans

Configured in `scripts/planner/plans.config.ts`, keyed `<target>/<variant>`, three per final weapon:

- **Balanced** (`<target>/balanced`): follows the story by the rules above, mostly on the weapon
  guide's route (Love, Last Resort and Sigma Bazooka on the route a free search found).
- **Earliest** (`<target>/earliest`): every step as soon as the story unlocks it, grinding as much
  ABS as it takes (`earliestSteps`: the ABS grind allowance is unlimited and a chapter's delay costs
  1,000,000, more than any plan's ABS), with the story rules otherwise (items and gilda by chapter,
  the item penalty). The route is searched. Every starred weapon but Flamingo needs chapter 7 kills
  before its last build-up, so no plan can finish before chapter 7; Earliest gets there with each
  weapon built up the moment it can be.
- **Gilda max** (`<target>/gilda-max`): the best path to the maxed weapon no matter the cost, without
  the story rules: any gilda, every item on sale as of chapter 7 (gems and coins too), a free route
  search, the same abilities, the least ABS. A coin counts from the chapter it can first be won at
  Spheda, which is often before any shop sells it.

Each is committed as `data/generated/plans/<guide id>.json`
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
"Follow the story" (the story rules, at least +4 before each build-up). It starts at chapter 2 or
later (Conda's Goods).
