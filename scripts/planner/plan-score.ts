// Scores a generated plan so runs can be compared (the generator keeps the best of several runs and
// the committed plan). Everything is derived from the guide itself with the simulator, so a plan
// from an older generator version is scored the same way.
import { floorShares, mainItemCostAt } from "../../src/lib/planner/solve.ts";
import { deriveBuild } from "../../src/lib/guide/derive.ts";
import type { Guide } from "../../src/lib/guide/types.ts";
import { getWeapon, synthSourceByName } from "../../src/lib/planner/sources.ts";
import {
  ABS_PER_FLOOR,
  earlyAbilityCosts,
  effortWeights,
  type ProgressionOptions,
  type SavedSolution,
} from "../../src/lib/planner/plan.ts";
import { STAT_KEYS, type AbilityId } from "../../src/lib/schemas.ts";
import { buildUpBonus, OPPOSITES } from "../../src/lib/weapons/mechanics.ts";
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
  /** Story plans: what the solver minimises, recomputed from the guide (see `storyCost`). */
  cost?: number;
}

/**
 * The story objective (in ABS units, see docs/planning.md) recomputed from a guide's derived steps,
 * so committed plans and new runs are judged by what the solver trades off: effort-weighted ABS,
 * chapter delay, early stats (points times the chapters they are held), stats lost to caps, items
 * straight on the main weapon, the stat floor and build-up levels.
 */
export function storyCost(
  guide: Guide,
  prog: ProgressionOptions,
  wanted: readonly AbilityId[] = [],
  /**
   * The solver's own stages' chapters (`solverChapters`). The chapter delay is spread over the
   * solver's stages; the guide's work steps differ once split (more steps, earlier chapters), so
   * counting them instead would favour plans that split more.
   */
  stageChapters?: number[],
): number {
  const d = deriveBuild(guide);
  const work = guide.steps.filter((s) => s.build);
  let cost = 0;
  // Side weapons prepared ahead of time: their ABS in the chapter they are levelled in.
  for (const s of guide.steps) {
    if (!s.prepare) continue;
    const c = Number(s.chapterId ?? 8);
    const abs = d.steps.get(s.id)?.cost.abs ?? 0;
    cost += abs * (prog.effortPower ? effortWeights[c] ** prog.effortPower : 1);
  }
  const ids = work.map((s) => s.build!.weaponId);
  const chainWeapons = ids.filter((id, i) => i === 0 || id !== ids[i - 1]);
  const end = 8;
  let prev: Record<string, number> | undefined;
  work.forEach((s, i) => {
    const st = d.steps.get(s.id);
    if (!st) return;
    const before = prev ?? st.start?.stats ?? st.stats;
    prev = st.stats;
    const c = Number(s.chapterId ?? 8);
    const w = getWeapon(s.build!.weaponId);
    cost += st.cost.abs * (prog.effortPower ? effortWeights[c] ** prog.effortPower : 1);
    if (!stageChapters?.length) cost += (prog.delayCost * c) / work.length;
    const next = work[i + 1]?.build?.weaponId;
    // The stat floor counts where the plan leaves the weapon, and on the last step.
    const leaving = next !== w.id;
    const share = floorShares(prog, chainWeapons.lastIndexOf(w.id), chainWeapons.length);
    // Early stats: the points this step adds, once per chapter to the end of the story.
    const added = STAT_KEYS.reduce((n, k) => n + st.stats[k] - before[k], 0);
    cost -= (prog.earlyStatBonus ?? 0) * added * (end + 1 - c);
    // Stats lost to caps: what the step brings (the build-up's bonus, its spheres and items) beyond
    // what the weapon holds at its end.
    if (prog.lostStatCost) {
      const builtUp = i > 0 && ids[i] !== ids[i - 1];
      for (const k of STAT_KEYS) {
        if (k === "at") continue;
        let brought = before[k] + (builtUp ? buildUpBonus(w.baseStats[k]) : 0);
        for (const g of st.spheres) brought += g.gains[k] ?? 0;
        for (const x of s.build!.synths ?? [])
          if (x.kind === "item")
            brought += (synthSourceByName.get(x.name)?.gains[k] ?? 0) * (x.count ?? 1);
        cost += prog.lostStatCost * Math.max(0, brought - st.stats[k]);
      }
    }
    for (const k of STAT_KEYS) {
      if (leaving && prog.statFloor && prog.statFloorCost)
        cost +=
          prog.statFloorCost * Math.max(0, Math.round(share.target * w.maxStats[k]) - st.stats[k]);
      if (leaving && share.min && prog.minStatFloorCost)
        cost +=
          prog.minStatFloorCost * Math.max(0, Math.round(share.min * w.maxStats[k]) - st.stats[k]);
    }
    if (next && next !== w.id && prog.buildUpLevel)
      cost += (prog.buildUpLevelCost ?? 0) * Math.max(0, prog.buildUpLevel - st.level);
    const each = mainItemCostAt(
      i,
      work.length,
      prog.mainItemCost ?? 0,
      prog.mainItemCostLast ?? prog.mainItemCost ?? 0,
    );
    for (const x of s.build!.synths ?? []) if (x.kind === "item") cost += each * (x.count ?? 1);
  });
  if (stageChapters?.length)
    cost += (prog.delayCost * stageChapters.reduce((n, c) => n + c, 0)) / stageChapters.length;
  // Early abilities: the chapter of the first sphere bringing each wanted one, after the last
  // build-up into a weapon with the opposite (that would cancel it). Abilities a chain weapon
  // brings need no sphere.
  for (const [a, each] of Object.entries(earlyAbilityCosts(prog, wanted)) as [
    AbilityId,
    number,
  ][]) {
    if (!each || ids.some((id) => getWeapon(id).abilities.includes(a))) continue;
    const opposite = OPPOSITES[a];
    let from = 0;
    work.forEach((_, i) => {
      if (
        i > 0 &&
        ids[i] !== ids[i - 1] &&
        opposite &&
        getWeapon(ids[i]).abilities.includes(opposite)
      )
        from = i;
    });
    const first = work.findIndex(
      (s, i) => i >= from && d.steps.get(s.id)?.spheres.some((g) => g.abilities.includes(a)),
    );
    if (first >= 0) cost += each * Number(work[first].chapterId ?? 8);
  }
  return cost;
}

