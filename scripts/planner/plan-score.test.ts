import { describe, expect, test } from "vitest";
import { plansConfig } from "./plans.config";
import { expandPlans, parsePlansConfig } from "./plans-config";
import flamingoRaw from "../../src/lib/guide/fixtures/story-flamingo.json";
import type { Guide } from "../../src/lib/guide/types";
import { compareScores, scorePlan, storyCost, type PlanScore } from "./plan-score";

const specs = expandPlans(parsePlansConfig(plansConfig));
// Flamingo Balanced, frozen as the solver gave it (see src/lib/guide/split.test.ts).
const flamingo = flamingoRaw as unknown as Guide;
const flamingoSpec = specs.find((s) => s.id === "flamingo/balanced")!;

describe("scoring generated plans", () => {
  test("a plan scores valid; the same guide judged against another target does not", () => {
    const score = scorePlan(flamingo, flamingoSpec);
    expect(score.problems).toEqual([]);
    expect(score.finish).toBeLessThanOrEqual(8);
    expect(score.cost).toBeGreaterThan(0);
    const other = specs.find((s) => s.id === "legend/balanced")!;
    expect(scorePlan(flamingo, other).problems.length).toBeGreaterThan(0);
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
    const spec = flamingoSpec;
    const cost = storyCost(flamingo, spec.progression);
    const high = { from: 0.99, to: 0.99, gap: 0 };
    expect(storyCost(flamingo, { ...spec.progression, risingFloor: high })).toBeGreaterThan(cost);
    expect(storyCost(flamingo, { ...spec.progression, buildUpLevel: 9 })).toBeGreaterThan(cost);
  });

  test("the story cost charges the chapter of the first sphere bringing a wanted ability", () => {
    const spec = flamingoSpec;
    const off = { ...spec.progression, keyAbilityCost: 0, abilityCost: 0 };
    const one = { ...off, keyAbilityCost: 1 };
    const extra = storyCost(flamingo, one, ["abs-up"]) - storyCost(flamingo, off, ["abs-up"]);
    // One unit per chapter: the chapter the ABS Up sphere goes in.
    expect(extra).toBeGreaterThanOrEqual(1);
    expect(extra).toBeLessThanOrEqual(8);
  });
});
