// Stage optimiser: given a build-up chain, picks level-ups, synth items and sphere weapons that
// satisfy every build-up requirement at minimum cost, as a mixed-integer linear program (HiGHS).
//
// Model (per stage j, weapon w_j, stat k):
//   e[j][k]  = effective stat at the end of stage j (only ever feeds ≥ constraints, so "≤ growth" is safe)
//   e[j][k] ≤ e[j-1][k] + X[j][k] + Σ item gains + Σ sphere gains + level-up At        (growth)
//   e[j][k] ≤ cap(w_j, k)                                                              (weapon cap)
//   e[j][k] ≥ requirement of the next weapon                                           (build-up gate)
//   Σ SP gained from levelling (cumulative) ≥ Σ SP spent on items/spheres (cumulative)
// With `progression`, each stage is also given a chapter (binary z[j][c], never earlier than the
// stage before): it may only use items and spheres available by then, and the ABS and gilda spent up
// to and including it must stay within what the story has paid by the end of that chapter (plus an
// allowance to grind). Later chapters cost a little, so stages happen as early as the story allows.
// ABS for levelling is the exact convex cost curve, linearised with secants (tight at integers).
import { STAT_KEYS, type AbilityId, type StatKey, type Stats } from "@/lib/schemas";
import {
  absBetween,
  buildUpBonus,
  buildUpRequirements,
  SPECTRUMIZE_KEEP,
  type WeaponState,
} from "@/lib/weapons/mechanics";
import { solveLp, type LpModel, type LpRow, type SolveStats } from "./highs";
import { allyBonus, getWeapon, type SynthSource } from "./sources";
import type { Plan, Recipe, Stage, SynthUse } from "./types";

export type Objective = "abs" | "gilda" | "steps";

/**
 * The stat floor's target and minimum (shares of the weapon's maximum) for the weapon at position
 * `at` of `n` in the chain: flat, or rising along the chain with `risingFloor`.
 */
export function floorShares(
  p: {
    statFloor?: number;
    minStatFloor?: number;
    risingFloor?: { from: number; to: number; gap: number };
  },
  at: number,
  n: number,
): { target: number; min: number } {
  if (!p.risingFloor) return { target: p.statFloor ?? 0, min: p.minStatFloor ?? 0 };
  const { from, to, gap } = p.risingFloor;
  const target = at >= n - 1 ? to : from + ((to - from) * at) / Math.max(1, n - 2);
  return { target, min: Math.max(0, target - gap) };
}

/**
 * The cost of an item synthed straight onto the main weapon at stage `j` of `n`: `full` for the first
 * half of the stages, then falling evenly to `last` on the last stage.
 */
export function mainItemCostAt(j: number, n: number, full: number, last: number): number {
  if (n <= 1) return full;
  const p = j / (n - 1);
  return p <= 0.5 ? full : last + (full - last) * ((1 - p) / 0.5);
}

export interface Template {
  id: string;
  recipe: Recipe;
  /** Final weapon of the recipe and the level it is spectrumized at (= SP cost on the receiving weapon). */
  weaponId: string;
  level: number;
  /** Stat gains for the receiving weapon (At assumes the receiver's At is not lower: a safe lower bound). */
  gains: Partial<Stats>;
  abs: number;
  gilda: number;
  chapter: number;
  /** Abilities the sphere passes on (spheres from +5 carry the weapon's abilities). */
  abilities?: AbilityId[];
  /**
   * A shell: the side weapon levelled but not filled; the model chooses the items it carries (`gains`
   * are those of the empty sphere). `stats` are the side weapon's own, `sp` its SP to fill.
   */
  shell?: { sp: number; stats: Stats; maxStats: Stats };
}

export interface SolveInput {
  start: WeaponState;
  chain: string[];
  objective: Objective;
  spBonus: number;
  items: SynthSource[];
  templates: Template[];
  /** When set, a final stage is modelled in which these stats must be reached on the last weapon. */
  finalStats?: Partial<Stats>;
  finalLevel?: number;
  /** Highest level the model may level a weapon to (bounds model size). */
  maxLevel?: number;
  /** SP to leave unspent on the weapon when the last modelled stage ends (for ability coins added afterwards). */
  reserveSp?: number;
  /** Upper bound on gilda spent on items and sphere weapons (optional). */
  maxGilda?: number;
  /** Solver time limit in seconds. */
  timeLimitSec?: number;
  /** Highest level per stage (overrides `maxLevel` where given). */
  stageMaxLevels?: number[];
  /**
   * Wanted lowest level per stage (0 or missing: none). Soft when `stageMinLevelCost` is set (each
   * level short costs that much in ABS units), so an unusual start or target still gets a plan.
   */
  stageMinLevels?: number[];
  stageMinLevelCost?: number;
  /**
   * Abilities that must come from spheres: at least `count` spheres carrying each, on stage
   * `fromStage` or later (a build-up into a weapon with the opposite ability would cancel earlier ones).
   */
  sphereAbilities?: { ability: AbilityId; fromStage: number; count: number }[];
  /** Places every stage in a chapter of the story; see the model notes at the top. */
  progression?: Progression;
  /** Extra points required on every build-up and final stat (absorbs rounding the model can't see). */
  statMargin?: number;
  /** Relative optimality gap for exact solves (default 0.001). ~0.01 is far faster for high-tier chains. */
  mipGap?: number;
  /** Primal bound in objective units: solutions no better than this are pruned (used to skip chains). */
  objectiveBound?: number;
  /** Solve the continuous relaxation only (fast; used to pick candidate templates). */
  relax?: boolean;
  /** Starting values by variable name (a saved `SolveResult.solution`), see `solveLp`. */
  warmStart?: ReadonlyMap<string, number>;
}

