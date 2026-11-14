// Top-level planner: enumerates build-up chains from the start weapon to the target, ranks them with the
// LP relaxation, solves the best few exactly, and verifies the winner with the rule-checking simulator.
import type { AbilityId, Stats } from "@/lib/schemas";
import { freshState, OPPOSITES, type WeaponState } from "@/lib/weapons/mechanics";
import { itemCandidates } from "./candidates";
import { simulatePlan, type SimOptions } from "./simulate";
import { solveChain, type Objective, type SolveResult, type Template } from "./solve";
import { ancestorsOf, rootWeaponIds } from "./graph";
import { acquisitionOptions, coinChapter, coinFor, getWeapon, weaponData } from "./sources";
import { generateTemplates } from "./templates";
import type { Acquire, Cost, Plan, SimulationResult } from "./types";

export type Goal =
  | { kind: "reach" }
  | { kind: "max" }
  | { kind: "stats"; stats: Partial<Stats>; level?: number };

export interface PlanRequest {
  start: WeaponState;
  /** Search every acquirable ancestor of the target for the cheapest starting weapon (ignores `start`). */
  optimalStart?: boolean;
  targetId: string;
  objective: Objective;
  goal: Goal;
  /** Content available up to and including this chapter (shops, items, enemy kills). */
  maxChapter: number;
  /** Extra SP per level from the matching support character. */
  spBonus: number;
  allowFound?: boolean;
  /** Optional cap on gilda spent on items and sphere weapons. */
  maxGilda?: number;
  /** Abilities the finished weapon should carry, added at the end where the chain doesn't provide them. */
  abilities?: AbilityId[];
  /** Where those abilities come from (default `spheres`); see {@link AbilitySource}. */
  abilitySource?: AbilitySource;
  /** Number of chains to solve exactly (the best by LP bound). */
  exactChains?: number;
  timeLimitSec?: number;
  /** Sphere recipes to choose from; built on the fly (and cached) when not given. */
  templates?: Template[];
}

/**
 * Where a plan's abilities come from. `spheres`: +5 spheres of side weapons that carry them, as the
 * weapon guide's recipes do, with coins only where no sphere fits. `cheapest`: a bought coin instead
 * whenever it costs less for the objective than the cheapest such sphere (in ABS a coin costs
 * nothing, so it nearly always wins once coins are on sale). Either way coins that can only be won
 * at Spheda are a last resort.
 */
export type AbilitySource = "spheres" | "cheapest";

/** Coarse progress reported while planning (phases run in this order). */
export interface PlanProgress {
  phase: "templates" | "rank" | "solve" | "finish";
  done: number;
  total: number;
}

export interface ChainOutcome {
  chain: string[];
  cost?: Cost;
  /** LP lower bound used for ranking. */
  bound?: number;
  status: SolveResult["status"] | "skipped";
}

export interface PlanResult {
  status: "ok" | "no-path" | "infeasible";
  chain?: string[];
  plan?: Plan;
  simulation?: SimulationResult & { state: WeaponState };
  alternatives: ChainOutcome[];
  message?: string;
  /** How the winning start weapon was obtained; roots are "have". Its price is in the plan's cost. */
  acquire?: Acquire;
  /** Requested abilities that could not be provided (coin not yet available, or SP ran out). */
  abilitiesMissing?: AbilityId[];
}

const enemyChapter = new Map(weaponData.killEnemies.map((e) => [e.name, e.chapter ?? 8]));

/** Gilda needed to obtain a weapon through an acquire (roots cost nothing). */
const acquireGilda = (a: Acquire) =>
  a.kind === "shop" ? a.price : a.kind === "invent" ? a.gilda : 0;

/** Player actions needed before the weapon can be worked on (roots are already owned). */
const acquireSteps = (a: Acquire) => (a.kind === "have" ? 0 : 1);

/** Acquisition cost added to an LP bound or simulated cost, in `SolveResult.value` units. */
function acquireOffset(a: Acquire, objective: Objective): number {
  const gilda = acquireGilda(a);
  if (objective === "gilda") return gilda;
  if (objective === "abs") return gilda / 1000;
  return acquireSteps(a);
}

export interface StartOption {
  weaponId: string;
  /** How the weapon is obtained: roots are assumed owned, others are bought or invented. */
  acquire: Acquire;
}

/**
 * Every weapon the optimal-start search may begin from: the target's build-up roots (assumed already
 * owned, like Max's starting wrench) plus every ancestor that can be bought or invented by
 * `maxChapter`, each with its cheapest available acquisition. The target itself counts when it is
 * acquirable, so buying it outright can win.
 */
