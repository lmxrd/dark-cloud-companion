// Scores a generated plan so runs can be compared (the generator keeps the best of several runs and
// the committed plan). Everything is derived from the guide itself with the simulator, so a plan
// from an older generator version is scored the same way.
import { deriveBuild } from "../../src/lib/guide/derive.ts";
import type { Guide } from "../../src/lib/guide/types.ts";
import { getWeapon } from "../../src/lib/planner/sources.ts";
import { ABS_PER_FLOOR } from "../../src/lib/planner/plan.ts";
import { STAT_KEYS } from "../../src/lib/schemas.ts";
import type { PlanSpec } from "./plans-config.ts";

export interface PlanScore {
  /** Problems that disqualify it: simulator errors, a goal it doesn't reach. */
  problems: string[];
  /** Chapter of its last step. */
  finish: number;
  abs: number;
  /** Earning effort: each step's ABS in floors' worth of its chapter (ABS / ABS per floor). */
  effort: number;
  gilda: number;
  /** Sum of the chapters of its steps: lower means the build progresses earlier. */
  pace: number;
}

export function scorePlan(guide: Guide, spec: PlanSpec): PlanScore {
  const d = deriveBuild(guide);
  const problems = [...d.errors, ...[...d.steps.values()].flatMap((s) => s.errors)];
  const final = d.final;
  if (!final || final.weaponId !== spec.targetId)
    problems.push(`does not end with ${getWeapon(spec.targetId).name}`);
  else {
    if (spec.goal === "max") {
      const max = getWeapon(spec.targetId).maxStats;
      for (const k of STAT_KEYS)
        if (final.stats[k] < max[k]) problems.push(`${k} ${final.stats[k]}/${max[k]}`);
    }
    for (const a of spec.abilities) if (!final.abilities.includes(a)) problems.push(`no ${a}`);
  }
  const chapters = guide.steps.map((s) => Number(s.chapterId ?? 8));
  const effort = guide.steps.reduce((n, s, i) => {
    const abs = d.steps.get(s.id)?.cost.abs ?? 0;
    return n + abs / (ABS_PER_FLOOR[chapters[i]] || ABS_PER_FLOOR[8]);
  }, 0);
  return {
    problems,
    finish: Math.max(0, ...chapters),
    abs: d.total.abs,
    effort,
    gilda: d.total.gilda,
    pace: chapters.reduce((n, c) => n + c, 0),
  };
}

/**
 * Better first: valid, then the earliest finish, the least earning effort (rounded to a tenth of a
 * floor), least ABS, earliest pace, least gilda.
 */
export function compareScores(a: PlanScore, b: PlanScore): number {
  return (
    Number(a.problems.length > 0) - Number(b.problems.length > 0) ||
    a.finish - b.finish ||
    Math.round(a.effort * 10) - Math.round(b.effort * 10) ||
    a.abs - b.abs ||
    a.pace - b.pace ||
    a.gilda - b.gilda
  );
}

export const scoreText = (s: PlanScore) =>
  `${s.problems.length ? `INVALID (${s.problems.slice(0, 3).join("; ")})` : "valid"} · ch${s.finish} · ${s.effort.toFixed(1)} floors' effort · ${Math.round(s.abs).toLocaleString("en")} ABS · ${s.gilda.toLocaleString("en")} gilda · pace ${s.pace}`;
