import { describe, expect, test } from "vitest";
import { plansConfig } from "./plans.config";
import { expandPlans, parsePlansConfig } from "./plans-config";
import { readPlanFiles } from "./plan-files";
import { compareScores, scorePlan, storyCost, type PlanScore } from "./plan-score";

const specs = expandPlans(parsePlansConfig(plansConfig));

describe("scoring generated plans", () => {
  test("a committed plan scores valid; the same guide judged against another target does not", () => {
    const file = readPlanFiles().find((f) => f.spec === "island-king/balanced")!;
    const spec = specs.find((s) => s.id === "island-king/balanced")!;
    const score = scorePlan(file.guide, spec);
    expect(score.problems).toEqual([]);
    expect(score.finish).toBeLessThanOrEqual(8);
    expect(score.cost).toBeGreaterThan(0);
    const other = specs.find((s) => s.id === "legend/balanced")!;
    expect(scorePlan(file.guide, other).problems.length).toBeGreaterThan(0);
  });

  test("valid beats invalid, then the earlier finish, then less effort, then less ABS", () => {
    const s = (over: Partial<PlanScore>): PlanScore => ({
      problems: [],
      finish: 7,
      abs: 40000,
      effort: 20,
      gilda: 40000,
      pace: 50,
      ...over,
    });
    const order = [
      s({ problems: ["fl 199/200"], abs: 1 }),
      s({ finish: 8, abs: 30000 }),
      s({ abs: 41000 }),
      s({}),
      s({ abs: 50000, effort: 15 }),
    ].sort(compareScores);
    expect(order.map((x) => [x.problems.length, x.finish, x.effort, x.abs])).toEqual([
      [0, 7, 15, 50000],
      [0, 7, 20, 40000],
      [0, 7, 20, 41000],
      [0, 8, 20, 30000],
      [1, 7, 20, 1],
    ]);
  });

  test("story plans compare by their story cost first", () => {
    const base: PlanScore = { problems: [], finish: 7, abs: 40000, effort: 20, gilda: 1, pace: 50 };
    const order = [
      { ...base, cost: 90000 },
      { ...base, finish: 8, abs: 60000, cost: 80000 },
      { ...base, problems: ["no Dark"], cost: 1 },
    ].sort(compareScores);
    expect(order.map((x) => x.cost)).toEqual([80000, 90000, 1]);
  });

  test("the story cost charges a stat below its floor and a level short before a build-up", () => {
    // LEGEND has the flat floor (Island King tries the rising one).
    const file = readPlanFiles().find((f) => f.spec === "legend/balanced")!;
    const spec = specs.find((s) => s.id === "legend/balanced")!;
    const cost = storyCost(file.guide, spec.progression);
    expect(storyCost(file.guide, { ...spec.progression, statFloor: 0.99 })).toBeGreaterThan(cost);
    expect(storyCost(file.guide, { ...spec.progression, buildUpLevel: 9 })).toBeGreaterThan(cost);
  });
});

test("a rising floor goes from 30% on the first weapon to 80% before the final one", async () => {
  const { floorShares } = await import("../../src/lib/planner/solve.ts");
  const p = { risingFloor: { from: 0.3, to: 0.8, gap: 0.1 } };
  const t = [0, 1, 2, 3, 4, 5, 6].map((i) => Math.round(100 * floorShares(p, i, 7).target));
  expect(t).toEqual([30, 40, 50, 60, 70, 80, 80]);
  expect(Math.round(100 * floorShares(p, 0, 7).min)).toBe(20);
  expect(floorShares({ statFloor: 0.5, minStatFloor: 0.4 }, 3, 7)).toEqual({
    target: 0.5,
    min: 0.4,
  });
});

test("items straight on the weapon cost full to halfway, then less to the last step", async () => {
  const { mainItemCostAt } = await import("../../src/lib/planner/solve.ts");
  const at = (j: number) => Math.round(mainItemCostAt(j, 7, 1000, 30));
  expect([0, 1, 2, 3, 4, 5, 6].map(at)).toEqual([1000, 1000, 1000, 1000, 677, 353, 30]);
  expect(mainItemCostAt(0, 1, 1000, 30)).toBe(1000);
});