export function startOptions(targetId: string, maxChapter: number): StartOption[] {
  const out: StartOption[] = [];
  for (const id of ancestorsOf(targetId)) {
    if (rootWeaponIds.has(id)) {
      out.push({ weaponId: id, acquire: { kind: "have" } });
      continue;
    }
    const best = acquisitionOptions(id)
      .filter((a) => a.kind !== "have" && a.chapter <= maxChapter)
      .reduce<Acquire | undefined>(
        (best, a) => (!best || acquireGilda(a) < acquireGilda(best) ? a : best),
        undefined,
      );
    if (best) out.push({ weaponId: id, acquire: best });
  }
  return out;
}

/** Chain enumeration caps for the optimal-start search: enough per start, bounded overall. */
const CHAINS_PER_START = 12;
const MAX_RANKED_CHAINS = 48;

/**
 * Relative gap accepted by the exact solves. High-tier chains prove optimality to 0.1% only after tens
 * of seconds; at 1% the same plans come back in well under a second each. Costs are in-game estimates,
 * so a sub-1% difference is not player-visible.
 */
const EXACT_GAP = 0.01;

/** All build-up chains start→target whose kill requirements are reachable by `maxChapter`. */
export function findChains(
  startId: string,
  targetId: string,
  maxChapter: number,
  limit = 40,
): string[][] {
  const out: string[][] = [];
  const walk = (id: string, path: string[]) => {
    if (out.length >= limit) return;
    if (id === targetId) {
      out.push(path);
      return;
    }
    for (const next of getWeapon(id).buildsUpTo) {
      const w = getWeapon(next);
      if (!w.requiresKills.every((e) => (enemyChapter.get(e) ?? 8) <= maxChapter)) continue;
      walk(next, [...path, next]);
    }
  };
  walk(startId, [startId]);
  return out;
}

/** Spheres usable for the abilities: available by then and carrying nothing that cancels a wanted one. */
function usableSpheres(
  spheres: AbilitySphere[],
  wanted: AbilityId[],
  maxChapter: number,
): AbilitySphere[] {
  return spheres.filter(
    (s) =>
      s.template.chapter <= maxChapter &&
      !s.abilities.some((x) => OPPOSITES[x] && wanted.includes(OPPOSITES[x]!)),
  );
}

/** Whether to take a bought coin for `ability` rather than a sphere (see {@link AbilitySource}). */
function coinFirst(
  ability: AbilityId,
  source: AbilitySource,
  usable: AbilitySphere[],
  objective: Objective,
  maxChapter: number,
): boolean {
  if (source !== "cheapest") return false;
  const coin = coinFor(ability);
  if (!coin || coin.fromChapter === undefined || coin.fromChapter > maxChapter) return false;
  const coinCost = objective === "gilda" ? (coin.price ?? 0) : objective === "steps" ? 1 : 0;
  const best = usable
    .filter((s) => s.abilities.includes(ability))
    .map((s) =>
      objective === "gilda"
        ? s.template.gilda
        : objective === "steps"
          ? s.template.level
          : s.template.abs,
    );
  return !best.length || coinCost <= Math.min(...best);
}

/**
 * Gives the finished weapon every wanted ability: from side weapons that carry it (synthed as +5
 * spheres onto the last stage, as the weapon guide's recipes do) or from coins, as `source` says;
 * coins also where no sphere is available or its SP doesn't fit, Spheda-only coins last.
 */
