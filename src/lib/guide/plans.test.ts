// Checks the predefined plans (data/generated/plans/, assembled into src/data/plans.json) against
// the config they were generated from: every configured plan has exactly one file, guide ids are
// <target>-<6 hex digits> and name their file, and every plan derives cleanly and delivers its goal.
import plansJson from "@/data/plans.json";
import { STAT_KEYS } from "@/lib/schemas";
import { getWeapon } from "@/lib/planner/sources";
import { z } from "zod";
import { describe, expect, test } from "vitest";
import { plansConfig } from "../../../scripts/planner/plans.config";
import { expandPlans, parsePlansConfig } from "../../../scripts/planner/plans-config";
import { readPlanFiles } from "../../../scripts/planner/plan-files";
import { deriveBuild } from "./derive";
import { guide } from "./types";

const file = z.object({ guides: z.array(guide) }).parse(plansJson);
const specs = expandPlans(parsePlansConfig(plansConfig));
const specById = new Map(specs.map((s) => [s.id, s]));
const files = readPlanFiles();

describe("predefined plans (src/data/plans.json)", () => {
  test("cover the config, one file per configured plan, with hash ids", () => {
    for (const s of specs)
      expect(
        files.filter((f) => f.spec === s.id),
        s.id,
      ).toHaveLength(1);
    expect(file.guides.map((g) => g.id).sort()).toEqual(files.map((f) => f.guide.id).sort());
    for (const f of files) {
      const target = f.spec ? specById.get(f.spec)?.targetId : undefined;
      expect(f.guide.id).toMatch(target ? new RegExp(`^${target}-[0-9a-f]{6}$`) : /-[0-9a-f]{6}$/);
      expect(f.guide.kind).toBe("builtin");
    }
  });

  test("every plan is simulator-valid and delivers its goal", () => {
    expect(file.guides.length).toBeGreaterThan(0);
    for (const { guide: g, spec: key } of files) {
      const d = deriveBuild(g);
      expect(d.errors, g.id).toEqual([]);
      for (const s of d.steps.values()) expect(s.errors, `${g.id}/${s.stepId}`).toEqual([]);
      // Standalone guides (no config entry any more) only need to derive cleanly.
      const spec = key ? specById.get(key) : undefined;
      if (!spec) continue;
      expect(d.final!.weaponId, g.id).toBe(spec.targetId);
      if (spec.goal === "max") {
        const max = getWeapon(spec.targetId).maxStats;
        for (const k of STAT_KEYS)
          expect(d.final!.stats[k], `${g.id} ${k}`).toBeGreaterThanOrEqual(max[k]);
      }
      for (const a of spec.abilities) expect(d.final!.abilities, `${g.id} ${a}`).toContain(a);
      // The optimal start may be a bought weapon; the guide records how to get it.
      expect(g.build!.acquire, g.id).toBeDefined();
    }
  });
});
