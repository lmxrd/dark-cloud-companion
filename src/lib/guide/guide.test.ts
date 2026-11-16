import { describe, expect, test } from "vitest";
import { checklist, sections } from "@/lib/data";

import { deriveBuild } from "./derive";
import lastResortRaw from "./fixtures/story-last-resort.json";
import { mainWalkthrough } from "./main";
import { entryTickIds, knownItemIds, knownSectionIds } from "./refs";
import { guide as guideSchema, type Guide } from "./types";

describe("main walkthrough", () => {
  test("validates and has unique step ids", () => {
    expect(guideSchema.safeParse(mainWalkthrough).success).toBe(true);
    const ids = mainWalkthrough.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("references every checklist item exactly once", () => {
    const refs = mainWalkthrough.steps
      .flatMap((s) => s.entries)
      .flatMap((e) => (e.kind === "item" ? [e.ref] : []));
    expect(refs).toHaveLength(checklist.length);
    expect(new Set(refs)).toEqual(new Set(checklist.map((i) => i.id)));
  });

  test("references every section that has facts exactly once, and only real data", () => {
    const refs = mainWalkthrough.steps
      .flatMap((s) => s.entries)
      .flatMap((e) => (e.kind === "section" ? [e.ref] : []));
    expect(new Set(refs).size).toBe(refs.length);
    for (const r of refs) expect(knownSectionIds.has(r)).toBe(true);
    for (const s of sections.filter((x) => x.medals)) expect(refs).toContain(s.id);
    for (const e of mainWalkthrough.steps.flatMap((s) => s.entries))
      if (e.kind === "item") expect(knownItemIds.has(e.ref)).toBe(true);
  });

  test("tick ids of all entries cover every collectable and medal exactly once", () => {
    const ticks = mainWalkthrough.steps.flatMap((s) =>
      s.entries.flatMap((e) => entryTickIds("main", s.id, e)),
    );
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  test("post-game items are in chapter 8, the post-game chapter", () => {
    const refs = mainWalkthrough.steps
      .filter((s) => s.chapterId === "8")
      .flatMap((s) => s.entries.flatMap((e) => (e.kind === "item" ? [e.ref] : [])));
    expect(new Set(refs)).toEqual(new Set(checklist.filter((i) => i.postgame).map((i) => i.id)));
  });

  test("steps keep their chapter and section placement", () => {
    for (const s of mainWalkthrough.steps) {
      expect(s.chapterId).toBeTruthy();
      if (s.sectionId)
        expect(sections.find((x) => x.id === s.sectionId)?.chapterId).toBe(s.chapterId);
    }
  });
});

/** A story plan as the solver gave it (see split.test.ts). */
const lastResort = lastResortRaw as unknown as Guide;

describe("deriveBuild", () => {
  test("a guide without build steps derives nothing", () => {
    expect(deriveBuild(mainWalkthrough).steps.size).toBe(0);
  });

  test("reports per-step errors when an edited build no longer works", () => {
    // Drop every synth and level, so no build-up's requirements can be met.
    const broken = structuredClone(lastResort);
    for (const s of broken.steps)
      if (s.build) {
        s.build.synths = [];
        s.build.levelTo = 0;
      }
    const d = deriveBuild(broken);
    expect([...d.steps.values()].some((x) => x.errors.length > 0)).toBe(true);
  });

  test("a build guide without a start weapon is reported", () => {
    const { build: _drop, ...rest } = lastResort;
    expect(deriveBuild(rest as Guide).errors.length).toBeGreaterThan(0);
  });
});

describe("appendPlanToGuide", () => {
  test("continues a build guide from where it ends and the result derives without errors", async () => {
    const { planPath } = await import("@/lib/planner/plan");
    const { planResultToGuide, appendPlanToGuide } = await import("./fromPlan");
    const { getWeapon } = await import("@/lib/planner/sources");
    const { freshState } = await import("@/lib/weapons/mechanics");
    const start = freshState(getWeapon("battle-wrench"));
    const make = async (from: typeof start, target: string) => {
      const result = await planPath({
        start: from,
        targetId: target,
        objective: "abs",
        goal: { kind: "reach" },
        maxChapter: 3,
        spBonus: 1,
      });
      return {
        result,
        guide: planResultToGuide({ title: target, result, start: from, spBonus: 1 }),
      };
    };
    const first = await make(start, "drill-wrench");
    const d1 = deriveBuild(first.guide);
    expect(d1.errors).toEqual([]);
    const second = await make(d1.final!, "smash-wrench");
    const combined = appendPlanToGuide(first.guide, second.guide, "Both");
    const d = deriveBuild(combined);
    expect(d.errors).toEqual([]);
    for (const s of d.steps.values()) expect(s.errors).toEqual([]);
    // The plans just reach the weapon: they end with the build-up into it.
    expect(combined.steps.at(-1)!.buildUp!.weaponId).toBe("smash-wrench");
    expect(combined.steps.some((s) => s.buildUp?.weaponId === "drill-wrench")).toBe(true);
    expect(d.final!.weaponId).toBe("smash-wrench");
  }, 120000);
});

describe("build-up steps", () => {
  const base = async () => {
    const { getWeapon } = await import("@/lib/planner/sources");
    const { freshState } = await import("@/lib/weapons/mechanics");
    const { stateToBuildStart } = await import("./fromPlan");
    return stateToBuildStart(freshState(getWeapon("battle-wrench")), 1);
  };
  const work = (id: string, weaponId: string, levelTo: number) => ({
    id,
    title: id,
    notes: "",
    entries: [],
    build: { weaponId, levelTo, synths: [] },
  });
  const up = (id: string, weaponId: string) => ({
    id,
    title: id,
    notes: "",
    entries: [],
    buildUp: { weaponId },
  });

  test("a build-up step builds up between work steps and owns the build-up's checks", async () => {
    const g: Guide = {
      id: "g",
      title: "T",
      kind: "custom",
      build: await base(),
      steps: [
        work("a", "battle-wrench", 3),
        up("b", "true-battle-wrench"),
        work("c", "true-battle-wrench", 2),
      ],
    };
    const d = deriveBuild(g);
    expect(d.errors).toEqual([]);
    expect(d.final!.weaponId).toBe("true-battle-wrench");
    expect(d.steps.get("b")!.nextWeaponId).toBe("true-battle-wrench");
    expect(d.steps.get("b")!.stats).toEqual(d.steps.get("a")!.stats);
    // The work step leaves the build-up to the build-up step.
    expect(d.steps.get("a")!.nextWeaponId).toBeUndefined();
    expect(d.steps.get("a")!.requirements).toBeDefined();
  });

  test("a build-up at the end still builds up; one into the wrong weapon is reported", async () => {
    const ends: Guide = {
      id: "g",
      title: "T",
      kind: "custom",
      build: await base(),
      steps: [work("a", "battle-wrench", 3), up("b", "true-battle-wrench")],
    };
    expect(deriveBuild(ends).final!.weaponId).toBe("true-battle-wrench");
    const wrong: Guide = {
      ...ends,
      steps: [...ends.steps, work("c", "battle-wrench", 4)],
    };
    expect(deriveBuild(wrong).steps.get("b")!.errors.join(" ")).toMatch(/next step works on/);
  });
});
