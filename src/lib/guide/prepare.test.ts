import { describe, expect, test } from "vitest";
import { stepItems } from "./buildItems";
import { deriveBuild } from "./derive";
import unpreparedRaw from "./fixtures/unprepared-five-star-armlet.json";
import { prepareSpheresEarly } from "./prepare";
import type { Guide } from "./types";

// Five-Star Armlet Balanced frozen without its prepare steps (every sphere made where it is synthed).
const base = unpreparedRaw as unknown as Guide;
const problems = (g: Guide) => {
  const d = deriveBuild(g);
  return [...d.errors, ...[...d.steps.values()].flatMap((s) => s.errors)];
};

describe("preparing side weapons ahead of time", () => {
  const prepared = prepareSpheresEarly(base);

  test("moves sphere work into earlier chapters without changing the total", () => {
    expect(prepared.steps.some((s) => s.prepare)).toBe(true);
    expect(problems(prepared)).toEqual([]);
    expect(deriveBuild(prepared).total.abs).toBe(deriveBuild(base).total.abs);
    // Each prepare step comes before the work step on its weapon, in an earlier chapter.
    prepared.steps.forEach((s, i) => {
      if (!s.prepare) return;
      const user = prepared.steps.findIndex(
        (x, j) => j > i && x.build?.weaponId === s.prepare!.weaponId,
      );
      expect(user).toBeGreaterThan(i);
      expect(Number(s.chapterId)).toBeLessThan(Number(prepared.steps[user].chapterId));
    });
  });

  test("a prepared sphere's items are listed in its prepare step, not where it is synthed", () => {
    const all = (g: Guide) => {
      const m = new Map<string, number>();
      for (const s of g.steps) stepItems(s, m);
      return m;
    };
    expect(all(prepared)).toEqual(all(base));
  });

  test("a sphere marked prepared without a prepare step is reported", () => {
    const broken: Guide = { ...prepared, steps: prepared.steps.filter((s) => !s.prepare) };
    expect(problems(broken).some((e) => e.includes("no earlier step prepares it"))).toBe(true);
  });
});
