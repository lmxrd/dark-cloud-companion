import type { Recipe, Stage } from "@/lib/planner/types";
import type { Step } from "./types";

/** Every item a sphere's side weapon takes, over all its stages. */
export function recipeItems(recipe: Recipe, into = new Map<string, number>()): Map<string, number> {
  for (const st of recipe.stages) stageItems(st, into);
  return into;
}

/**
 * Every item a build stage uses, the side weapons' sphere contents included (they are made as part
 * of the stage), except spheres prepared in an earlier step. Free of game data, so any component
 * can call it.
 */
export function stageItems(stage: Stage, into = new Map<string, number>()): Map<string, number> {
  for (const s of stage.synths) {
    if (s.kind === "item") into.set(s.name, (into.get(s.name) ?? 0) + s.count);
    else if (!s.prepared) recipeItems(s.recipe, into);
  }
  return into;
}

/** The items a step uses: a work step's (see `stageItems`) or a prepare step's side weapons'. */
export function stepItems(step: Step, into = new Map<string, number>()): Map<string, number> {
  if (step.build) stageItems(step.build, into);
  for (const r of step.prepare?.recipes ?? []) recipeItems(r, into);
  return into;
}

/** Whether a build stage needs any items (directly or in its spheres). */
export const stageNeedsItems = (stage: Stage | undefined) => !!stage && stageItems(stage).size > 0;

/** Whether a step needs any items (see `stepItems`). */
export const stepNeedsItems = (step: Step) => stepItems(step).size > 0;
