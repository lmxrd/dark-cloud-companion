import { describe, expect, test } from "vitest";
import { STAT_KEYS } from "@/lib/schemas";
import { deriveBuild } from "./derive";
import flamingoRaw from "./fixtures/story-flamingo.json";
import lastResortRaw from "./fixtures/story-last-resort.json";
import { splitStepsEarly } from "./split";
import type { Guide } from "./types";

// Two story plans frozen as the solver gave them, before splitting: one work step per weapon (and
// chapter). Flamingo Balanced has work that fits earlier on the same weapon; in Last Resort
// Balanced a Grenade Launcher sphere is ready while the Trumpet Gun is still held.
const flamingo = flamingoRaw as unknown as Guide;
const lastResort = lastResortRaw as unknown as Guide;
const story = { absGrindShare: 0.3, gildaGrindShare: 0.3 };
const chapter = (id?: string) => Number(id ?? 8);
const spheresOn = (g: Guide) => {
  const n = new Map<string, number>();
  for (const s of g.steps)
    if (s.build)
      n.set(
        s.build.weaponId,
        (n.get(s.build.weaponId) ?? 0) + s.build.synths.filter((u) => u.kind === "sphere").length,
      );
  return n;
};

describe("splitting work steps by chapter", () => {
  test.each([
    ["Flamingo", flamingo],
    ["Last Resort", lastResort],
  ])("keeps %s valid, as strong, as costly and in chapter order", (_, guide) => {
    const before = deriveBuild(guide);
    expect(before.errors).toEqual([]);
    const out = splitStepsEarly(guide, story);
    const after = deriveBuild(out);
    expect(after.errors).toEqual([]);
    for (const s of after.steps.values()) expect(s.errors).toEqual([]);
    expect(after.final?.weaponId).toBe(before.final?.weaponId);
    for (const k of STAT_KEYS) expect(after.final!.stats[k]).toBe(before.final!.stats[k]);
    expect(Math.round(after.total.abs)).toBe(Math.round(before.total.abs));
    expect(after.total.gilda).toBe(before.total.gilda);
    const chapters = out.steps.map((s) => chapter(s.chapterId));
    expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
  });

  test("work that fits earlier moves into an earlier step on the same weapon", () => {
    const out = splitStepsEarly(flamingo, story);
    const ids = new Set(flamingo.steps.map((s) => s.id));
    const added = out.steps.flatMap((s, i) => (ids.has(s.id) ? [] : [i]));
    expect(added).toHaveLength(2);
    for (const i of added) {
      // Between the build-up into its weapon and the rest of that weapon's work, a chapter earlier.
      const [s, next] = [out.steps[i], out.steps[i + 1]];
      expect(next.build?.weaponId).toBe(s.build?.weaponId);
      expect(chapter(s.chapterId)).toBeLessThan(chapter(next.chapterId));
    }
  });

  test("a sphere ready earlier moves onto the weapon held then", () => {
    const before = spheresOn(lastResort);
    const after = spheresOn(splitStepsEarly(lastResort, story));
    expect(after.get("trumpet-gun")).toBe(before.get("trumpet-gun")! + 1);
    expect(after.get("grenade-launcher")).toBe(before.get("grenade-launcher")! - 1);
    // Nothing else changes hands.
    for (const [w, n] of before)
      if (w !== "trumpet-gun" && w !== "grenade-launcher") expect(after.get(w)).toBe(n);
  });

  test("leaves a plan alone when no grinding is allowed and nothing fits the story", () => {
    for (const g of [flamingo, lastResort]) {
      const out = splitStepsEarly(g, { absGrindShare: -1, gildaGrindShare: -1 });
      expect(out.steps.map((s) => s.id)).toEqual(g.steps.map((s) => s.id));
    }
  });
});
