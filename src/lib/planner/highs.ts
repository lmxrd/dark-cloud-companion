import loadHighs from "highs";

type Highs = Awaited<ReturnType<typeof loadHighs>>;
let instance: Promise<Highs> | undefined;

/** Lazily loads the HiGHS WebAssembly solver (once). In the browser the wasm file is fetched from the app bundle. */
export function getHighs(): Promise<Highs> {
  instance ??= (async () => {
    const isNode = typeof process !== "undefined" && !!process.versions?.node;
    if (isNode) return loadHighs();
    const wasm = (await import("highs/runtime?url")).default;
    return loadHighs({ locateFile: () => wasm });
  })();
  return instance;
}

export interface LpRow {
  name: string;
  coeffs: Map<string, number>;
  min?: number;
  max?: number;
}

export interface LpModel {
  /** Variable name -> objective coefficient. */
  objective: Map<string, number>;
  rows: LpRow[];
  integers: string[];
  /** Upper bounds for variables (lower bound is always 0). */
  upper?: Map<string, number>;
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(6));
const term = (c: number, v: string) => `${c < 0 ? "-" : "+"} ${num(Math.abs(c))} ${v}`;

/** Serialises to CPLEX LP format (variable/row names must start with a letter other than e/E followed by digits). */
export function toLp(m: LpModel): string {
  const out: string[] = ["Minimize"];
  const obj = [...m.objective].filter(([, c]) => c !== 0);
  out.push(` obj: ${obj.length ? obj.map(([v, c]) => term(c, v)).join(" ") : "0 vz"}`);
  out.push("Subject To");
  for (const r of m.rows) {
    const expr = [...r.coeffs]
      .filter(([, c]) => c !== 0)
      .map(([v, c]) => term(c, v))
      .join(" ");
    if (!expr) continue;
    if (r.min !== undefined) out.push(` ${r.name}_lo: ${expr} >= ${num(r.min)}`);
    if (r.max !== undefined) out.push(` ${r.name}_hi: ${expr} <= ${num(r.max)}`);
  }
  if (m.upper?.size) {
    out.push("Bounds");
    for (const [v, u] of m.upper) out.push(` 0 <= ${v} <= ${num(u)}`);
  }
  if (m.integers.length) {
    out.push("Generals");
    out.push(` ${m.integers.join(" ")}`);
  }
  out.push("End");
  return out.join("\n");
}

/** How a solve went: for judging time limits. */
export interface SolveStats {
  /** Wall-clock seconds of the solve. */
  seconds: number;
  /** When the first plan (feasible solution) was found, if any. */
  firstSec?: number;
  /** How many times the best plan improved. */
  improvements: number;
  /** When the best plan last improved. */
  lastSec?: number;
  /** Relative gap between the best plan and the proven bound when it stopped (0: proven optimal). */
  gap?: number;
  /** Starting values given and how many of them matched a variable of the model. */
  start?: { given: number; matched: number };
}

export interface LpSolution {
  status: "optimal" | "infeasible" | "timedout" | "error";
  value?: number;
  values: Map<string, number>;
  stats: SolveStats;
}

/**
 * Solves a model with HiGHS. `start` gives starting values by variable name (a "MIP start", e.g.
 * the solution a plan was made from): names the model doesn't have are skipped, and HiGHS checks the
 * rest and completes or repairs them, so a stale start costs nothing but can save the search for a
 * first plan.
 */
export async function solveLp(
  m: LpModel,
  opts: {
    timeLimitSec?: number;
    mipGap?: number;
    objectiveBound?: number;
    start?: ReadonlyMap<string, number>;
  } = {},
): Promise<LpSolution> {
  const highs = await getHighs();
  const t0 = Date.now();
  return highs.withModel({ format: "lp", data: toLp(m) }, (model): LpSolution => {
    model.options.set({
      output_flag: false,
      time_limit: opts.timeLimitSec ?? 10,
      mip_rel_gap: opts.mipGap ?? 0.001,
      // Primal bound: solutions no better than this are cut off (reported as no solution).
      ...(opts.objectiveBound !== undefined ? { objective_bound: opts.objectiveBound } : {}),
    });
    const { numCols } = model.getDimensions();
    const names = Array.from({ length: numCols }, (_, i) => model.getColName(i));
    let start: SolveStats["start"];
    if (opts.start?.size) {
      const index = new Map(names.map((n, i) => [n, i]));
      const indices: number[] = [];
      const values: number[] = [];
      for (const [n, v] of opts.start) {
        const i = index.get(n);
        if (i === undefined) continue;
        indices.push(i);
        values.push(v);
      }
      start = { given: opts.start.size, matched: indices.length };
      if (indices.length)
        try {
          model.setSolution({ indices, values });
        } catch {
          // A start HiGHS can't take is just not used.
        }
    }
    let firstSec: number | undefined;
    let improvements = 0;
    let lastSec: number | undefined;
    const run = model.run({
      [highs.constants.callbackType.mipImprovingSolution](event) {
        improvements++;
        firstSec ??= event.data.running_time;
        lastSec = event.data.running_time;
      },
    });
    const S = highs.constants.modelStatus;
    const info = (name: string) => {
      try {
        return Number(model.info.get(name));
      } catch {
        return undefined;
      }
    };
    const stats: SolveStats = {
      seconds: (Date.now() - t0) / 1000,
      ...(firstSec !== undefined ? { firstSec } : {}),
      improvements,
      ...(lastSec !== undefined ? { lastSec } : {}),
      ...(m.integers.length && info("mip_gap") !== undefined ? { gap: info("mip_gap") } : {}),
      ...(start ? { start } : {}),
    };
    // 2 = a feasible primal solution is available.
    const feasible = info("primal_solution_status") === 2;
    const values = new Map<string, number>();
    if (feasible) {
      const x = model.getSolution().colValue;
      names.forEach((n, i) => values.set(n, x[i]));
    }
    const value = feasible ? model.getObjectiveValue() : undefined;
    const status = run.modelStatus;
    if (status === S.optimal) return { status: "optimal", value, values, stats };
    if (
      status === S.infeasible ||
      status === S.unboundedOrInfeasible ||
      status === S.objectiveBound
    )
      return { status: "infeasible", values: new Map(), stats };
    if (status === S.timeLimit || status === S.interrupted)
      return feasible
        ? { status: "timedout", value, values, stats }
        : { status: "timedout", values, stats };
    return { status: "error", values, stats };
  });
}
