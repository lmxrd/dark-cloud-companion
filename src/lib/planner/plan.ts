// Top-level planner: enumerates build-up chains from the start weapon to the target, ranks them with the
// LP relaxation, solves the best few exactly, and verifies the winner with the rule-checking simulator.
import { STAT_KEYS, type AbilityId, type Stats } from "@/lib/schemas";
import { core } from "@/lib/gamedata";
import {
  addAbilities as mergeAbilities,
  freshState,
  OPPOSITES,
  type WeaponState,
} from "@/lib/weapons/mechanics";
import { itemCandidates, type ItemPool } from "./candidates";
import { simulatePlan, type SimOptions } from "./simulate";
import {
  solveChain,
  type Objective,
  type Progression,
  type SolveResult,
  type Template,
} from "./solve";
import { ancestorsOf, rootWeaponIds } from "./graph";
import {
  acquisitionOptions,
  coinChapter,
  coinFor,
  getWeapon,
  allyBonus,
  supportAllyByType,
  weaponData,
  type SynthSource,
} from "./sources";
import { generateTemplates, progressionTemplates } from "./templates";
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
  /** Only this build-up route (first weapon … target); its first weapon must be a possible start. */
  route?: string[];
  /** Number of chains to solve exactly (the best by LP bound). */
  exactChains?: number;
  timeLimitSec?: number;
  /** Sphere recipes to choose from; built on the fly (and cached) when not given. */
  templates?: Template[];
  /** Which bought items may be synthed (default `all`); see {@link ItemPool}. */
  itemPool?: ItemPool;
  /** Follow the story: see {@link ProgressionOptions}. */
  progression?: ProgressionOptions;
}

/**
 * A plan that follows the story, like the weapon guide's recipes: every stage is done in a chapter
 * (as early as the story allows), using only the items and spheres available by then and the ABS and
 * gilda the story has paid out by then plus a little grinding. Weapons on the way are not levelled
 * past `levelCap` (the last one past `finalLevelCap`), and wanted abilities come from side-weapon
 * spheres placed on whichever stage suits, not all at the end.
 */
export interface ProgressionOptions {
  /** Grinding allowed on top of what the story pays by a chapter, as a share of it (e.g. 0.2). */
  grindShare: number;
  /** The ABS grind allowance instead of `grindShare` (gilda keeps `grindShare`). */
  absGrindShare?: number;
  /** ABS (in objective units) worth avoiding to have every stage one chapter earlier. */
  delayCost: number;
  levelCap: number;
  finalLevelCap: number;
  /** The main weapon must be obtainable by this chapter, so it is used through the story. */
  startBy: number;
  /** See `Progression.earlyStatBonus` (0: off). */
  earlyStatBonus?: number;
  /** See `Progression.mainItemCost` (0: off). */
  mainItemCost?: number;
  /** See `Progression.mainItemCostLast`. */
  mainItemCostLast?: number;
  /** See `Progression.statFloor` (0: off). */
  statFloor?: number;
  /** See `Progression.statFloorCost`. */
  statFloorCost?: number;
  /** See `Progression.firstStatFloor`. */
  firstStatFloor?: number;
  /**
   * Every weapon on the way is levelled to at least this before its build-up (0 or unset: off), so
   * the SP comes along the story instead of from long ABS farming on the last weapons.
   */
  buildUpLevel?: number;
  /** Cost (in ABS) of each level short of `buildUpLevel`: soft, so a plan is always found. */
  buildUpLevelCost?: number;
  /**
   * Weight ABS by how hard it is to earn in the chapter it is spent (see `effortWeights`), raised to
   * this power (1: in full; 0.5: softened; 0 or unset: off).
   */
  effortPower?: number;
}

