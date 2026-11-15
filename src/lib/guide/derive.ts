// Derived data for a guide's weapon-build steps. Stats, costs and requirement checks are never stored: they are
// recomputed with the rule-checking simulator so edited or imported guides always show the truth.
import type { Stats } from "@/lib/schemas";
import { simulatePlan, simulateRecipe } from "@/lib/planner/simulate";
import { getWeapon, weaponById } from "@/lib/planner/sources";
import type { Cost, Stage } from "@/lib/planner/types";
import { buildUpRequirements, type WeaponState } from "@/lib/weapons/mechanics";
import type { BuildStart, Guide } from "./types";

export function startToState(b: BuildStart): WeaponState {
  return {
    weaponId: b.weaponId,
    level: b.level,
    abs: b.abs,
    stats: { ...b.stats },
    du: b.du,
    sp: b.sp,
    abilities: [...b.abilities],
  };
}

export interface DerivedStep {
  stepId: string;
  /** Work steps: the state after the stage's levelling and synths. Build-up steps: the state just before it. */
  level: number;
  sp: number;
  stats: Stats;
  abilities: string[];
  /** Requirements of the weapon the build builds up into next, when there is one. */
  requirements?: Stats;
  /**
   * The weapon this step builds up into: a build-up step's target, or, for a work step with no
   * build-up step after it, the next work step's (other) weapon.
   */
  nextWeaponId?: string;
  /** Work steps: what each sphere synthed in the step passed on, in the step's order. */
  spheres: { weaponId: string; level: number; gains: Partial<Stats> }[];
  cost: Cost;
  errors: string[];
}

export interface DerivedBuild {
  steps: Map<string, DerivedStep>;
  total: Cost;
  /** Errors not attributable to one step (e.g. the first stage doesn't match the start weapon). */
  errors: string[];
  final?: WeaponState;
}

const noCost: Cost = { abs: 0, gilda: 0, steps: 0 };

