import { describe, expect, test } from "vitest";
import { plansConfig } from "./plans.config";
import { expandPlans, parsePlansConfig } from "./plans-config";
import { readPlanFiles } from "./plan-files";
import { compareScores, scorePlan, type PlanScore } from "./plan-score";

const specs = expandPlans(parsePlansConfig(plansConfig));

describe("scoring generated plans", () => {
  test("a committed plan scores valid; the same guide judged against another target does not", () => {
    const file = readPlanFiles().find((f) => f.spec === "island-king/story")!;
    const spec = specs.find((s) => s.id === "island-king/story")!;
    const score = scorePlan(file.guide, spec);
    expect(score.problems).toEqual([]);
    expect(score.finish).toBeLessThanOrEqual(8);
    const other = specs.find((s) => s.id === "legend/story")!;
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
});
