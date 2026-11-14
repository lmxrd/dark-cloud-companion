// Generates the predefined plans (built-in guides) into src/generated/plans.json (git-ignored).
// What gets generated is configured in scripts/planner/plans.config.ts.
// Flow (see integrations/plans.ts): when the game data, the planning code or the config changed
// (content hash vs the one stored in the file), this script runs. Each plan is cached on its own in
// node_modules/.cache/dcc-plans (`plan-<hash>.json`, hash = game data + planning code + the plan's
// settings), so only plans whose inputs changed are solved, spread over several processes.
// By hand:
//   pnpm plans          regenerate only when stale
//   pnpm plans:force    re-solve every plan
// Internally the script runs itself with `--worker <ids>` to solve a share of the plans.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import type { Guide } from "../../src/lib/guide/types.ts";
import { PLANS_CACHE_DIR, PLANS_OUT, ROOT, plansHash } from "../../integrations/plans.ts";
import { plansConfig } from "./plans.config.ts";
import { expandPlans, parsePlansConfig, type PlanSpec } from "./plans-config.ts";
import { planOne } from "./plan-one.ts";

const specs = expandPlans(parsePlansConfig(plansConfig));
const codeHash = plansHash({ withConfig: false });
/** A plan's own hash: the game data and planning code plus its settings. */
const planHash = (spec: PlanSpec) =>
  createHash("sha256").update(codeHash).update(JSON.stringify(spec)).digest("hex");
const cacheFile = (spec: PlanSpec) => join(PLANS_CACHE_DIR, `plan-${planHash(spec)}.json`);

/** Worker: solves the given plans and caches each one. */
async function worker(ids: string[]) {
  mkdirSync(PLANS_CACHE_DIR, { recursive: true });
  for (const id of ids) {
    const spec = specs.find((s) => s.id === id);
    if (!spec) throw new Error(`unknown plan: ${id}`);
    const t0 = Date.now();
    const { guide, log } = await planOne(spec);
    writeFileSync(cacheFile(spec), JSON.stringify(guide));
    console.log(`  ${log} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
}

/** Runs this script as a worker process for a share of the plans. */
function runWorker(ids: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "exec",
        "vite-node",
        "--config",
        "vitest.config.ts",
        "scripts/planner/predefined.ts",
        "--worker",
        ids.join(","),
      ],
      { stdio: "inherit", cwd: ROOT },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`plan worker failed (${ids.join(", ")})`)),
    );
  });
}

async function main() {
  const force = process.argv.includes("--force");
  const hash = plansHash();
  if (!force && existsSync(PLANS_OUT)) {
    const stored = JSON.parse(readFileSync(PLANS_OUT, "utf8")) as { hash?: string };
    if (stored.hash === hash) return console.log("predefined plans are up to date");
  }

  const began = Date.now();
  // Earliest plans take several solves: start them first so they don't end up last on a worker.
  const missing = specs
    .filter((s) => force || !existsSync(cacheFile(s)))
    .sort((a, b) => Number(b.flow === "earliest") - Number(a.flow === "earliest"));
  if (missing.length) {
    // Each worker loads its own solver (~100 MB); leave a core for the rest of the build.
    const workers = Math.max(1, Math.min(missing.length, availableParallelism() - 1, 8));
    console.log(
      `predefined plans: solving ${missing.length} of ${specs.length} plans on ${workers} processes`,
    );
    const shares: string[][] = Array.from({ length: workers }, () => []);
    missing.forEach((s, i) => shares[i % workers].push(s.id));
    await Promise.all(shares.map(runWorker));
  }

  const guides = specs.map((s) => JSON.parse(readFileSync(cacheFile(s), "utf8")) as Guide);
  const json = JSON.stringify({ hash, guides }, null, 2) + "\n";
  mkdirSync(dirname(PLANS_OUT), { recursive: true });
  writeFileSync(PLANS_OUT, json);
  writeFileSync(join(PLANS_CACHE_DIR, `${hash}.json`), json);
  console.log(
    `predefined plans: ${guides.length} guides written to src/generated/plans.json in ${((Date.now() - began) / 1000).toFixed(1)}s` +
      (missing.length < specs.length ? ` (${specs.length - missing.length} from cache)` : ""),
  );
}

const workerAt = process.argv.indexOf("--worker");
if (workerAt >= 0) await worker(process.argv[workerAt + 1].split(","));
else await main();