/** The chapter of each of the solver's stages, from its saved values (`vZ<stage>_<chapter>` = 1). */
export function solverChapters(solution?: SavedSolution): number[] | undefined {
  if (!solution) return undefined;
  const chapters: number[] = [];
  for (const [name, v] of Object.entries(solution.values)) {
    const m = name.match(/^vZ(\d+)_(\d+)$/);
    if (m && Math.round(v) === 1) chapters[Number(m[1])] = Number(m[2]);
  }
  return chapters.length && !chapters.includes(undefined as never) ? chapters : undefined;
}

export function scorePlan(guide: Guide, spec: PlanSpec, solution?: SavedSolution): PlanScore {
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
    ...(spec.flow === "progression"
      ? {
          cost: storyCost(guide, spec.progression, spec.abilities, solverChapters(solution)),
        }
      : {}),
  };
}

/**
 * Better first: valid, then (story plans) the least story cost, then the earliest finish, the least
 * earning effort (rounded to a tenth of a floor), least ABS, earliest pace, least gilda.
 */
export function compareScores(a: PlanScore, b: PlanScore): number {
  return (
    Number(a.problems.length > 0) - Number(b.problems.length > 0) ||
    (a.cost !== undefined && b.cost !== undefined ? Math.round(a.cost - b.cost) : 0) ||
    a.finish - b.finish ||
    Math.round(a.effort * 10) - Math.round(b.effort * 10) ||
    a.abs - b.abs ||
    a.pace - b.pace ||
    a.gilda - b.gilda
  );
}

export const scoreText = (s: PlanScore) =>
  `${s.problems.length ? `INVALID (${s.problems.slice(0, 3).join("; ")})` : "valid"} · ch${s.finish} · ${s.effort.toFixed(1)} floors' effort · ${Math.round(s.abs).toLocaleString("en")} ABS · ${s.gilda.toLocaleString("en")} gilda · pace ${s.pace}${s.cost === undefined ? "" : ` · cost ${Math.round(s.cost).toLocaleString("en")}`}`;
