// Schema and expansion for the predefined plans. The plans themselves are declared in
// plans.config.ts (typed via `PlansConfigInput`); this module validates that declaration at
// runtime and turns it into one plan spec per target × variant.
import { z } from "zod";
import { type AbilityId, abilityId } from "../../src/lib/schemas.ts";
import { finalWeaponIds } from "../../src/lib/planner/graph.ts";
import { STORY_DEFAULTS } from "../../src/lib/planner/plan.ts";

const variantSchema = z.object({
  /** With the target, the plan's config key <targetId>/<id> (unique; the guide id is a hash, see plan-files.ts). */
  id: z.string().min(1),
  objective: z.enum(["abs", "gilda", "steps"]),
  /**
   * How stages are placed on the story (ABS from clearing each section once, all of it to this
   * weapon): `story` waits for the story's ABS and grinds only when it runs out; `earliest` finishes
   * in the earliest chapter possible, doing each stage as soon as it's unlocked and grinding the rest.
   */
  flow: z.enum(["earliest", "story", "progression"]).default("story"),
  label: z.string().min(1),
  maxGilda: z.number().optional(),
  maxChapter: z.number().optional(),
  abilities: z.array(abilityId).optional(),
  /** Where the abilities come from: side weapons' spheres first, or whichever is cheaper (coins). */
  abilitySource: z.enum(["spheres", "cheapest"]).optional(),
  /** Which bought items may be synthed: cheap +2 items (default), plus +3 crystals, or all. */
  itemPool: z.enum(["cheap", "crystals", "all"]).optional(),
  /** For the `progression` flow; see ProgressionOptions in src/lib/planner/plan.ts. */
  grindShare: z.number().optional(),
  delayCost: z.number().optional(),
  levelCap: z.number().optional(),
  finalLevelCap: z.number().optional(),
  startBy: z.number().optional(),
  /** Reward per stat point per stage for stats gained earlier (default 0.5; 0: off). */
  earlyStatBonus: z.number().optional(),
  /** ABS each item synthed straight onto the main weapon counts as (its SP is gone; default 30). */
  mainItemCost: z.number().optional(),
  /** A fixed build-up route (first weapon … target) instead of searching for one. */
  route: z.array(z.string()).optional(),
  /** Also offer built-up spheres with their earlier weapons this many levels higher (default 0). */
  extraAuxLevels: z.number().optional(),
  /** Routes solved exactly, and seconds per exact solve (story plans are generated once: be thorough). */
  exactChains: z.number().optional(),
  timeLimitSec: z.number().optional(),
});

const groupSchema = z.object({
  /** Weapon ids to plan for; the entry "finals" expands to every final-tier weapon and can be mixed with ids. */
  targets: z.array(z.union([z.literal("finals"), z.string().min(1)])).min(1),
  variants: z.array(variantSchema).min(1),
  maxGilda: z.number().optional(),
  maxChapter: z.number().optional(),
  abilities: z.array(abilityId).optional(),
});

const configSchema = z.object({
  defaults: z.object({
    goal: z.enum(["max", "reach"]).default("max"),
    maxChapter: z.number().default(8),
    spBonus: z.number().default(1),
    abilities: z.array(abilityId).default([]),
  }),
  groups: z.array(groupSchema).min(1),
});

/** What plans.config.ts must satisfy (editor-checked), before defaults are filled in. */
export type PlansConfigInput = z.input<typeof configSchema>;
export type PlansConfig = z.output<typeof configSchema>;

/** Runtime check of the config — the static type does not catch everything (e.g. a bad merge). */
export function parsePlansConfig(config: unknown): PlansConfig {
  return configSchema.parse(config);
}

/** One plan per target × variant; variant settings win over group settings over defaults. */
export interface PlanSpec {
  /** Config key: <targetId>/<variant id>. */
  id: string;
  targetId: string;
  objective: "abs" | "gilda" | "steps";
  flow: "earliest" | "story" | "progression";
  label: string;
  goal: "max" | "reach";
  maxChapter: number;
  spBonus: number;
  abilities: AbilityId[];
  abilitySource: "spheres" | "cheapest";
  itemPool: "cheap" | "crystals" | "all";
  /** Settings for the `progression` flow. */
  progression: {
    grindShare: number;
    delayCost: number;
    levelCap: number;
    finalLevelCap: number;
    startBy: number;
    earlyStatBonus: number;
    mainItemCost: number;
  };
  /** A fixed build-up route (first weapon … target). */
  route?: string[];
  extraAuxLevels?: number;
  /** Routes solved exactly and seconds per exact solve (undefined: the planner's defaults). */
  exactChains?: number;
  timeLimitSec?: number;
  maxGilda?: number;
}

export function expandPlans(config: PlansConfig): PlanSpec[] {
  const out: PlanSpec[] = [];
  const seen = new Set<string>();
  for (const group of config.groups) {
    // "finals" expands to every final-tier weapon and can sit alongside explicit ids;
    // duplicates (e.g. "finals" plus an id that is already final) collapse to one plan.s
    const targets = [
      ...new Set(group.targets.flatMap((t) => (t === "finals" ? finalWeaponIds : [t]))),
    ];
    for (const targetId of targets) {
      for (const v of group.variants) {
        const id = `${targetId}/${v.id}`;
        if (seen.has(id)) throw new Error(`duplicate plan id: ${id}`);
        seen.add(id);
        const maxGilda = v.maxGilda ?? group.maxGilda;
        out.push({
          id,
          targetId,
          objective: v.objective,
          flow: v.flow,
          label: v.label,
          goal: config.defaults.goal,
          maxChapter: v.maxChapter ?? group.maxChapter ?? config.defaults.maxChapter,
          spBonus: config.defaults.spBonus,
          abilities: v.abilities ?? group.abilities ?? config.defaults.abilities,
          abilitySource: v.abilitySource ?? "spheres",
          itemPool: v.itemPool ?? "cheap",
          progression: {
            grindShare: v.grindShare ?? STORY_DEFAULTS.grindShare,
            delayCost: v.delayCost ?? STORY_DEFAULTS.delayCost,
            levelCap: v.levelCap ?? STORY_DEFAULTS.levelCap,
            finalLevelCap: v.finalLevelCap ?? STORY_DEFAULTS.finalLevelCap,
            startBy: v.startBy ?? STORY_DEFAULTS.startBy,
            earlyStatBonus: v.earlyStatBonus ?? STORY_DEFAULTS.earlyStatBonus!,
            mainItemCost: v.mainItemCost ?? STORY_DEFAULTS.mainItemCost!,
          },
          ...(v.route ? { route: v.route } : {}),
          ...(v.extraAuxLevels ? { extraAuxLevels: v.extraAuxLevels } : {}),
          ...(v.flow === "progression"
            ? { exactChains: v.exactChains ?? 6, timeLimitSec: v.timeLimitSec ?? 120 }
            : {
                ...(v.exactChains !== undefined ? { exactChains: v.exactChains } : {}),
                ...(v.timeLimitSec !== undefined ? { timeLimitSec: v.timeLimitSec } : {}),
              }),
          ...(maxGilda !== undefined ? { maxGilda } : {}),
        });
      }
    }
  }
  return out;
}
