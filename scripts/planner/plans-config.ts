// Schema and expansion for the predefined plans. The plans themselves are declared in
// plans.config.ts (typed via `PlansConfigInput`); this module validates that declaration at
// runtime and turns it into one plan spec per target × variant.
import { z } from "zod";
import { type AbilityId, abilityId } from "../../src/lib/schemas.ts";
import { finalWeaponIds } from "../../src/lib/planner/graph.ts";

const variantSchema = z.object({
  /** Becomes the guide id: <targetId>-<id>. Must be unique across all plans. */
  id: z.string().min(1),
  objective: z.enum(["abs", "gilda", "steps"]),
  /**
   * How stages are placed on the story (ABS from clearing each section once, all of it to this
   * weapon): `story` waits for the story's ABS and grinds only when it runs out; `earliest` finishes
   * in the earliest chapter possible, doing each stage as soon as it's unlocked and grinding the rest.
   */
  flow: z.enum(["earliest", "story"]).default("story"),
  label: z.string().min(1),
  maxGilda: z.number().optional(),
  maxChapter: z.number().optional(),
  abilities: z.array(abilityId).optional(),
  /** Where the abilities come from: side weapons' spheres first, or whichever is cheaper (coins). */
  abilitySource: z.enum(["spheres", "cheapest"]).optional(),
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
  id: string;
  targetId: string;
  objective: "abs" | "gilda" | "steps";
  flow: "earliest" | "story";
  label: string;
  goal: "max" | "reach";
  maxChapter: number;
  spBonus: number;
  abilities: AbilityId[];
  abilitySource: "spheres" | "cheapest";
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
        const id = `${targetId}-${v.id}`;
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
          ...(maxGilda !== undefined ? { maxGilda } : {}),
        });
      }
    }
  }
  return out;
}
