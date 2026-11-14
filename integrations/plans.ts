// Predefined plans (built-in guides) are committed, one file per plan, in data/generated/plans/ and
// assembled into src/data/plans.json (git-ignored), which the app reads. Whenever Astro starts
// (dev, build, `astro sync`) and before the tests, after the game data has been exported, the
// assembled file is checked against a content hash over the game data, the planning code and the
// config; when it is stale, scripts/planner/predefined.ts re-solves the plans whose inputs changed
// (in parallel) and reassembles it. The plans themselves are configured in scripts/planner/plans.config.ts.
import type { AstroIntegration } from "astro";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const PLANS_OUT = join(ROOT, "src/data/plans.json");
/** The committed plans, one JSON file per plan. */
export const PLANS_DIR = join(ROOT, "data/generated/plans");

/** Everything that can change what the plans contain. Tests are never inputs. */
const INPUTS = [
  "drizzle/game.db",
  "scripts/db/export.ts",
  "scripts/planner",
  "src/lib/planner",
  "src/lib/weapons",
  "src/lib/guide",
  "src/lib/gamedata",
  "src/lib/data.ts",
  "src/lib/schemas.ts",
];

function walk(path: string): string[] {
  return statSync(path).isDirectory()
    ? readdirSync(path).flatMap((name) => walk(join(path, name)))
    : [path];
}

/**
 * Content hash over every input; stored in the generated file to detect staleness. Without the
 * config it covers only the game data and the planning code: each plan's own hash adds its settings
 * to that, so editing one variant re-solves only that plan.
 */
export function plansHash({ withConfig = true } = {}): string {
  const files = INPUTS.flatMap((p) => walk(join(ROOT, p)))
    .filter((f) => /\.(ts|tsx|json|db)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .filter((f) => withConfig || !f.endsWith("plans.config.ts"))
    // The generator's plumbing and benches don't change what a plan contains.
    .filter((f) => !/scripts\/planner\/(predefined|bench[\w-]*)\.ts$/.test(f))
    .sort();
  const hash = createHash("sha256");
  for (const f of files) hash.update(f.slice(ROOT.length)).update(readFileSync(f));
  return hash.digest("hex");
}

/** Makes sure src/data/plans.json matches the current inputs. */
export function ensurePlans(log: (m: string) => void = console.log): void {
  const hash = plansHash();
  const stored = existsSync(PLANS_OUT)
    ? JSON.parse(readFileSync(PLANS_OUT, "utf8")).hash
    : undefined;
  if (stored === hash) return log("predefined plans are up to date");
  log("predefined plans: inputs changed — updating");
  const r = spawnSync(
    "pnpm",
    ["exec", "vite-node", "--config", "vitest.config.ts", "scripts/planner/predefined.ts"],
    { stdio: "inherit", cwd: ROOT },
  );
  if (r.error || r.status !== 0) throw new Error("predefined plan generation failed");
}

export default function plans(): AstroIntegration {
  return {
    name: "dcc-predefined-plans",
    hooks: {
      "astro:config:setup": ({ logger }) => ensurePlans((m) => logger.info(m)),
    },
  };
}