/** ABS an ABS-paying floor or fight pays on average in each chapter (index 1…8). */
export const ABS_PER_FLOOR: number[] = (() => {
  const perSection = Array<number>(9).fill(0);
  for (let c = 1; c <= 8; c++) {
    const paying = core.sections.filter((s) => s.chapterNumber === c && (s.abs ?? 0) > 0);
    perSection[c] = paying.reduce((n, s) => n + (s.abs ?? 0), 0) / Math.max(1, paying.length);
  }
  return perSection;
})();
/**
 * How hard an ABS is to earn in each chapter (index 1…8), relative to chapter 4: the inverse of the
 * ABS an ABS-paying floor or fight pays there on average (about 230 in chapter 2, 1,100 in chapter
 * 4, 3,500 in chapter 7).
 */
export const effortWeights: number[] = ABS_PER_FLOOR.map((v, c) =>
  c === 0 || !v ? 1 : ABS_PER_FLOOR[4] / v,
);

/**
 * The fixed story rules (docs/planning.md, "Rules and choices"): measured and the same for every
 * plan, not settings. Only `StoryChoices` vary.
 */
export const STORY_RULES = {
  grindShare: 0.3,
  delayCost: 10000,
  levelCap: 10,
  finalLevelCap: 15,
  startBy: 2,
  effortPower: 0.5,
  earlyStatBonus: 2,
  mainItemCost: 1000,
  mainItemCostLast: 30,
  statFloor: 0.5,
  statFloorCost: 150,
  firstStatFloor: 0.3,
  buildUpLevelCost: 3000,
} as const satisfies Partial<ProgressionOptions>;

/** What a story plan may choose: the least level before each build-up (4 or 5). */
export interface StoryChoices {
  buildUpLevel?: number;
  /**
   * The Earliest plans: every step in the chapter it unlocks (a delay costs far more than any ABS),
   * grinding as much ABS as it takes; gilda keeps the grind allowance.
   */
  earliestSteps?: boolean;
}

/** "As much as it takes": an ABS grind allowance far beyond any plan's needs. */
export const UNLIMITED_GRIND = 1000;
/** The Earliest plans' delay cost: a chapter's delay outweighs any plan's whole ABS. */
export const EARLIEST_DELAY_COST = 1_000_000;

/** The story rules with a plan's choices. */
export function storyOptions(c: StoryChoices = {}): ProgressionOptions {
  return {
    ...STORY_RULES,
    buildUpLevel: c.buildUpLevel ?? 4,
    ...(c.earliestSteps ? { absGrindShare: UNLIMITED_GRIND, delayCost: EARLIEST_DELAY_COST } : {}),
  };
}

/** The story settings the planner page and the built-in plans use by default. */
export const STORY_DEFAULTS: ProgressionOptions = storyOptions();

/** ABS and gilda paid out by clearing every section once, by the end of each chapter (index 1…8). */
const storyTotals = (() => {
  const abs = Array<number>(9).fill(0);
  const gilda = Array<number>(9).fill(0);
  for (const s of core.sections) {
    for (let c = s.chapterNumber; c <= 8; c++) {
      abs[c] += s.abs ?? 0;
      gilda[c] += s.gilda ?? 0;
    }
  }
  return { abs, gilda };
})();

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
  /** With `progression`: the chapter each stage is done in. */
  stageChapters?: number[];
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

/**
 * Adds items to a plan's last stage for the final stats it still lacks (cheapest item per stat),
 * levelling the finished weapon further for the SP when it has too little (to at most `maxLevel`);
 * undefined when nothing is short or it can't be done.
 */