/** Story constraints for `SolveInput.progression`. Arrays by chapter are indexed 1…8. */
export interface Progression {
  /** Earliest chapter each stage can be done in (e.g. kills the next build-up needs). */
  stageUnlock: number[];
  /** ABS and gilda the story has paid out by the end of each chapter. */
  storyAbs: number[];
  storyGilda: number[];
  /** ABS and gilda that may be ground or farmed on top, by chapter. */
  grindAbs: number[];
  grindGilda: number[];
  /** Gilda already spent before the first stage (the first weapon's price). */
  spentGilda: number;
  /** Cost (in objective units) of every stage being one chapter later (spread over the stages). */
  delayCost: number;
  /** Chapter each item is first sold in (by item index); missing = chapter 1. */
  itemChapter: number[];
  /** The last chapter any stage may be placed in (default 8): the plan must finish by then. */
  lastChapter?: number;
  /** A stage may be placed at most this many chapters after its unlock (default: no limit). */
  chapterWindow?: number;
  /** The same for the first stage (0: work on the first weapon starts as soon as it can). */
  firstStageWindow?: number;
  /**
   * Reward (in objective units) per stat point per chapter the weapon holds it: a point gained in a
   * stage counts from that stage's chapter to the end of the story, so the weapon is stronger sooner
   * (stages in the same chapter are alike, the first weapon gets nothing for being first). Keep it
   * well below what a stat point costs, or it buys extra spheres.
   */
  earlyStatBonus?: number;
  /**
   * Cost per stat point lost to a cap (At aside): gains a stage's weapon can't hold, including those
   * a build-up into a weapon with a lower maximum cuts, so spheres go where their stats fit.
   */
  lostStatCost?: number;
  /**
   * Every stat should be at least this share of the weapon's maximum when the plan leaves it: at the
   * end of its last stage before the build-up, and on the final weapon (capped by the final target).
   * Earlier stages on the same weapon (the first one in chapter 2, in-between stages) may be lower.
   * Soft, with a cost per point short (`statFloorCost`) high enough to make it practically a rule.
   */
  statFloor?: number;
  statFloorCost?: number;
  /**
   * A second, lower floor at the same points (Balanced: 0.4) with a cost per point short above a
   * chapter's delay, so the plan waits rather than leave a weapon that lopsided.
   */
  minStatFloor?: number;
  minStatFloorCost?: number;
  /**
   * A floor that rises along the chain instead of `statFloor` / `minStatFloor`: the target goes from
   * `from` on the first weapon to `to` on the weapon before the final one, the minimum `gap` below.
   */
  risingFloor?: { from: number; to: number; gap: number };
  /**
   * Abilities from spheres (`sphereAbilities`) as early as possible: the chapter of the first sphere
   * that brings each costs this much per chapter (high for ABS Up and Wealth, lower for the rest).
   */
  earlyAbilityCosts?: Partial<Record<AbilityId, number>>;
  /**
   * Weight of an ABS spent in each chapter (index 1…8): how hard it is to earn there. When set (and
   * minimising ABS), stage ABS counts at its chapter's weight instead of 1.
   */
  absWeights?: number[];
  /**
   * Cost (in objective units) of each item synthed straight onto the main weapon: its SP is gone for
   * good (SP carries over build-ups), while items inside spheres cost the main weapon nothing extra.
   * Full for the first half of the stages, then falling evenly to `mainItemCostLast` on the last one
   * (`mainItemCostAt`): the early SP are the precious ones.
   */
  mainItemCost?: number;
  mainItemCostLast?: number;
}

export interface SolveResult {
  status: "optimal" | "infeasible" | "timedout" | "error";
  plan?: Plan;
  /** With `progression`: the chapter each stage is done in. */
  stageChapters?: number[];
  /** Objective value used by the solver (primary cost plus small tie-break terms). */
  value?: number;
  /** How the solve went (time to the first plan, gap when it stopped). */
  stats?: SolveStats;
  /** The solver's nonzero values, to start a later solve of the same model from (`warmStart`). */
  solution?: Record<string, number>;
}

const itemGain = (it: SynthSource, k: StatKey) => it.gains[k] ?? 0;
/** Stage j continues the weapon of stage j − 1 (same weapon, no build-up in between). */
const isContinuation = (chain: string[], j: number) => j > 0 && chain[j] === chain[j - 1];
/**
 * Objective coefficients are scaled by this so every coefficient stays an integer (all game costs are
 * integers). HiGHS then knows the objective itself is integer-valued and can round its bounds up, which
 * is what makes the exact solves fast. `solveChain` unscales the reported value, so the secondary cost
 * keeps its 1/1000 tie-break weight from outside.
 */
