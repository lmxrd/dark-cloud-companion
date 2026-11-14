// The predefined plans: what gets generated into data/generated/plans/ at build time (see
// scripts/planner/predefined.ts and integrations/plans.ts). One built-in guide is generated per
// target × variant — this is the file to edit.
//
//   targets    Weapon ids to plan for; the entry "finals" expands to every final-tier weapon
//              and can be mixed with explicit ids.
//   objective  abs | gilda | steps — what the optimiser minimises.
//   flow       how stages are placed on the story; ABS comes from clearing each section once and all
//              of it goes to the weapon being built. story = wait for the story's ABS, grind only
//              when it runs out; earliest = finish in the earliest chapter possible, each stage as
//              soon as it's unlocked, grinding what's missing.
//   goal       max = maxed stats, reach = just get the weapon.
//   abilities  carried by the finished weapon, added where the chain doesn't provide them; set to
//              [] for none.
//   abilitySource  spheres = from +5 spheres of side weapons that carry them (the weapon guide's
//              recipes), coins only where none fits; cheapest = a bought coin whenever it costs
//              less (in ABS, nearly always once coins are sold). Spheda coins are a last resort.
//   maxChapter shops/items/enemy kills available up to this chapter; spBonus is the support bonus.
//
// Group settings apply to all its variants; variant settings win. Variant ids must be unique
// across all plans (guide id = <targetId>-<variantId>).
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
      targets: ["finals", "falcon"],
      variants: [
        { id: "max-abs", objective: "abs", flow: "story", label: "Least ABS, spheres" },
        { id: "earliest", objective: "abs", flow: "earliest", label: "Earliest, spheres" },
        {
          id: "max-abs-coins",
          objective: "abs",
          flow: "story",
          abilitySource: "cheapest",
          label: "Least ABS, coins",
        },
        {
          id: "earliest-coins",
          objective: "abs",
          flow: "earliest",
          abilitySource: "cheapest",
          label: "Earliest, coins",
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