function topUpFinal(
  plan: Plan,
  state: WeaponState,
  goal: Partial<Stats>,
  items: SynthSource[],
  spBonus: number,
  maxLevel: number,
): Plan | undefined {
  const weapon = getWeapon(state.weaponId);
  const add = new Map<string, number>();
  let sp = 0;
  for (const k of STAT_KEYS) {
    const short = Math.min(goal[k] ?? 0, weapon.maxStats[k]) - state.stats[k];
    if (short <= 0) continue;
    const it = items
      .filter((i) => !i.ability && (i.gains[k] ?? 0) > 0)
      .sort((a, b) => (a.price ?? 0) / a.gains[k]! - (b.price ?? 0) / b.gains[k]!)[0];
    if (!it) return undefined;
    const n = Math.ceil(short / it.gains[k]!);
    add.set(it.name, (add.get(it.name) ?? 0) + n);
    sp += n;
  }
  if (!add.size) return undefined;
  const perLevel = weapon.spPerLevel + allyBonus(weapon, spBonus);
  const levels = sp > state.sp ? Math.ceil((sp - state.sp) / perLevel) : 0;
  if (state.level + levels > maxLevel) return undefined;
  const next = structuredClone(plan);
  const last = next.stages[next.stages.length - 1];
  last.levelTo = Math.max(last.levelTo, state.level + levels);
  for (const [name, count] of add) last.synths.push({ kind: "item", name, count });
  return next;
}

/** The top-up may level the finished weapon for SP, up to this level. */
const TOP_UP_MAX_LEVEL = 5;

