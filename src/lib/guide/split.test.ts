import { describe, expect, test } from "vitest";
import { STAT_KEYS } from "@/lib/schemas";
import { readPlanFiles } from "../../../scripts/planner/plan-files";
import { deriveBuild } from "./derive";
import { splitStepsEarly } from "./split";
import type { Guide } from "./types";

/**
 * The committed plans are already split (the generator splits them), so the test first joins each
 * run of work steps on one weapon back into its last step, as the solver gave it.
 */
function unsplit(guide: Guide): Guide {
  const steps: Guide["steps"] = [];
  for (const s of guide.steps) {
    const prev = steps[steps.length - 1];
    if (s.build && prev?.build && prev.build.weaponId === s.build.weaponId) {
      steps[steps.length - 1] = {
        ...s,
        build: { ...s.build, synths: [...prev.build.synths, ...s.build.synths] },
      };
    } else steps.push(s);
  }
  return { ...guide, steps };
}

const story = readPlanFiles()
  .filter((f) => !f.spec?.endsWith("/gilda-max"))
  .map((f) => ({ ...f, guide: unsplit(f.guide) }))
  .filter((f) => deriveBuild(f.guide).errors.length === 0);
const chapter = (id?: string) => Number(id ?? 8);

describe("splitting work steps by chapter", () => {
  test("keeps every story plan valid, as strong and in chapter order", () => {
    let added = 0;
    for (const f of story) {
      const before = deriveBuild(f.guide);
      const out = splitStepsEarly(f.guide, { absGrindShare: 0.3, gildaGrindShare: 0.3 });
      const after = deriveBuild(out);
      expect(after.errors, f.spec).toEqual([]);
      for (const s of after.steps.values()) expect(s.errors, f.spec).toEqual([]);
      expect(after.final?.weaponId, f.spec).toBe(before.final?.weaponId);
      for (const k of STAT_KEYS) expect(after.final!.stats[k], f.spec).toBe(before.final!.stats[k]);
      expect(Math.round(after.total.abs), f.spec).toBe(Math.round(before.total.abs));
      expect(after.total.gilda, f.spec).toBe(before.total.gilda);
      // New steps come between the build-up into their weapon and the rest of its work.
      const ids = new Set(f.guide.steps.map((s) => s.id));
      out.steps.forEach((s, i) => {
        if (ids.has(s.id)) return;
        added++;
        const next = out.steps[i + 1];
        expect(next.build?.weaponId, f.spec).toBe(s.build?.weaponId);
        expect(chapter(s.chapterId), f.spec).toBeLessThan(chapter(next.chapterId));
        expect(chapter(s.chapterId), f.spec).toBeGreaterThanOrEqual(
          chapter(out.steps[i - 1]?.chapterId ?? "1"),
        );
      });
    }
    expect(added).toBeGreaterThan(0);
  });

  test("leaves a plan alone when no grinding is allowed and nothing fits the story", () => {
    const f = story[0];
    const out = splitStepsEarly(f.guide, { absGrindShare: -1, gildaGrindShare: -1 });
    expect(out.steps.map((s) => s.id)).toEqual(f.guide.steps.map((s) => s.id));
  });
});
