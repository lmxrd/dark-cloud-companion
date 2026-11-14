// Predefined plans (built-in guides) are generated into src/generated/plans.json (git-ignored)
// whenever Astro starts (dev, build, `astro sync`) and before the tests, after the game data has been
// exported. They only depend on the game data and the planning code, so a content hash over those
// decides whether anything has to be solved: the file is reused when its hash matches, restored from
// node_modules/.cache/dcc-plans when an earlier run produced the same hash, and generated otherwise
// (about a minute). The plans themselves are configured in scripts/planner/plans.config.ts.
import type { AstroIntegration } from "astro";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const PLANS_OUT = join(ROOT, "src/generated/plans.json");
export const PLANS_CACHE_DIR = join(ROOT, "node_modules/.cache/dcc-plans");

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

/** Content hash over every input; stored in the generated file to detect staleness. */
export function plansHash(): string {
  const files = INPUTS.flatMap((p) => walk(join(ROOT, p)))
    .filter((f) => /\.(ts|tsx|json|db)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .sort();
  const hash = createHash("sha256");
  for (const f of files) hash.update(f.slice(ROOT.length)).update(readFileSync(f));
  return hash.digest("hex");
}

/** Makes sure src/generated/plans.json matches the current inputs. */
export function ensurePlans(log: (m: string) => void = console.log): void {
  const hash = plansHash();
  const stored = existsSync(PLANS_OUT)
    ? JSON.parse(readFileSync(PLANS_OUT, "utf8")).hash
    : undefined;
  if (stored === hash) return log("predefined plans are up to date");
  const cached = join(PLANS_CACHE_DIR, `${hash}.json`);
  if (existsSync(cached)) {
    mkdirSync(dirname(PLANS_OUT), { recursive: true });
    copyFileSync(cached, PLANS_OUT);
    return log("predefined plans restored from cache");
  }
  log("predefined plans: inputs changed — generating");
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
