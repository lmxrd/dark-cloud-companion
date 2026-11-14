import type { Stage } from "@/lib/planner/types";

/**
 * Every item a build stage uses, the side weapons' sphere contents included (they are made as part
 * of the stage). Free of game data, so any component can call it.
 */
export function stageItems(stage: Stage, into = new Map<string, number>()): Map<string, number> {
  for (const s of stage.synths) {
    if (s.kind === "item") into.set(s.name, (into.get(s.name) ?? 0) + s.count);
    else for (const st of s.recipe.stages) stageItems(st, into);
  }
  return into;
}

/** Whether a build stage needs any items (directly or in its spheres). */
export const stageNeedsItems = (stage: Stage | undefined) => !!stage && stageItems(stage).size > 0;