const SCALE = 1000;

export function buildModel(input: SolveInput) {
  const { start, chain, objective, spBonus, items, templates } = input;
  const maxLevel = input.maxLevel ?? 40;
  const hasFinal = input.finalStats !== undefined || input.finalLevel !== undefined;
  const nStages = hasFinal ? chain.length : chain.length - 1;

  const upper = new Map<string, number>();
  const model: LpModel = { objective: new Map(), rows: [], integers: [], upper };
  const rows = new Map<string, LpRow>();
  const row = (name: string, bounds: { min?: number; max?: number }) => {
    const r: LpRow = { name, coeffs: new Map(), ...bounds };
    rows.set(name, r);
    model.rows.push(r);
    return r;
  };
  const coef = (r: string, v: string, n: number) => {
    if (n === 0) return;
    const m = rows.get(r)!.coeffs;
    m.set(v, (m.get(v) ?? 0) + n);
  };
  // Primary objective plus a 1/SCALE weight on the other costs so ties resolve sensibly.
  const cost = (v: string, abs: number, gilda: number, steps = 0) => {
    const primary = objective === "abs" ? abs : objective === "gilda" ? gilda : steps;
    const secondary = objective === "abs" ? gilda : abs;
    model.objective.set(v, SCALE * primary + secondary);
  };

  const gildaRow =
    input.maxGilda === undefined ? undefined : row("cBudget", { max: input.maxGilda });

  // ----- shells: side weapons whose items the model chooses (see Template.shell) -----
  // Items go in up to the shell's SP and its weapon's caps; the main weapon gets SPECTRUMIZE_KEEP
  // of each stat. With r = frac(0.6·b), one sphere adds floor(r + 0.6·x) on top of its `gains`; n
  // copies add at least n·r + 0.6·X − 0.8·n (stats move in steps of 0.2). The transfer per stat is
  // an integer t ≤ 0.6·X + (r − 0.8)·n + 0.8: exact for one copy, and for several never more than
  // that bound rounded up, which is still ≤ the truth. At items stay out (their transfer depends on
  // the main weapon's At).
  const shellItems = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => !(it.gains.at ?? 0) && STAT_KEYS.some((k) => itemGain(it, k) > 0));
  const addShell = (j: number, ti: number, sh: NonNullable<Template["shell"]>, y: string) => {
    const spRow = `cShSp${j}_${ti}`;
    row(spRow, { max: 0 });
    coef(spRow, y, -sh.sp);
    for (const k of STAT_KEYS) {
      if (k === "at" || !shellItems.some(({ it }) => itemGain(it, k) > 0)) continue;
      const room = Math.max(0, sh.maxStats[k] - sh.stats[k]);
      const cap = `cShCap${j}_${ti}_${k}`;
      row(cap, { max: 0 });
      coef(cap, y, -room);
      const kept = SPECTRUMIZE_KEEP * sh.stats[k];
      const r = Math.round((kept - Math.floor(kept)) * 5) / 5;
      const tVar = `vT${j}_${ti}_${k}`;
      const tRow = `cShT${j}_${ti}_${k}`;
      model.integers.push(tVar);
      row(tRow, { max: 0.8 });
      coef(tRow, tVar, 1);
      coef(tRow, y, 0.8 - r);
      coef(`cSt${j}_${k}`, tVar, -1);
    }
    for (const { it, i } of shellItems) {
      const q = `vQ${j}_${ti}_${i}`;
      model.integers.push(q);
      cost(q, 0, it.price ?? 0, 0);
      if (gildaRow) coef("cBudget", q, it.price ?? 0);
      coef(spRow, q, 1);
      for (const k of STAT_KEYS) {
        const g = itemGain(it, k);
        if (!g || k === "at") continue;
        coef(`cShCap${j}_${ti}_${k}`, q, g);
        coef(`cShT${j}_${ti}_${k}`, q, -SPECTRUMIZE_KEEP * g);
      }
    }
  };

  const lStart: number[] = [];
  const spPerLevel: number[] = [];
  /** Most SP a stage can have spent by its end (every weapon so far at its level cap). */
  const spCap: number[] = [];
  /** Most ABS a stage's levelling can cost (its weapon's run levelled to the cap). */
  const levelAbsCap: number[] = [];
  const spend: { v: string; amount: number }[][] = [];

  // A stage on the same weapon as the one before continues it (no build-up in between): its level,
  // ABS and levelling At count from where that weapon started, so vA/vG are cumulative over the run
  // and only the last stage of a run carries the ABS cost.
  /** Index of the first stage of each stage's weapon run. */
  const runStart: number[] = [];
  for (let j = 0; j < nStages; j++) {
    const w = getWeapon(chain[j]);
    const cont = isContinuation(chain, j);
    runStart.push(cont ? runStart[j - 1] : j);
    const first = runStart[j];
    const ls = first === 0 ? start.level : 0;
    lStart.push(cont ? 0 : ls);
    spPerLevel.push(w.spPerLevel + allyBonus(w, spBonus));
    spend.push([]);

    // ----- level variable and its ABS curve -----
    const L = `vL${j}`;
    const A = `vA${j}`;
    model.integers.push(L);
    cost(A, 1, 0);
    if (cont) {
      // Only the run's last stage pays: earlier ones' vA are its cumulative ABS so far.
      model.objective.delete(`vA${j - 1}`);
      row(`cRun${j}`, { min: 0 });
      coef(`cRun${j}`, A, 1);
      coef(`cRun${j}`, `vA${j - 1}`, -1);
      row(`cLmin${j}`, { min: 0 });
      coef(`cLmin${j}`, L, 1);
      coef(`cLmin${j}`, `vL${j - 1}`, -1);
    } else {
      row(`cLmin${j}`, { min: ls });
      coef(`cLmin${j}`, L, 1);
    }
    const levelCap = Math.max(ls, input.stageMaxLevels?.[j] ?? maxLevel);
    // SP over the run telescopes to spPerLevel · (last level − ls); earlier runs are done.
    const runSp = spPerLevel[j] * Math.max(0, levelCap - ls);
    const before = first > 0 ? spCap[first - 1] : start.sp;
    spCap.push(before + runSp);
    row(`cLmax${j}`, { max: levelCap });
    coef(`cLmax${j}`, L, 1);
    const minLevel = Math.min(input.stageMinLevels?.[j] ?? 0, levelCap);
    if (minLevel > ls) {
      row(`cLfloor${j}`, { min: minLevel });
      coef(`cLfloor${j}`, L, 1);
      if (input.stageMinLevelCost) {
        coef(`cLfloor${j}`, `vLs${j}`, 1);
        model.objective.set(`vLs${j}`, SCALE * input.stageMinLevelCost);
      }
    }
    const stored = first === 0 ? start.abs : 0;
    const absAt = (m: number) => Math.max(0, absBetween(w.baseAbs, ls, m) - stored);
    levelAbsCap.push(absAt(levelCap));
    for (let m = ls; m < levelCap; m++) {
      const slope = absAt(m + 1) - absAt(m);
      const c = `cCurve${j}_${m}`;
      row(c, { min: absAt(m) - slope * m });
      coef(c, A, 1);
      coef(c, L, -slope);
    }

    // ----- At gained from levelling: +r per level for the first five levels, +1 after (concave) -----
    const r = w.requiresKills.length > 0 ? 3 : 2;
    const early = Math.max(0, 5 - ls);
    const a = `vG${j}`;
    row(`cGa${j}`, { max: -r * ls });
    coef(`cGa${j}`, a, 1);
    coef(`cGa${j}`, L, -r);
    row(`cGb${j}`, { max: -ls + early * (r - 1) });
    coef(`cGb${j}`, a, 1);
    coef(`cGb${j}`, L, -1);

    // Stat rows first so item/sphere columns can attach to them.
    const lostCost = input.progression?.lostStatCost;
    for (const k of STAT_KEYS) {
      const base = j === 0 ? start.stats[k] : cont ? 0 : buildUpBonus(w.baseStats[k]);
      // Gains the weapon can't hold are lost: with a cost on them, the row is exact and vW (the
      // points lost) carries the difference.
      const lose = lostCost && k !== "at";
      row(`cSt${j}_${k}`, lose ? { min: base, max: base } : { max: base });
      coef(`cSt${j}_${k}`, `vE${j}_${k}`, 1);
      if (lose) {
        coef(`cSt${j}_${k}`, `vW${j}_${k}`, 1);
        model.objective.set(`vW${j}_${k}`, SCALE * lostCost);
      }
      if (j > 0) coef(`cSt${j}_${k}`, `vE${j - 1}_${k}`, -1);
      if (k === "at") coef(`cSt${j}_${k}`, a, -1);
      // Levelling At is cumulative over the run: this stage adds only what came since the last one.
      if (k === "at" && cont) coef(`cSt${j}_${k}`, `vG${j - 1}`, 1);
      row(`cCap${j}_${k}`, { max: w.maxStats[k] });
      coef(`cCap${j}_${k}`, `vE${j}_${k}`, 1);
      // The build-up's requirements: on the stage before it, and already on an in-between stage
      // (one followed by a stage on the same weapon), which gets the weapon ready for its next
      // upgrade so only the build-up itself waits.
      const next = chain[j + 1];
      const upgrade = chain.slice(j + 1).find((id) => id !== chain[j]);
      if (next && upgrade) {
        const need = buildUpRequirements(getWeapon(upgrade))[k];
        if (need > 0) {
          row(`cReq${j}_${k}`, { min: Math.min(need + (input.statMargin ?? 0), w.maxStats[k]) });
          coef(`cReq${j}_${k}`, `vE${j}_${k}`, 1);
        }
      } else if (!next && input.finalStats?.[k]) {
        row(`cFin${j}_${k}`, { min: Math.min(input.finalStats[k]!, w.maxStats[k]) });
        coef(`cFin${j}_${k}`, `vE${j}_${k}`, 1);
      }
    }

    items.forEach((it, i) => {
      const v = `vX${j}_${i}`;
      model.integers.push(v);
      upper.set(v, Math.floor(spCap[j]));
      cost(v, 0, it.price ?? 0, 0.01);
      if (gildaRow) coef("cBudget", v, it.price ?? 0);
      spend[j].push({ v, amount: 1 });
      for (const k of STAT_KEYS) coef(`cSt${j}_${k}`, v, -itemGain(it, k));
    });

    templates.forEach((t, ti) => {
      const v = `vY${j}_${ti}`;
      model.integers.push(v);
      if (t.level > 0) upper.set(v, Math.floor(spCap[j] / t.level));
      cost(v, t.abs, t.gilda, 1);
      if (gildaRow) coef("cBudget", v, t.gilda);
      spend[j].push({ v, amount: t.level });
      for (const k of STAT_KEYS) coef(`cSt${j}_${k}`, v, -(t.gains[k] ?? 0));
      if (t.shell) addShell(j, ti, t.shell, v);
    });
  }

  if (input.finalLevel !== undefined && nStages > 0) {
    row("cFinLevel", { min: input.finalLevel });
    coef("cFinLevel", `vL${nStages - 1}`, 1);
  }

  // ----- SP budget, cumulative: sp0 + Σ spl_i (L_i - ls_i) - Σ spent >= 0 -----
  for (let j = 0; j < nStages; j++) {
    let constant = start.sp;
    for (let i = 0; i <= j; i++) constant -= spPerLevel[i] * lStart[i];
    const c = `cSp${j}`;
    row(c, { min: -constant + (j === nStages - 1 ? (input.reserveSp ?? 0) : 0) });
    for (let i = 0; i <= j; i++) {
      coef(c, `vL${i}`, spPerLevel[i]);
      // A continued weapon gains SP only for the levels since its previous stage.
      if (isContinuation(chain, i)) coef(c, `vL${i - 1}`, -spPerLevel[i]);
      for (const s of spend[i]) coef(c, s.v, -s.amount);
    }
  }

  // ----- abilities from spheres: at least one sphere carrying each, somewhere in the chain -----
  for (const { ability, fromStage, count } of input.sphereAbilities ?? []) {
    const c = `cAbility_${ability.replace(/\W/g, "_")}`;
    row(c, { min: count });
    for (let j = fromStage; j < nStages; j++)
      templates.forEach((t, ti) => {
        if (t.abilities?.includes(ability)) coef(c, `vY${j}_${ti}`, 1);
      });
  }

  const p = input.progression;
  if (p?.mainItemCost)
    for (let j = 0; j < nStages; j++)
      items.forEach((_, i) => {
        const v = `vX${j}_${i}`;
        const each = mainItemCostAt(
          j,
          nStages,
          p.mainItemCost!,
          p.mainItemCostLast ?? p.mainItemCost!,
        );
        model.objective.set(v, (model.objective.get(v) ?? 0) + SCALE * each);
      });
  if (p?.statFloor && p.statFloorCost) {
    const weapons = chain.filter((id, j) => j === 0 || id !== chain[j - 1]);
    for (let j = 0; j < nStages; j++) {
      // Only where the plan leaves the weapon (a build-up follows) and on the final stage.
      if (j < nStages - 1 && chain[j + 1] === chain[j]) continue;
      const max = getWeapon(chain[j]).maxStats;
      const at = weapons.lastIndexOf(chain[j]);
      const share = floorShares(p, at, weapons.length);
      for (const k of STAT_KEYS) {
        const want = Math.min(Math.round(share.target * max[k]), input.finalStats?.[k] ?? max[k]);
        if (want <= 0) continue;
        const short = `vS${j}_${k}`;
        row(`cFloor${j}_${k}`, { min: want });
        coef(`cFloor${j}_${k}`, `vE${j}_${k}`, 1);
        coef(`cFloor${j}_${k}`, short, 1);
        model.objective.set(short, SCALE * p.statFloorCost);
        if (share.min && p.minStatFloorCost) {
          const low = Math.min(Math.round(share.min * max[k]), input.finalStats?.[k] ?? max[k]);
          if (low > 0) {
            const under = `vT${j}_${k}`;
            row(`cMinFloor${j}_${k}`, { min: low });
            coef(`cMinFloor${j}_${k}`, `vE${j}_${k}`, 1);
            coef(`cMinFloor${j}_${k}`, under, 1);
            model.objective.set(under, SCALE * p.minStatFloorCost);
          }
        }
      }
    }
  }
  if (p) {
    const chapters = [1, 2, 3, 4, 5, 6, 7, 8].filter((c) => c <= (p.lastChapter ?? 8));
    // There is no story cap: a stage may wait as long as it needs (for kills, items, gilda or the
    // side weapons that carry its abilities); the delay cost keeps it as early as it can be.
    const windowOf = (j: number) =>
      j === 0 && p.firstStageWindow !== undefined ? p.firstStageWindow : (p.chapterWindow ?? 8);
    // What the story (plus grinding) has paid by the end of each chapter: no stage placed there
    // spends more, which bounds every count and ABS a chapter choice switches on.
    const absCap = (c: number) => p.storyAbs[c] + p.grindAbs[c];
    const gildaCap = (c: number) => Math.max(0, p.storyGilda[c] + p.grindGilda[c] - p.spentGilda);
    /** Most of one item or sphere a stage placed in chapter c can take (its SP, ABS and gilda). */
    const most = (v: string, c: number, abs: number, gilda: number) =>
      Math.min(
        upper.get(v) ?? Infinity,
        abs > 0 ? Math.floor(absCap(c) / abs) : Infinity,
        gilda > 0 ? Math.floor(gildaCap(c) / gilda) : Infinity,
      );
    for (let j = 0; j < nStages; j++) {
      const open = chapters.filter(
        (c) => c >= (p.stageUnlock[j] ?? 1) && c <= (p.stageUnlock[j] ?? 1) + windowOf(j),
      );
      const z = (c: number) => `vZ${j}_${c}`;
      row(`cOne${j}`, { min: 1, max: 1 });
      for (const c of open) {
        model.integers.push(z(c));
        coef(`cOne${j}`, z(c), 1);
        // Averaged over the stages, so a chain isn't cheaper just for having fewer of them.
        model.objective.set(
          z(c),
          (model.objective.get(z(c)) ?? 0) + (SCALE * p.delayCost * c) / nStages,
        );
      }
      // Never earlier than the stage before.
      if (j > 0) {
        row(`cOrder${j}`, { min: 0 });
        for (const c of open) coef(`cOrder${j}`, z(c), c);
        for (const c of chapters.filter(
          (c) =>
            c >= (p.stageUnlock[j - 1] ?? 1) && c <= (p.stageUnlock[j - 1] ?? 1) + windowOf(j - 1),
        ))
          coef(`cOrder${j}`, `vZ${j - 1}_${c}`, -c);
      }
      // Items and spheres only once they are available: x ≤ Σ most(c) · z[c] over chapters ≥ theirs.
      const gate = (v: string, from: number, abs: number, gilda: number) => {
        if (from <= Math.min(...open)) return;
        const c = `cAvail_${v}`;
        row(c, { max: 0 });
        coef(c, v, 1);
        for (const ch of open)
          if (ch >= from) {
            const m = most(v, ch, abs, gilda);
            coef(c, z(ch), -(Number.isFinite(m) ? m : 1000));
          }
      };
      items.forEach((it, i) => gate(`vX${j}_${i}`, p.itemChapter[i] ?? 1, 0, it.price ?? 0));
      templates.forEach((t, ti) => {
        gate(`vY${j}_${ti}`, t.chapter, t.abs, t.gilda);
        if (t.shell)
          for (const { it, i } of shellItems)
            gate(`vQ${j}_${ti}_${i}`, p.itemChapter[i] ?? 1, 0, it.price ?? 0);
      });
      // ABS and gilda spent so far within what the story (plus grinding) has paid by then.
      const absRow = `cStoryAbs${j}`;
      const gildaRow = `cStoryGilda${j}`;
      row(absRow, { max: 0 });
      row(gildaRow, { max: -p.spentGilda });
      for (const c of open) {
        coef(absRow, z(c), -(p.storyAbs[c] + p.grindAbs[c]));
        coef(gildaRow, z(c), -(p.storyGilda[c] + p.grindGilda[c]));
      }
      for (let i = 0; i <= j; i++) {
        coef(absRow, `vA${i}`, 1);
        // vA is cumulative over a weapon run, so a continued stage adds only its increase.
        if (isContinuation(chain, i)) coef(absRow, `vA${i - 1}`, -1);
        items.forEach((it, ii) => coef(gildaRow, `vX${i}_${ii}`, it.price ?? 0));
        templates.forEach((t, ti) => {
          coef(absRow, `vY${i}_${ti}`, t.abs);
          coef(gildaRow, `vY${i}_${ti}`, t.gilda);
          if (t.shell)
            for (const { it, i: ii } of shellItems)
              coef(gildaRow, `vQ${i}_${ti}_${ii}`, it.price ?? 0);
        });
      }
    }

    // Early stats: the points a stage adds (S[j], all stats) count once per chapter from the stage's
    // chapter to the end. U[j][c] carries S[j] when the stage is in chapter c (0 otherwise); N[j]
    // takes a stage that loses points overall, charged at its latest chapter's full weight.
    if (p.earlyStatBonus) {
      const end = p.lastChapter ?? 8;
      for (let j = 0; j < nStages; j++) {
        const open = chapters.filter(
          (c) => c >= (p.stageUnlock[j] ?? 1) && c <= (p.stageUnlock[j] ?? 1) + windowOf(j),
        );
        const w = getWeapon(chain[j]);
        const most = STAT_KEYS.reduce((n, k) => n + w.maxStats[k], 0);
        const gain = `cGain${j}`;
        const held = (c: number) => end + 1 - c;
        row(gain, { max: j === 0 ? -STAT_KEYS.reduce((n, k) => n + start.stats[k], 0) : 0 });
        for (const k of STAT_KEYS) {
          coef(gain, `vE${j}_${k}`, -1);
          if (j > 0) coef(gain, `vE${j - 1}_${k}`, 1);
        }
        coef(gain, `vN${j}`, -1);
        model.objective.set(`vN${j}`, SCALE * p.earlyStatBonus * held(Math.min(...open)));
        for (const c of open) {
          const u = `vU${j}_${c}`;
          coef(gain, u, 1);
          model.objective.set(u, -SCALE * p.earlyStatBonus * held(c));
          row(`cGainZ${j}_${c}`, { max: 0 });
          coef(`cGainZ${j}_${c}`, u, 1);
          coef(`cGainZ${j}_${c}`, `vZ${j}_${c}`, -most);
        }
      }
    }

    // ABS weighted by the effort of earning it where it is spent: a stage's ABS (its levelling and
    // its spheres) counts at its chapter's weight. B[j][c] carries stage j's ABS when it is placed in
    // chapter c (and is 0 otherwise); its ABS no longer counts at weight 1.
    if (p.absWeights && objective === "abs") {
      // A stage's ABS is part of what is spent by its chapter, so at most that chapter's cap; and
      // at most its levelling plus all its SP in the spheres with the most ABS per SP.
      const absPerSp = Math.max(
        0,
        ...templates.map((t) => (t.level > 0 ? t.abs / t.level : t.abs > 0 ? Infinity : 0)),
      );
      const stageAbsCap = levelAbsCap.map((a, j) => Math.ceil(a + absPerSp * spCap[j]));
      for (let j = 0; j < nStages; j++) {
        const open = chapters.filter(
          (c) => c >= (p.stageUnlock[j] ?? 1) && c <= (p.stageUnlock[j] ?? 1) + windowOf(j),
        );
        model.objective.delete(`vA${j}`);
        const e = `cEffort${j}`;
        row(e, { min: 0, max: 0 });
        coef(e, `vA${j}`, -1);
        if (isContinuation(chain, j)) coef(e, `vA${j - 1}`, 1);
        templates.forEach((t, ti) => {
          const v = `vY${j}_${ti}`;
          coef(e, v, -t.abs);
          model.objective.set(v, (model.objective.get(v) ?? 0) - SCALE * t.abs);
        });
        for (const c of open) {
          const b = `vB${j}_${c}`;
          coef(e, b, 1);
          model.objective.set(b, SCALE * p.absWeights[c]);
          row(`cEffZ${j}_${c}`, { max: 0 });
          coef(`cEffZ${j}_${c}`, b, 1);
          coef(`cEffZ${j}_${c}`, `vZ${j}_${c}`, -Math.min(absCap(c), stageAbsCap[j]));
        }
      }
    }

    // Early abilities: F[a][j] picks the stage of the first sphere that brings ability a (it must
    // have one), and C[a] ≥ that stage's chapter costs the ability's early cost per chapter.
    for (const { ability, fromStage } of input.sphereAbilities ?? []) {
      const each = p.earlyAbilityCosts?.[ability];
      if (!each) continue;
      const a = ability.replace(/\W/g, "_");
      const when = `vC_${a}`;
      model.objective.set(when, SCALE * each);
      row(`cFirst_${a}`, { min: 1, max: 1 });
      for (let j = fromStage; j < nStages; j++) {
        const first = `vF_${a}_${j}`;
        model.integers.push(first);
        coef(`cFirst_${a}`, first, 1);
        const has = `cFirstHas_${a}_${j}`;
        row(has, { max: 0 });
        coef(has, first, 1);
        templates.forEach((t, ti) => {
          if (t.abilities?.includes(ability)) coef(has, `vY${j}_${ti}`, -1);
        });
        // C ≥ chapter(j) − last · (1 − F[j]), last being the latest chapter stage j can be in.
        const open = chapters.filter(
          (c) => c >= (p.stageUnlock[j] ?? 1) && c <= (p.stageUnlock[j] ?? 1) + windowOf(j),
        );
        const last = Math.max(...open);
        const at = `cFirstCh_${a}_${j}`;
        row(at, { min: -last });
        coef(at, when, 1);
        coef(at, first, -last);
        for (const c of open) coef(at, `vZ${j}_${c}`, -c);
      }
    }
  }

  return { model, nStages, hasFinal };
}