function addAbilities(
  start: PlanRequest["start"],
  plan: Plan,
  wanted: AbilityId[],
  maxChapter: number,
  opts: SimOptions,
  spheres: AbilitySphere[],
  objective: Objective,
  source: AbilitySource,
  /** Gilda the plan may still spend on top of what `plan` costs (undefined: no limit). */
  gildaLeft: number | undefined,
): { plan: Plan; missing: AbilityId[] } {
  const usable = usableSpheres(spheres, wanted, maxChapter);
  let next: Plan = structuredClone(plan);
  const lastOf = (p: Plan) => p.stages[p.stages.length - 1];
  const baseGilda = simulatePlan(start, next, opts).cost.gilda;
  const missing: AbilityId[] = [];
  const triedSphere = new Set<AbilityId>();
  const coinsUsed = new Map<AbilityId, number>();
  const cost = sphereCost(objective);
  for (let guard = 0; guard < 48; guard++) {
    const sim = simulatePlan(start, next, opts);
    const spent = sim.cost.gilda - baseGilda;
    const need = wanted.filter((a) => !sim.state.abilities.includes(a) && !missing.includes(a));
    if (!need.length) break;
    const a = need[0];
    if (!triedSphere.has(a) && !coinFirst(a, source, usable, objective, maxChapter)) {
      triedSphere.add(a);
      // Spheres that carry the ability (and nothing that would cancel a wanted one); the ones that
      // also bring other missing abilities first, then the cheapest.
      const options = usable
        .filter((s) => s.abilities.includes(a))
        .filter((s) => gildaLeft === undefined || spent + s.template.gilda <= gildaLeft)
        .sort(
          (x, y) =>
            y.abilities.filter((z) => need.includes(z)).length -
              x.abilities.filter((z) => need.includes(z)).length || cost(x, y),
        );
      let placed = false;
      for (const option of options) {
        const trial = structuredClone(next);
        lastOf(trial).synths.push({
          kind: "sphere",
          recipe: structuredClone(option.template.recipe),
        });
        if (!simulatePlan(start, trial, opts).errors.length) {
          next = trial;
          placed = true;
          break;
        }
      }
      if (placed) continue;
    }
    const coin = coinFor(a);
    const when = coinChapter(a);
    // A coin can cancel an opposite ability first, so up to two coins per ability may be needed.
    if (!coin || !when || when.chapter > maxChapter || (coinsUsed.get(a) ?? 0) >= 2) {
      missing.push(a);
      continue;
    }
    coinsUsed.set(a, (coinsUsed.get(a) ?? 0) + 1);
    const last = lastOf(next);
    const existing = last.synths.find((s) => s.kind === "item" && s.name === coin.name);
    if (existing && existing.kind === "item") existing.count++;
    else last.synths.push({ kind: "item", name: coin.name, count: 1 });
  }
  return { plan: next, missing };
}

/**
 * SP and gilda to set aside for the abilities: the coins (1 SP each) and spheres `addAbilities`
 * would likely use (spheres covering the most missing abilities first, then the cheapest). Abilities
 * the chain's weapons carry themselves need nothing. Estimating it up front saves re-solving the
 * whole chain with ever larger reserves.
 */
function abilityReserve(
  chain: string[],
  wanted: AbilityId[],
  spheres: AbilitySphere[],
  maxChapter: number,
  objective: Objective,
  source: AbilitySource,
): { sp: number; gilda: number } {
  const carried = new Set(chain.flatMap((id) => getWeapon(id).abilities));
  const usable = usableSpheres(spheres, wanted, maxChapter);
  const missing = wanted.filter((a) => !carried.has(a));
  const coins = missing.filter((a) => coinFirst(a, source, usable, objective, maxChapter));
  let need = missing.filter((a) => !coins.includes(a));
  let sp = coins.length;
  let gilda = coins.reduce((n, a) => n + (coinFor(a)?.price ?? 0), 0);
  while (need.length) {
    const covers = (s: AbilitySphere) => s.abilities.filter((a) => need.includes(a)).length;
    const pick = usable
      .filter((s) => covers(s) > 0)
      .sort((x, y) => covers(y) - covers(x) || sphereCost(objective)(x, y))[0];
    if (!pick) {
      sp += need.length;
      gilda += need.reduce((n, a) => n + (coinFor(a)?.price ?? 0), 0);
      break;
    }
    sp += pick.template.level;
    gilda += pick.template.gilda;
    need = need.filter((a) => !pick.abilities.includes(a));
  }
  return { sp, gilda };
}

/** Orders ability spheres by the plan's objective, then by gilda. */
const sphereCost =
  (objective: Objective) =>
  (x: AbilitySphere, y: AbilitySphere): number => {
    const of = (s: AbilitySphere) =>
      objective === "gilda"
        ? s.template.gilda
        : objective === "steps"
          ? s.template.level
          : s.template.abs;
    return of(x) - of(y) || x.template.gilda - y.template.gilda;
  };

/** A sphere recipe and the abilities its sphere passes on (from +5). */
interface AbilitySphere {
  template: Template;
  abilities: AbilityId[];
}

/** The recipes whose spheres carry abilities. */
function abilitySpheres(templates: Template[]): AbilitySphere[] {
  return templates.flatMap((template) =>
    template.abilities?.length ? [{ template, abilities: template.abilities }] : [],
  );
}

interface Candidate {
  state: WeaponState;
  acquire: Acquire;
}

