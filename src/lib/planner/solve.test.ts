import { describe, expect, test } from "vitest";
import { freshState } from "@/lib/weapons/mechanics";
import { getWeapon, synthSources } from "./sources";
import { simulatePlan } from "./simulate";
import { floorShares, mainItemCostAt, solveChain } from "./solve";

const items = synthSources.filter((s) => Object.keys(s.gains).some((k) => k !== "du"));
const start = freshState(getWeapon("battle-wrench"));

describe("solveChain (items only)", () => {
  const base = (extra: Record<string, unknown> = {}) => ({
    start,
    chain: ["battle-wrench", "drill-wrench"],
    objective: "abs" as const,
    spBonus: 1,
    items,
    templates: [],
    ...extra,
  });

  test("Battle Wrench -> Drill Wrench is solved and the plan simulates cleanly", async () => {
    const r = await solveChain(base());
    expect(r.status).toBe("optimal");
    const sim = simulatePlan(start, r.plan!, { spBonus: 1 });
    expect(sim.errors).toEqual([]);
    expect(sim.state.weaponId).toBe("drill-wrench");
    // Levelling to +2 and synthing is far cheaper than levelling all the way to +4 (176 ABS).
    expect(sim.cost.abs).toBeLessThan(176);
  });

  test("the objective value is the simulated cost plus a small secondary weight", async () => {
    const r = await solveChain(base());
    expect(r.status).toBe("optimal");
    const sim = simulatePlan(start, r.plan!, { spBonus: 1 });
    const key = sim.cost.abs + 1e-3 * sim.cost.gilda;
    expect(Math.abs(r.value! - key)).toBeLessThan(1e-6);
  });

  test("objectiveBound prunes chains that cannot beat it", async () => {
    const best = await solveChain(base());
    expect(best.status).toBe("optimal");
    const pruned = await solveChain(base({ objectiveBound: best.value! - 100 }));
    expect(pruned.plan).toBeUndefined();
    const kept = await solveChain(base({ objectiveBound: best.value! + 100 }));
    expect(kept.status).toBe("optimal");
    expect(kept.plan).toBeDefined();
  });
});

test("a rising floor goes from 30% on the first weapon to 80% before the final one", () => {
  const p = { risingFloor: { from: 0.3, to: 0.8, gap: 0.1 } };
  const t = [0, 1, 2, 3, 4, 5, 6].map((i) => Math.round(100 * floorShares(p, i, 7).target));
  expect(t).toEqual([30, 40, 50, 60, 70, 80, 80]);
  expect(Math.round(100 * floorShares(p, 0, 7).min)).toBe(20);
  expect(floorShares({ statFloor: 0.5, minStatFloor: 0.4 }, 3, 7)).toEqual({
    target: 0.5,
    min: 0.4,
  });
});

test("items straight on the weapon cost full to halfway, then less to the last step", () => {
  const at = (j: number) => Math.round(mainItemCostAt(j, 7, 1000, 30));
  expect([0, 1, 2, 3, 4, 5, 6].map(at)).toEqual([1000, 1000, 1000, 1000, 677, 353, 30]);
  expect(mainItemCostAt(0, 1, 1000, 30)).toBe(1000);
});