export function deriveBuild(guide: Guide): DerivedBuild {
  const empty: DerivedBuild = { steps: new Map(), total: { ...noCost }, errors: [] };
  const buildSteps = guide.steps.filter((s) => s.build || s.buildUp);
  if (!buildSteps.length) return empty;
  if (!guide.build)
    return { ...empty, errors: ["This guide has build steps but no start weapon."] };
  for (const s of buildSteps) {
    const id = s.build?.weaponId ?? s.buildUp!.weaponId;
    if (!weaponById.has(id)) return { ...empty, errors: [`Unknown weapon "${id}".`] };
  }

  // The simulator takes the work stages; a build-up happens between two stages on different
  // weapons. An explicit build-up step must lead to the next work step's weapon; at the end of the
  // guide it gets an empty stage on its target, so the build-up still happens.
  const stages: Stage[] = [];
  const stageOf = new Map<string, number>();
  const ownErrors = new Map<string, string[]>();
  buildSteps.forEach((s, i) => {
    if (s.build) {
      stages.push(s.build);
      stageOf.set(s.id, stages.length - 1);
      return;
    }
    const target = s.buildUp!.weaponId;
    const nextWork = buildSteps.slice(i + 1).find((x) => x.build);
    if (nextWork && nextWork.build!.weaponId !== target)
      ownErrors.set(s.id, [
        `Builds up to ${getWeapon(target).name}, but the next step works on ${getWeapon(nextWork.build!.weaponId).name}.`,
      ]);
    if (!nextWork) stages.push({ weaponId: target, levelTo: 0, synths: [] });
  });
  const sim = simulatePlan(startToState(guide.build), { stages }, { spBonus: guide.build.spBonus });
  const snapshots = sim.log.filter((l) => l.type === "state" && l.depth === 0);
  // The spheres synthed onto the main weapon, per stage (a stage's log ends with its snapshot).
  const spheresByStage: DerivedStep["spheres"][] = [[]];
  for (const l of sim.log) {
    if (l.depth !== 0) continue;
    if (l.type === "sphere")
      spheresByStage.at(-1)!.push({ weaponId: l.weaponId, level: l.level, gains: l.gains });
    if (l.type === "state") spheresByStage.push([]);
  }
  const snapAt = (i: number) => {
    const snap = snapshots[i];
    return snap?.type === "state"
      ? { level: snap.level, sp: snap.sp, stats: snap.stats, abilities: snap.abilities }
      : { level: 0, sp: 0, stats: {} as Stats, abilities: [] };
  };
  /** Simulator errors about the build-up a stage ends with ("A → B: …"). */
  const isBuildUpError = (e: string) => e.includes(" → ");

  const steps = new Map<string, DerivedStep>();
  let lastStage = -1;
  buildSteps.forEach((s, i) => {
    if (s.build) {
      const at = stageOf.get(s.id)!;
      lastStage = at;
      const following = stages[at + 1]?.weaponId;
      const upgrade = following !== s.build.weaponId ? following : undefined;
      // A build-up step right after this one shows the build-up; otherwise this step does.
      const explicit = buildSteps.slice(i + 1).find((x) => x.build || x.buildUp)?.buildUp;
      const errors = sim.stages?.[at]?.errors ?? [];
      steps.set(s.id, {
        stepId: s.id,
        ...snapAt(at),
        ...(upgrade ? { requirements: buildUpRequirements(getWeapon(upgrade)) } : {}),
        ...(upgrade && !explicit ? { nextWeaponId: upgrade } : {}),
        spheres: spheresByStage[at] ?? [],
        cost: sim.stages?.[at]?.cost ?? { ...noCost },
        errors: explicit ? errors.filter((e) => !isBuildUpError(e)) : errors,
      });
      return;
    }
    const target = s.buildUp!.weaponId;
    const before = lastStage >= 0 ? snapAt(lastStage) : undefined;
    steps.set(s.id, {
      stepId: s.id,
      ...(before ?? {
        level: guide.build!.level,
        sp: guide.build!.sp,
        stats: { ...guide.build!.stats },
        abilities: [...guide.build!.abilities],
      }),
      requirements: buildUpRequirements(getWeapon(target)),
      nextWeaponId: target,
      spheres: [],
      cost: { abs: 0, gilda: 0, steps: 1 },
      errors: [
        ...(ownErrors.get(s.id) ?? []),
        ...(lastStage >= 0 ? (sim.stages?.[lastStage]?.errors ?? []).filter(isBuildUpError) : []),
      ],
    });
  });
  // Prepare steps: side weapons made ahead of time for spheres a later work step synths (marked
  // `prepared`, so the simulator didn't count them there). Each prepared sphere needs one.
  const prepCost: Cost = { ...noCost };
  const waiting = new Map<string, number>();
  const keyOf = (r: unknown) => JSON.stringify(r);
  let before = -1;
  for (const s of guide.steps) {
    if (s.build) {
      before = stageOf.get(s.id) ?? before;
      const errors: string[] = [];
      for (const u of s.build.synths) {
        if (u.kind !== "sphere" || !u.prepared) continue;
        const k = keyOf(u.recipe);
        const n = waiting.get(k) ?? 0;
        if (n > 0) waiting.set(k, n - 1);
        else {
          const last = u.recipe.stages[u.recipe.stages.length - 1];
          errors.push(
            `${getWeapon(last.weaponId).name} +${last.levelTo} sphere: no earlier step prepares it.`,
          );
        }
      }
      if (errors.length) steps.get(s.id)?.errors.push(...errors);
      continue;
    }
    if (!s.prepare) continue;
    const cost: Cost = { ...noCost };
    const errors: string[] = [];
    for (const r of s.prepare.recipes) {
      const sub = simulateRecipe(r, { spBonus: guide.build.spBonus });
      cost.abs += sub.cost.abs;
      cost.gilda += sub.cost.gilda;
      cost.steps += sub.cost.steps;
      errors.push(...sub.errors);
      waiting.set(keyOf(r), (waiting.get(keyOf(r)) ?? 0) + 1);
    }
    prepCost.abs += cost.abs;
    prepCost.gilda += cost.gilda;
    prepCost.steps += cost.steps;
    const state = before >= 0 ? snapAt(before) : undefined;
    steps.set(s.id, {
      stepId: s.id,
      ...(state ?? {
        level: guide.build.level,
        sp: guide.build.sp,
        stats: { ...guide.build.stats },
        abilities: [...guide.build.abilities],
      }),
      spheres: [],
      cost,
      errors,
    });
  }
  const unused = [...waiting.values()].reduce((n, v) => n + v, 0);
  const attributed = new Set((sim.stages ?? []).flatMap((st) => st.errors));
  // The simulator starts from an already-owned weapon; obtaining it (shop purchase, invention)
  // is part of the guide's cost when the start says how it was acquired.
  const acquire = guide.build.acquire;
  const acquireGilda =
    acquire?.kind === "shop" ? acquire.price : acquire?.kind === "invent" ? acquire.gilda : 0;
  return {
    steps,
    total: {
      abs: sim.cost.abs + prepCost.abs,
      gilda: sim.cost.gilda + prepCost.gilda + acquireGilda,
      steps: sim.cost.steps + prepCost.steps + (acquire && acquire.kind !== "have" ? 1 : 0),
    },
    errors: [
      ...sim.errors.filter((e) => !attributed.has(e)),
      ...(unused ? [`${unused} prepared side weapon(s) are never used as spheres.`] : []),
    ],
    final: sim.state,
  };
}