export async function planPath(
  req: PlanRequest,
  onProgress?: (p: PlanProgress) => void,
): Promise<PlanResult> {
  const target = getWeapon(req.targetId);
  const wanted = req.abilities ?? [];
  const source = req.abilitySource ?? "spheres";
  // The abilities' spheres and coins cost gilda too; that is taken off per chain (see abilityReserve).
  const itemBudget = req.maxGilda;

  // Candidate starts: the given start, or every acquirable weapon in the target's build-up line.
  let candidates: Candidate[] = req.optimalStart
    ? startOptions(req.targetId, req.maxChapter).map((o) => ({
        state: freshState(getWeapon(o.weaponId)),
        acquire: o.acquire,
      }))
    : [{ state: req.start, acquire: { kind: "have" as const } }];
  // A start that cannot be paid for out of the budget can never yield a plan.
  candidates = candidates.filter(
    (c) => itemBudget === undefined || acquireGilda(c.acquire) <= itemBudget,
  );

  // Build-up chains from every start; the optimal search caps the enumeration, taking them
  // round-robin across starts (each start's own chains shortest-first) so no start family is
  // starved when the cap bites.
  const pairs: { candidate: Candidate; chain: string[] }[] = [];
  if (req.optimalStart) {
    const byStart = candidates.map((candidate) =>
      findChains(candidate.state.weaponId, req.targetId, req.maxChapter, CHAINS_PER_START)
        .sort((a, b) => a.length - b.length)
        .map((chain) => ({ candidate, chain })),
    );
    outer: for (let n = 0; pairs.length < MAX_RANKED_CHAINS; n++) {
      let added = false;
      for (const list of byStart)
        if (list[n]) {
          pairs.push(list[n]);
          added = true;
          if (pairs.length >= MAX_RANKED_CHAINS) break outer;
        }
      if (!added) break;
    }
  } else {
    for (const chain of findChains(req.start.weaponId, req.targetId, req.maxChapter))
      pairs.push({ candidate: candidates[0], chain });
  }
  if (!pairs.length)
    return {
      status: "no-path",
      alternatives: [],
      message: "No build-up path to that weapon with the available content.",
    };

  const items = itemCandidates({ maxChapter: req.maxChapter, allowFound: req.allowFound });
  onProgress?.({ phase: "templates", done: 0, total: 1 });
  const templates =
    req.templates ??
    (await generateTemplates({
      maxChapter: req.maxChapter,
      allowFound: req.allowFound,
      spBonus: req.spBonus,
    }));
  const goalInputs =
    req.goal.kind === "max"
      ? { finalStats: target.maxStats }
      : req.goal.kind === "stats"
        ? { finalStats: req.goal.stats, finalLevel: req.goal.level ?? 0 }
        : {};
  const base = {
    start: req.start,
    objective: req.objective,
    spBonus: req.spBonus,
    items,
    templates,
    maxGilda: itemBudget,
    reserveSp: 0,
    ...goalInputs,
  };
  const simOpts: SimOptions = { spBonus: req.spBonus };
  const spheres = wanted.length ? abilitySpheres(templates) : [];
  const candidateByStart = new Map(candidates.map((c) => [c.state.weaponId, c]));
  // Per-start inputs: the start's own state, with the acquisition taken off the item budget.
  const baseFor = (c: Candidate) => ({
    ...base,
    start: c.state,
    ...(itemBudget !== undefined
      ? { maxGilda: Math.max(0, itemBudget - acquireGilda(c.acquire)) }
      : {}),
  });

  // Rank chains by the continuous relaxation, then solve the best few exactly.
  const ranked: ChainOutcome[] = [];
  for (const [n, { candidate, chain }] of pairs.entries()) {
    onProgress?.({ phase: "rank", done: n, total: pairs.length });
    const r = await solveChain({ ...baseFor(candidate), chain, relax: true, timeLimitSec: 20 });
    ranked.push({
      chain,
      bound:
        r.value === undefined
          ? undefined
          : r.value + acquireOffset(candidate.acquire, req.objective),
      status: r.status === "optimal" ? "optimal" : r.status,
    });
  }
  ranked.sort((a, b) => (a.bound ?? Infinity) - (b.bound ?? Infinity));

  let best:
    | {
        chain: string[];
        plan: Plan;
        simulation: PlanResult["simulation"];
        missing: AbilityId[];
        acquire: Acquire;
      }
    | undefined;
  let bestKey = Infinity;
  const exact = req.exactChains ?? 2;
  // Chains that produced a candidate plan; infeasible ones don't consume the exact budget
  // (a chain can be relaxation-feasible yet exact-infeasible, e.g. under a gilda budget).
  let solved = 0;
  let attempts = 0;
  for (const o of ranked) {
    if (solved >= exact || attempts >= exact * 4) {
      if (o.bound !== undefined) o.status = "skipped";
      continue;
    }
    if (o.bound === undefined) continue;
    // The LP bound is a lower bound for this chain's exact cost: it cannot beat the best plan so far.
    if (bestKey < Infinity && o.bound >= bestKey) {
      o.status = "skipped";
      continue;
    }
    const candidate = candidateByStart.get(o.chain[0])!;
    attempts++;
    onProgress?.({ phase: "solve", done: solved, total: exact });
    // The incumbent best cost prunes every branch that is not an improvement.
    const cutoff = bestKey < Infinity ? bestKey : undefined;
    // If the coins don't fit in the SP left over, retry with a larger reserve.
    let r: Awaited<ReturnType<typeof solveChain>> | undefined;
    let plan: Plan | undefined;
    let sim: ReturnType<typeof simulatePlan> | undefined;
    let missing: AbilityId[] = [];
    // SP for the ability spheres and coins is set aside up front; if they still don't fit (or a
    // sphere is swapped for a coin), retry with more.
    const reserve = wanted.length
      ? abilityReserve(o.chain, wanted, spheres, req.maxChapter, req.objective, source)
      : { sp: 0, gilda: 0 };
    const chainBase = baseFor(candidate);
    for (const extra of wanted.length ? [0, 10] : [0]) {
      r = await solveChain({
        ...chainBase,
        ...(chainBase.maxGilda !== undefined
          ? { maxGilda: Math.max(0, chainBase.maxGilda - reserve.gilda) }
          : {}),
        reserveSp: reserve.sp + extra,
        chain: o.chain,
        // HiGHS finds a near-optimal incumbent early and spends minutes proving the last 1%:
        // cap the proof instead and keep whatever incumbent it has (still simulator-verified).
        timeLimitSec: req.timeLimitSec ?? 3,
        mipGap: EXACT_GAP,
        // The model starts from an already-acquired weapon, so the incumbent may spend the
        // acquisition price too — allow exactly that much more.
        ...(cutoff !== undefined
          ? { objectiveBound: cutoff - acquireOffset(candidate.acquire, req.objective) }
          : {}),
      });
      o.status = r.status;
      if (!r.plan) {
        // "Infeasible" under a cutoff only means "no improvement on the best chain already solved".
        if (cutoff !== undefined && r.status === "infeasible") o.status = "skipped";
        break;
      }
      plan = r.plan;
      missing = [];
      if (wanted.length) {
        const withCoins = addAbilities(
          candidate.state,
          r.plan,
          wanted,
          req.maxChapter,
          simOpts,
          spheres,
          req.objective,
          source,
          req.maxGilda === undefined
            ? undefined
            : Math.max(
                0,
                req.maxGilda -
                  acquireGilda(candidate.acquire) -
                  (r.plan ? simulatePlan(candidate.state, r.plan, simOpts).cost.gilda : 0),
              ),
        );
        plan = withCoins.plan;
        missing = withCoins.missing;
      }
      sim = simulatePlan(candidate.state, plan, simOpts);
      if (!sim.errors.length) break;
    }
    if (!plan || !sim) continue;
    solved++;
    // The simulator starts from an already-owned weapon; obtaining it is part of the plan's cost.
    sim.cost.gilda += acquireGilda(candidate.acquire);
    sim.cost.steps += acquireSteps(candidate.acquire);
    o.cost = sim.cost;
    if (sim.errors.length) continue;
    const primary =
      req.objective === "abs"
        ? sim.cost.abs
        : req.objective === "gilda"
          ? sim.cost.gilda
          : sim.cost.steps;
    const key = primary + 1e-3 * (req.objective === "abs" ? sim.cost.gilda : sim.cost.abs);
    if (key < bestKey) {
      bestKey = key;
      best = { chain: o.chain, plan, simulation: sim, missing, acquire: candidate.acquire };
    }
  }
  onProgress?.({ phase: "finish", done: 1, total: 1 });
  if (!best)
    return {
      status: "infeasible",
      alternatives: ranked,
      message: "No valid plan found within the available content.",
    };
  const { missing, ...rest } = best;
  return {
    status: "ok",
    ...rest,
    alternatives: ranked,
    ...(missing.length ? { abilitiesMissing: missing } : {}),
  };
}

/** Earliest chapter by which any build-up chain to `targetId` becomes possible (kill requirements). */
export function earliestChapter(startId: string, targetId: string): number {
  for (let ch = 1; ch <= 8; ch++) if (findChains(startId, targetId, ch, 1).length) return ch;
  return 8;
}