/** Whether the finished weapon falls short of the stats the goal asks for. */
function finalShort(state: WeaponState, goal: Partial<Stats> | undefined): boolean {
  if (!goal) return false;
  const weapon = getWeapon(state.weaponId);
  return STAT_KEYS.some((k) => state.stats[k] < Math.min(goal[k] ?? 0, weapon.maxStats[k]));
}

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
  // Following the story, the main weapon is one you can have early on.
  const startBy = req.progression?.startBy;
  if (startBy !== undefined)
    candidates = candidates.filter(
      (c) => c.acquire.kind === "have" || c.acquire.chapter <= startBy,
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
  if (req.route) {
    const route = req.route.join(">");
    const only = pairs.filter((p) => p.chain.join(">") === route);
    pairs.length = 0;
    pairs.push(...only);
  }
  if (!pairs.length)
    return {
      status: "no-path",
      alternatives: [],
      message: "No build-up path to that weapon with the available content.",
    };

  const items = itemCandidates({
    maxChapter: req.maxChapter,
    allowFound: req.allowFound,
    pool: req.itemPool,
  });
  onProgress?.({ phase: "templates", done: 0, total: 1 });
  const templateOpts = {
    maxChapter: req.maxChapter,
    allowFound: req.allowFound,
    spBonus: req.spBonus,
    pool: req.itemPool,
  };
  const prog = req.progression;
  let templates =
    req.templates ??
    (await (prog
      ? progressionTemplates({ ...templateOpts, shells: true })
      : generateTemplates(templateOpts)));
  // Following the story, abilities are chosen inside the model: spheres that would cancel a wanted
  // ability are never an option.
  if (prog && wanted.length)
    templates = templates.filter(
      (t) => !(t.abilities ?? []).some((x) => OPPOSITES[x] && wanted.includes(OPPOSITES[x]!)),
    );
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

  /** Story constraints and sphere abilities for one chain (see ProgressionOptions). */
  const progressionFor = (c: Candidate, route: string[]) => {
    if (!prog) return {};
    // With the support allies' SP bonus, no work before they can be recruited (chapter 2): the
    // levels counted with +1 SP would otherwise be done without them. ABS from before still counts.
    const alliesFrom = req.spBonus
      ? Math.max(1, ...[...supportAllyByType.values()].map((a) => a.chapter))
      : 1;
    const startChapter = Math.max(alliesFrom, c.acquire.kind === "have" ? 1 : c.acquire.chapter);
    // A stage ends with the build-up to the next weapon: it can't be done before its kills.
    const killChapter = (id: string) =>
      Math.max(1, ...getWeapon(id).requiresKills.map((e) => enemyChapter.get(e) ?? 8));
    const routeStages = req.goal.kind === "reach" ? route.length - 1 : route.length;
    // When a build-up is locked until a later chapter than the weapon is obtained in, the weapon gets
    // an in-between stage first (a stage on the same weapon, no build-up), so it is strengthened
    // while the story catches up instead of waiting idle.
    const chain: string[] = [];
    const stageUnlock: number[] = [];
    let obtained = startChapter;
    for (let j = 0; j < routeStages; j++) {
      const unlock = Math.max(obtained, killChapter(route[Math.min(j + 1, route.length - 1)]));
      if (unlock - obtained >= 1) {
        chain.push(route[j]);
        stageUnlock.push(obtained);
      }
      chain.push(route[j]);
      stageUnlock.push(unlock);
      obtained = unlock;
    }
    if (req.goal.kind === "reach") chain.push(route[route.length - 1]);
    const nStages = stageUnlock.length;
    // Abilities the chain's own weapons bring (build-ups merge them in) need no sphere. A sphere
    // must come on or after the last weapon that brings the opposite (that build-up would cancel
    // it), and if the opposite is still there, a first sphere only cancels it: two are needed.
    let carried = c.state.abilities;
    for (const id of chain.slice(1)) carried = mergeAbilities(carried, getWeapon(id).abilities);
    const sphereAbilities = wanted
      .filter((a) => !carried.includes(a) && templates.some((t) => t.abilities?.includes(a)))
      .map((ability) => {
        const opposite = OPPOSITES[ability];
        let fromStage = 0;
        chain.forEach((id, m) => {
          const builtUp = m > 0 && id !== chain[m - 1];
          if (builtUp && opposite && getWeapon(id).abilities.includes(opposite)) fromStage = m;
        });
        return {
          ability,
          fromStage: Math.min(fromStage, nStages - 1),
          count: opposite && carried.includes(opposite) ? 2 : 1,
        };
      });
    const progression: Progression = {
      stageUnlock,
      storyAbs: storyTotals.abs,
      storyGilda: storyTotals.gilda,
      grindAbs: storyTotals.abs.map((v) => Math.round(v * (prog.absGrindShare ?? prog.grindShare))),
      grindGilda: storyTotals.gilda.map((v) => Math.round(v * prog.grindShare)),
      spentGilda: acquireGilda(c.acquire),
      delayCost: prog.delayCost,
      itemChapter: items.map((it) => it.fromChapter ?? 1),
      chapterWindow: 2,
      firstStageWindow: 0,
      ...(req.maxChapter < 8 ? { lastChapter: req.maxChapter } : {}),
      ...(prog.earlyStatBonus ? { earlyStatBonus: prog.earlyStatBonus } : {}),
      ...(prog.mainItemCost
        ? {
            mainItemCost: prog.mainItemCost,
            mainItemCostLast: prog.mainItemCostLast ?? prog.mainItemCost,
          }
        : {}),
      ...(prog.statFloor && prog.statFloorCost
        ? { statFloor: prog.statFloor, statFloorCost: prog.statFloorCost }
        : {}),
      ...(prog.firstStatFloor !== undefined ? { firstStatFloor: prog.firstStatFloor } : {}),
      ...(prog.effortPower ? { absWeights: effortWeights.map((w) => w ** prog.effortPower!) } : {}),
    };
    return {
      chain,
      progression,
      sphereAbilities,
      stageMaxLevels: Array.from({ length: nStages }, (_, j) =>
        j === nStages - 1 && req.goal.kind !== "reach" ? prog.finalLevelCap : prog.levelCap,
      ),
      stageMinLevels: Array.from({ length: nStages }, (_, j) =>
        chain[j + 1] !== undefined && chain[j + 1] !== chain[j] ? (prog.buildUpLevel ?? 0) : 0,
      ),
      stageMinLevelCost: prog.buildUpLevelCost ?? 0,
    };
  };

  // Rank chains by the continuous relaxation, then solve the best few exactly.
  const ranked: ChainOutcome[] = [];
  for (const [n, { candidate, chain }] of pairs.entries()) {
    onProgress?.({ phase: "rank", done: n, total: pairs.length });
    const r = await solveChain({
      ...baseFor(candidate),
      chain,
      ...progressionFor(candidate, chain),
      relax: true,
      timeLimitSec: 20,
    });
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
        stageChapters?: number[];
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
    // Following the story, the model places the ability spheres itself.
    const reserve =
      wanted.length && !prog
        ? abilityReserve(o.chain, wanted, spheres, req.maxChapter, req.objective, source)
        : { sp: 0, gilda: 0 };
    const chainBase = { ...baseFor(candidate), ...progressionFor(candidate, o.chain) };
    // Following the story, a retry keeps more margin on the requirements instead (the sphere
    // transfer and SP rounding can leave the simulator a point short of what the model expects).
    const tries = prog ? [1, 3] : wanted.length ? [0, 10] : [0];
    for (const [n, extraOrMargin] of tries.entries()) {
      // Following the story, the retry also keeps a few SP free for topping up the final stats.
      const extra = prog ? (n > 0 ? 4 : 0) : extraOrMargin;
      if (prog && n > 0 && !sim?.errors.length && !finalShort(sim!.state, goalInputs.finalStats))
        break;
      const exactInput = {
        ...chainBase,
        ...(chainBase.maxGilda !== undefined
          ? { maxGilda: Math.max(0, chainBase.maxGilda - reserve.gilda) }
          : {}),
        reserveSp: reserve.sp + extra,
        ...(prog ? { statMargin: extraOrMargin } : {}),
        // Following the story, the chain may repeat a weapon for in-between stages.
        chain: chainBase.chain ?? o.chain,
        // HiGHS finds a near-optimal incumbent early and spends minutes proving the last 1%:
        // cap the proof instead and keep whatever incumbent it has (still simulator-verified).
        timeLimitSec: req.timeLimitSec ?? 3,
        mipGap: EXACT_GAP,
        // The model starts from an already-acquired weapon, so the incumbent may spend the
        // acquisition price too — allow exactly that much more.
        ...(cutoff !== undefined
          ? { objectiveBound: cutoff - acquireOffset(candidate.acquire, req.objective) }
          : {}),
      };
      r = await solveChain(exactInput);
      // A slow machine (or a hard chain) can run out of time before any plan is found: try once
      // more with four times as long rather than report no plan.
      if (!r.plan && r.status === "timedout")
        r = await solveChain({ ...exactInput, timeLimitSec: 4 * (req.timeLimitSec ?? 3) });
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
      // The model's sphere-transfer estimate can leave the finished weapon a point short; top it up
      // with items while it has SP left.
      if (!sim.errors.length && goalInputs.finalStats) {
        const lastChapter = r.stageChapters?.at(-1) ?? req.maxChapter;
        const topped = topUpFinal(
          plan,
          sim.state,
          goalInputs.finalStats,
          items.filter((it) => (it.fromChapter ?? 1) <= lastChapter),
          req.spBonus,
          // Levelling the finished weapon for SP is fine, but not past +5.
          TOP_UP_MAX_LEVEL,
        );
        if (topped) {
          plan = topped;
          sim = simulatePlan(candidate.state, plan, simOpts);
        }
      }
      if (!sim.errors.length && !(prog && finalShort(sim.state, goalInputs.finalStats))) break;
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
    // Following the story, later chapters cost as in the model.
    const chapters = r?.stageChapters ?? [];
    const delay =
      prog && chapters.length
        ? (prog.delayCost * chapters.reduce((n, c) => n + c, 0)) / chapters.length
        : 0;
    const key = primary + 1e-3 * (req.objective === "abs" ? sim.cost.gilda : sim.cost.abs) + delay;
    if (key < bestKey) {
      bestKey = key;
      best = {
        chain: o.chain,
        plan,
        simulation: sim,
        missing,
        acquire: candidate.acquire,
        ...(r?.stageChapters ? { stageChapters: r.stageChapters } : {}),
      };
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