/**
 * A variable's name for saving: the model numbers items and sphere templates by their position in
 * this solve's lists, which change with the game data or item set, so saved values name them by item
 * name and template id instead (a saved value then means the same thing, or matches nothing).
 */
function stableName(name: string, items: SynthSource[], templates: Template[]): string {
  const item = (i: string) => `item:${items[Number(i)]?.name ?? `#${i}`}`;
  const tpl = (t: string) => `sphere:${templates[Number(t)]?.id ?? `#${t}`}`;
  let m: RegExpMatchArray | null;
  if ((m = name.match(/^vX(\d+)_(\d+)$/))) return `vX${m[1]}|${item(m[2])}`;
  if ((m = name.match(/^vY(\d+)_(\d+)$/))) return `vY${m[1]}|${tpl(m[2])}`;
  if ((m = name.match(/^vQ(\d+)_(\d+)_(\d+)$/))) return `vQ${m[1]}|${tpl(m[2])}|${item(m[3])}`;
  if ((m = name.match(/^vT(\d+)_(\d+)_([a-z]+)$/))) return `vT${m[1]}|${tpl(m[2])}|${m[3]}`;
  return name;
}

export async function solveChain(input: SolveInput): Promise<SolveResult> {
  const { model, nStages, hasFinal } = buildModel(input);
  if (input.relax) model.integers = [];
  const stable = (n: string) => stableName(n, input.items, input.templates);
  // A saved solution by stable name, translated to this model's variables.
  let warm: Map<string, number> | undefined;
  if (input.warmStart?.size) {
    const names = new Set([...model.objective.keys(), ...model.integers]);
    for (const r of model.rows) for (const v of r.coeffs.keys()) names.add(v);
    const byStable = new Map([...names].map((n) => [stable(n), n]));
    warm = new Map();
    for (const [n, v] of input.warmStart) {
      const own = byStable.get(n);
      if (own) warm.set(own, v);
    }
    // Every other variable starts at 0, so HiGHS gets a complete start to check.
    for (const n of names) if (!warm.has(n)) warm.set(n, 0);
  }
  const sol = await solveLp(model, {
    timeLimitSec: input.timeLimitSec,
    mipGap: input.mipGap,
    objectiveBound: input.objectiveBound === undefined ? undefined : input.objectiveBound * SCALE,
    ...(warm ? { start: warm } : {}),
  });
  const stats = sol.stats;
  if (sol.status === "infeasible" || sol.status === "error") return { status: sol.status, stats };
  if (!sol.values.size) return { status: sol.status, stats };

  const get = (name: string) => Math.round(sol.values.get(name) ?? 0);
  const { chain, items, templates, start } = input;
  const stages: Stage[] = [];
  for (let j = 0; j < nStages; j++) {
    const synths: SynthUse[] = [];
    items.forEach((it, i) => {
      const n = get(`vX${j}_${i}`);
      if (n > 0) synths.push({ kind: "item", name: it.name, count: n });
    });
    templates.forEach((t, ti) => {
      const n = get(`vY${j}_${ti}`);
      if (!n) return;
      if (!t.shell) {
        for (let c = 0; c < n; c++) synths.push({ kind: "sphere", recipe: t.recipe });
        return;
      }
      // Share the chosen items out over the copies, each unit to the copy with the most SP left.
      const fills = Array.from({ length: n }, () => ({
        sp: t.shell!.sp,
        items: new Map<string, number>(),
      }));
      items.forEach((it, i) => {
        for (let u = get(`vQ${j}_${ti}_${i}`); u > 0; u--) {
          const copy = fills.reduce((a, b) => (b.sp > a.sp ? b : a));
          copy.sp--;
          copy.items.set(it.name, (copy.items.get(it.name) ?? 0) + 1);
        }
      });
      for (const fill of fills) {
        const recipe = structuredClone(t.recipe);
        const last = recipe.stages[recipe.stages.length - 1];
        for (const [name, count] of fill.items) last.synths.push({ kind: "item", name, count });
        synths.push({ kind: "sphere", recipe });
      }
    });
    stages.push({ weaponId: chain[j], levelTo: get(`vL${j}`), synths });
  }
  if (!hasFinal) stages.push({ weaponId: chain[chain.length - 1], levelTo: 0, synths: [] });
  // Undo the objective scaling (see SCALE); the value keeps the 1/1000 secondary tie-break weight.
  const value = sol.value === undefined ? undefined : sol.value / SCALE;
  const stageChapters = input.progression
    ? Array.from(
        { length: nStages },
        (_, j) => [1, 2, 3, 4, 5, 6, 7, 8].find((c) => get(`vZ${j}_${c}`) === 1) ?? 8,
      )
    : undefined;
  // An in-between stage (one followed by a stage on the same weapon, which then does the build-up)
  // that the model left empty is no step at all.
  const keep = stages.map(
    (st, j) =>
      !(
        j + 1 < nStages &&
        isContinuation(chain, j + 1) &&
        st.synths.length === 0 &&
        st.levelTo ===
          (j === 0 ? start.level : isContinuation(chain, j) ? stages[j - 1].levelTo : 0)
      ),
  );
  return {
    status: sol.status,
    plan: { stages: stages.filter((_, j) => keep[j]) },
    value,
    ...(stageChapters ? { stageChapters: stageChapters.filter((_, j) => keep[j]) } : {}),
    stats,
    ...(input.relax
      ? {}
      : {
          solution: Object.fromEntries(
            [...sol.values]
              .filter(([, v]) => Math.abs(v) > 1e-9)
              .map(([n, v]) => [stable(n), Math.round(v * 1e6) / 1e6]),
          ),
        }),
  };
}
