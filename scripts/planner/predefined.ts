// Generates the predefined plans (built-in guides), configured in scripts/planner/plans.config.ts.
// Each plan is committed as data/generated/plans/<guide id>.json ({ name, spec, guide }; see
// plan-files.ts). Plans are solved only when asked: a generated plan is reviewed, committed and
// from then on independent of the code (builds and tests only assemble the files, see
// integrations/plans.ts). Re-generating a plan keeps its guide id.
//   pnpm plans                        solve the configured plans that have no file yet
//   pnpm plans <target>/<variant>…    re-solve these plans (same guide ids)
//   pnpm plans <key>… --new           solve them as new guides (new ids) alongside the old ones,
//                                     which are kept as standalone guides
//   pnpm plans --all                  re-solve every configured plan
// Several plans are solved in parallel worker processes (the script runs itself with --worker).
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { assemblePlans, PLANS_DIR, ROOT } from "../../integrations/plans.ts";
import { plansConfig } from "./plans.config.ts";
import { expandPlans, parsePlansConfig } from "./plans-config.ts";
import { planOne } from "./plan-one.ts";
import { newGuideId, planPath, readPlanFiles, type PlanFile } from "./plan-files.ts";

const specs = expandPlans(parsePlansConfig(plansConfig));
const fileFor = (key: string) => readPlanFiles().find((p) => p.spec === key);
const write = (file: PlanFile) =>
  writeFileSync(planPath(file.guide.id), JSON.stringify(file, null, 2) + "\n");

/** Worker: solves the given plans and writes each one's file, keeping an existing guide id. */
async function worker(keys: string[]) {
  mkdirSync(PLANS_DIR, { recursive: true });
  for (const key of keys) {
    const spec = specs.find((s) => s.id === key)!;
    const t0 = Date.now();
    const { guide, log } = await planOne(spec);
    guide.id = fileFor(key)?.guide.id ?? newGuideId(spec.targetId, guide);
    write({ name: guide.title, spec: key, guide });
    console.log(`  ${guide.id}: ${log} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
}

/** Runs this script as a worker process for a share of the plans. */
function runWorker(keys: string[]): Promise<void> {
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
        keys.join(","),
      ],
      { stdio: "inherit", cwd: ROOT },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`plan worker failed (${keys.join(", ")})`)),
    );
  });
}

async function main(args: string[]) {
  const fresh = args.includes("--new");
  const keys = args.filter((a) => !a.startsWith("--"));
  const unknown = keys.filter((k) => !specs.some((s) => s.id === k));
  if (unknown.length)
    throw new Error(
      `unknown plan(s): ${unknown.join(", ")} (configured: ${specs.map((s) => s.id).join(", ")})`,
    );
  const todo = args.includes("--all")
    ? specs
    : keys.length
      ? specs.filter((s) => keys.includes(s.id))
      : specs.filter((s) => !fileFor(s.id));

  // New guides: the current ones stay as standalone guides (no longer tied to the config entry).
  if (fresh)
    for (const s of todo) {
      const old = fileFor(s.id);
      if (old) write({ name: old.name, guide: old.guide });
    }

  const began = Date.now();
  if (todo.length) {
    // Earliest plans take several solves: start them first so they don't end up last on a worker.
    const order = [...todo].sort(
      (a, b) => Number(b.flow === "earliest") - Number(a.flow === "earliest"),
    );
    // Each worker loads its own solver (~100 MB); leave a core for the rest of the machine.
    const workers = Math.max(1, Math.min(order.length, availableParallelism() - 1, 8));
    console.log(`predefined plans: solving ${order.length} on ${workers} processes`);
    const shares: string[][] = Array.from({ length: workers }, () => []);
    order.forEach((s, i) => shares[i % workers].push(s.id));
    await Promise.all(shares.map(runWorker));
    console.log(`predefined plans: done in ${((Date.now() - began) / 1000).toFixed(1)}s`);
  } else console.log("predefined plans: every configured plan has a file");

  const standalone = readPlanFiles().filter((p) => !p.spec || !specs.some((s) => s.id === p.spec));
  if (standalone.length)
    console.log(
      `standalone guides (kept, not re-solved): ${standalone.map((p) => p.guide.id).join(", ")}`,
    );
  assemblePlans();
}

const workerAt = process.argv.indexOf("--worker");
if (workerAt >= 0) await worker(process.argv[workerAt + 1].split(","));
else await main(process.argv.slice(2));
