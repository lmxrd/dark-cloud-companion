// The committed plan files in data/generated/plans/: <guide id>.json with { name, spec, guide }.
// A guide's id is its target weapon plus a short hash of its content when it was first generated
// (e.g. island-king-3f9a2c). It never changes afterwards: profiles keep ticks and dashboard switches
// under it, and it is the guide's URL. `spec` is the plans.config.ts entry the plan is generated
// from (<target>/<variant>); a file without one is a standalone guide, kept but never re-solved.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Guide } from "../../src/lib/guide/types.ts";
import { PLANS_DIR } from "../../integrations/plans.ts";

export interface PlanFile {
  /** Readable name (the guide's title). */
  name: string;
  /** The config entry it is generated from; absent for a standalone guide. */
  spec?: string;
  guide: Guide;
}

export const planPath = (guideId: string) => join(PLANS_DIR, `${guideId}.json`);

/** Every committed plan file, by file name order. */
export function readPlanFiles(): PlanFile[] {
  return existsSync(PLANS_DIR)
    ? readdirSync(PLANS_DIR)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => JSON.parse(readFileSync(join(PLANS_DIR, f), "utf8")) as PlanFile)
    : [];
}

/** A new guide id: the target weapon and the first 6 hex digits of the content's hash. */
export function newGuideId(targetId: string, guide: Guide): string {
  const content = JSON.stringify({ ...guide, id: "" });
  return `${targetId}-${createHash("sha256").update(content).digest("hex").slice(0, 6)}`;
}
