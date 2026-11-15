// Solves one predefined plan (see plans.config.ts) into a built-in guide: the planner run (with the
// Earliest chapter search), the placement on the story and the guide text. Used by predefined.ts and
// the planner benches.
import { planResultToGuide } from "../../src/lib/guide/fromPlan.ts";
import { guide as guideSchema, type Guide } from "../../src/lib/guide/types.ts";
import { planPath, type PlanResult } from "../../src/lib/planner/plan.ts";
import { placeResult, storyGilda } from "../../src/lib/planner/timeline.ts";
import { names } from "../../src/lib/gamedata/index.ts";
import { getWeapon, weaponData } from "../../src/lib/planner/sources.ts";
import { freshState } from "../../src/lib/weapons/mechanics.ts";
import type { PlanSpec } from "./plans-config.ts";

const killChapter = new Map(weaponData.killEnemies.map((e) => [e.name, e.chapter]));

/**
 * The earliest chapter a plan can possibly finish in: the target's own kill requirements. (Abilities
 * no longer bound it: side weapons that carry them come before coins.) Searching below it would be
 * wasted solves.
 */
function earliestPossibleChapter(spec: PlanSpec): number {
  const target = getWeapon(spec.targetId);
  return Math.max(1, ...target.requiresKills.map((e) => killChapter.get(e) ?? 8));
}

/** Solves one configured plan into a guide; `timeLimitSec` bounds each exact solve (wall clock). */
export async function planOne(
  spec: PlanSpec,
  // 30 s per exact solve: within about 0.6% of 60 s across all plans (see bench-time-limits.ts).
  timeLimitSec = 30,
): Promise<{ guide: Guide; log: string; result: PlanResult }> {
  const target = getWeapon(spec.targetId);
  const solve = (maxChapter: number) =>
    planPath({
      // optimalStart picks the cheapest acquirable weapon in the line; the start field is unused.
      start: freshState(target),
      optimalStart: true,
      targetId: spec.targetId,
      objective: spec.objective,
      goal: spec.goal === "max" ? { kind: "max" } : { kind: "reach" },
      maxChapter,
      spBonus: spec.spBonus,
      // Never spend more than the story has paid out by the end of the chapter (unless any gilda goes).
      maxGilda: spec.anyGilda
        ? (spec.maxGilda ?? Infinity)
        : Math.min(spec.maxGilda ?? Infinity, storyGilda(maxChapter)),
      abilities: spec.abilities,
      abilitySource: spec.abilitySource,
      itemPool: spec.itemPool,
      ...(spec.flow === "progression" ? { progression: spec.progression } : {}),
      // Generation is one-off, so let the exact solves run longer than the interactive default.
      timeLimitSec: spec.timeLimitSec ?? timeLimitSec,
      ...(spec.exactChains !== undefined ? { exactChains: spec.exactChains } : {}),
      ...(spec.route ? { route: spec.route } : {}),
    });
  const complete = (r: PlanResult) => r.status === "ok" && !r.abilitiesMissing?.length;
  let result = await solve(spec.maxChapter);
  if (spec.flow === "earliest" && complete(result)) {
    // The earliest chapter whose content is enough to finish (more chapters never hurt).
    let lo = Math.min(earliestPossibleChapter(spec), spec.maxChapter);
    let hi = spec.maxChapter;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const r = await solve(mid);
      if (complete(r)) {
        hi = mid;
        result = r;
      } else lo = mid + 1;
    }
  }
  if (result.status !== "ok")
    throw new Error(
      `${spec.id}: planning failed (${result.status}${result.message ? `: ${result.message}` : ""})`,
    );
  if (result.abilitiesMissing?.length)
    throw new Error(`${spec.id}: missing abilities ${result.abilitiesMissing.join(", ")}`);
  const stages = result.plan!.stages;
  // Following the story, each stage stays in the chapter the planner put it in.
  const placement = placeResult(result, spec.flow === "progression" ? "story" : spec.flow);
  const done = placement.at(-1)!;
  const grind = placement.reduce((n, p) => n + p.grindAbs, 0);
  const farm = placement.reduce((n, p) => n + p.grindGilda, 0);
  const start = freshState(getWeapon(stages[0].weaponId));
  const cost = result.simulation!.cost;
  const startName = getWeapon(start.weaponId).name;
  const description = [
    spec.label,
    spec.goal === "max" ? "maxed stats" : "reach the weapon",
    ...(spec.abilities.length
      ? [
          `${spec.abilities.length} abilities (${spec.abilitySource === "spheres" ? "side-weapon spheres first" : "cheapest of spheres and coins"})`,
        ]
      : []),
    `optimal start (${startName})`,
    `done after ${names.sections[done.sectionId]} (chapter ${done.chapter})`,
    grind ? `${grind.toLocaleString("en")} ABS to grind` : "no ABS grinding",
    ...(farm ? [`${farm.toLocaleString("en")} gilda to farm`] : []),
  ].join(" · ");
  const guide = guideSchema.parse(
    planResultToGuide({
      id: spec.id,
      title: `${target.name} — ${spec.label}`,
      description,
      kind: "builtin",
      result,
      start,
      spBonus: spec.spBonus,
      acquire: result.acquire,
      createdAt: 0,
      placement,
      prepareSpheres: !!spec.prepareSpheres,
    }),
  );
  const log = `${spec.id} — from ${startName} · ${cost.abs} ABS · ${cost.gilda} gilda · ${cost.steps} steps · done ch${done.chapter} ${done.sectionId} · grind ${grind} ABS / ${farm} gilda`;
  return { guide, log, result };
}
