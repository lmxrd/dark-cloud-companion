// The predefined plans: what gets generated into data/generated/plans/ at build time (see
// scripts/planner/predefined.ts and integrations/plans.ts). One built-in guide is generated per
// target × variant — this is the file to edit.
//
//   targets    Weapon ids to plan for; the entry "finals" expands to every final-tier weapon
//              and can be mixed with explicit ids.
//   objective  abs | gilda | steps — what the optimiser minimises.
//   flow       how stages are placed on the story; ABS comes from clearing each section once.
//              progression = like the weapon guide: each stage in the earliest chapter whose items,
//              spheres, ABS and gilda (plus grindShare more) allow it, weapons on the way levelled to
//              at most levelCap (the last to finalLevelCap), abilities from spheres along the way
//              (delayCost: ABS a chapter's delay per stage is worth). story = optimise the whole
//              build first, then wait for the story's ABS; earliest = finish in the earliest chapter
//              possible, grinding what's missing.
//   itemPool   cheap = the everyday +2 items (default: Conda's Goods and Antidote Drink), crystals = plus
//              the crystals, all = anything sold.
//   route      a fixed build-up route (first weapon … target) instead of the cheapest found.
//   goal       max = maxed stats, reach = just get the weapon.
//   abilities  carried by the finished weapon, added where the chain doesn't provide them; set to
//              [] for none.
//   abilitySource  spheres = from +5 spheres of side weapons that carry them (the weapon guide's
//              recipes), coins only where none fits; cheapest = a bought coin whenever it costs
//              less (in ABS, nearly always once coins are sold). Spheda coins are a last resort.
//   maxChapter shops/items/enemy kills available up to this chapter; spBonus is the support bonus.
//
// Group settings apply to all its variants; variant settings win. Each plan's config key is
// <targetId>/<variantId> (pnpm plans takes it). The guide's own id is <targetId>-<content hash>,
// given when it is first generated and kept when it is re-generated (see plan-files.ts).
import type { PlansConfigInput } from "./plans-config.ts";

export const plansConfig = {
  defaults: {
    goal: "max",
    maxChapter: 8,
    spBonus: 1,
    abilities: ["poison", "stop", "abs-up", "steal", "wealth", "dark", "durable", "absorb"],
  },
  groups: [
    {
      // One plan per final weapon that follows the story, like the weapon guide's recipes. Island
      // King first, until the plans are right; then "finals".
      targets: ["island-king"],
      variants: [
        {
          id: "story",
          objective: "abs",
          flow: "progression",
          label: "Story",
          // The weapon guide's "evil sword" route: Poison, Absorb and Dark come with it, no slow
          // 4-hit swords before the Island King, and Griffon Fork on the way is a fine stop.
          route: [
            "bone-rapier",
            "evilcise",
            "drain-seeker",
            "sargatanas",
            "dark-excalibur",
            "griffon-fork",
            "island-king",
          ],
        },
      ],
    },
    // {
    //   // The original curated guides (formerly scripts/planner/curated.ts → src/data/guides.json):
    //   // maxed stats without the ability preset, plus a budget variant. Variant ids are kept
    //   // stable — user profiles reference them (activeGuides, tick ids).
    //   targets: [
    //     "grade-zero",
    //     "legend",
    //     "supernova",
    //     "griffon-fork",
    //     "island-king",
    //     "dark-cloud",
    //     "five-star-armlet",
    //   ],
    //   abilities: [],
    //   variants: [
    //     { id: "abs", objective: "abs", label: "Least ABS, no abilities" },
    //     {
    //       id: "budget",
    //       objective: "abs",
    //       label: "Least ABS on a budget",
    //       maxGilda: 15000,
    //     },
    //   ],
    // },
  ],
} satisfies PlansConfigInput;
