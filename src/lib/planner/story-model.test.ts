// The story rules as the MILP encodes them: built without solving, so each test reads the rows and
// objective coefficients a rule adds (names as in solve.ts) and checks they say what the rule says.
import { describe, expect, test } from "vitest";
import { freshState } from "@/lib/weapons/mechanics";
import { allyBonus, getWeapon, synthSources } from "./sources";
import { buildModel, type Progression, type SolveInput } from "./solve";
import { STAT_KEYS } from "@/lib/schemas";

/** solve.ts's objective scale: every coefficient is SCALE times its value in ABS units. */
const SCALE = 1000;
const items = synthSources.filter((s) => s.name === "Scrap of Metal" || s.name === "Bolt");
const start = freshState(getWeapon("battle-wrench"));
const flat = (n: number) => Array.from({ length: 9 }, () => n);

function model(progression: Partial<Progression> = {}, extra: Partial<SolveInput> = {}) {
  return buildModel({
    start,
    chain: ["battle-wrench", "drill-wrench"],
    objective: "abs",
    spBonus: 1,
    items,
    templates: [],
    maxLevel: 10,
    progression: {
      stageUnlock: [1],
      storyAbs: flat(100000),
      storyGilda: flat(100000),
      grindAbs: flat(0),
      grindGilda: flat(0),
      spentGilda: 0,
      delayCost: 0,
      itemChapter: items.map(() => 1),
      ...progression,
    },
    ...extra,
  }).model;
}
const rowOf = (m: ReturnType<typeof model>, name: string) => m.rows.find((r) => r.name === name);

describe("stats lost to caps (lostStatCost)", () => {
  test("each stat but At is exact, the points lost carry the cost", () => {
    const m = model({ lostStatCost: 5 });
    for (const k of STAT_KEYS) {
      const r = rowOf(m, `cSt0_${k}`)!;
      if (k === "at") {
        expect(r.min).toBeUndefined();
        expect(r.coeffs.has(`vW0_${k}`)).toBe(false);
      } else {
        expect(r.min).toBe(r.max);
        expect(r.coeffs.get(`vW0_${k}`)).toBe(1);
        expect(m.objective.get(`vW0_${k}`)).toBe(SCALE * 5);
      }
    }
  });

  test("without it, a stat may simply fall short of what was brought", () => {
    const m = model();
    expect(rowOf(m, "cSt0_fl")!.min).toBeUndefined();
    expect([...m.objective.keys()].some((v) => v.startsWith("vW"))).toBe(false);
  });
});

describe("stats held early (earlyStatBonus)", () => {
  test("a point gained in chapter c earns the bonus for every chapter to the end", () => {
    const m = model({ earlyStatBonus: 2, stageUnlock: [3] });
    // The stage can go in any chapter from 3 on: earlier is worth more.
    for (const c of [3, 4, 5, 6, 7, 8])
      expect(m.objective.get(`vU0_${c}`)).toBe(-SCALE * 2 * (9 - c));
    expect(m.objective.has("vU0_2")).toBe(false);
    // Points a stage loses overall are charged at its earliest chapter's full weight.
    expect(m.objective.get("vN0")).toBe(SCALE * 2 * (9 - 3));
  });

  test("a plan that must finish early counts to its own last chapter", () => {
    const m = model({ earlyStatBonus: 2, stageUnlock: [2], lastChapter: 5 });
    expect(m.objective.get("vU0_2")).toBe(-SCALE * 2 * (6 - 2));
    expect(m.objective.has("vU0_6")).toBe(false);
  });

  test("a chapter's reward needs the stage to be in that chapter", () => {
    const m = model({ earlyStatBonus: 2, stageUnlock: [3] });
    const w = getWeapon("battle-wrench");
    const most = STAT_KEYS.reduce((n, k) => n + w.maxStats[k], 0);
    const r = rowOf(m, "cGainZ0_4")!;
    expect(r.max).toBe(0);
    expect(r.coeffs.get("vU0_4")).toBe(1);
    expect(r.coeffs.get("vZ0_4")).toBe(-most);
  });
});

describe("tight bounds", () => {
  test("no stage can synth more than the SP its weapon can ever have", () => {
    const m = model();
    const w = getWeapon("battle-wrench");
    // Every level up to the cap pays its SP (plus the ally bonus); the start's own SP come first.
    const spCap = start.sp + (w.spPerLevel + allyBonus(w, 1)) * (10 - start.level);
    items.forEach((_, i) => expect(m.upper!.get(`vX0_${i}`)).toBe(Math.floor(spCap)));
  });

  test("a chapter's ABS gate is no wider than the stage could spend", () => {
    const m = model({ absWeights: flat(1), stageUnlock: [1] });
    // B[j][c] ≤ min(story ABS by c, all the ABS the stage could spend) · Z[j][c].
    const gate = rowOf(m, "cEffZ0_1")!;
    const bound = -gate.coeffs.get("vZ0_1")!;
    expect(bound).toBeGreaterThan(0);
    expect(bound).toBeLessThan(100000);
  });
});
