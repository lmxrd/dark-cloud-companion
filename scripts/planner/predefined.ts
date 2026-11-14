// Generates the predefined plans (built-in guides), configured in scripts/planner/plans.config.ts.
// Each plan is committed as data/generated/plans/<plan id>.json ({ name, guide }). Plans are solved
// only when asked: a generated plan is reviewed, committed and from then on independent of the
// code (builds and tests only assemble the files, see integrations/plans.ts).
//   pnpm plans                  solve the configured plans that have no file yet
//   pnpm plans <id> [<id>…]     (re-)solve these plans
//   pnpm plans --all            re-solve every configured plan
// Several plans are solved in parallel worker processes (the script runs itself with --worker).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import type { Guide } from "../../src/lib/guide/types.ts";
import { assemblePlans, PLANS_DIR, ROOT } from "../../integrations/plans.ts";
import { plansConfig } from "./plans.config.ts";
import { expandPlans, parsePlansConfig } from "./plans-config.ts";
import { planOne } from "./plan-one.ts";

const specs = expandPlans(parsePlansConfig(plansConfig));
const planFile = (id: string) => join(PLANS_DIR, `${id}.json`);

/** A committed plan: a readable name and the guide. */
interface PlanFile {
  name: string;
  guide: Guide;
}

/** Worker: solves the given plans and writes each one's file. */
async function worker(ids: string[]) {
  mkdirSync(PLANS_DIR, { recursive: true });
  for (const id of ids) {
    const spec = specs.find((s) => s.id === id)!;
    const t0 = Date.now();
    const { guide, log } = await planOne(spec);
    const file: PlanFile = { name: guide.title, guide };
    writeFileSync(planFile(id), JSON.stringify(file, null, 2) + "\n");
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

async function main(args: string[]) {
  const unknown = args.filter((a) => a !== "--all" && !specs.some((s) => s.id === a));
  if (unknown.length) throw new Error(`unknown plan(s): ${unknown.join(", ")}`);
  const todo = args.includes("--all")
    ? specs
    : args.length
      ? specs.filter((s) => args.includes(s.id))
      : specs.filter((s) => !existsSync(planFile(s.id)));

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

  const known = new Set(specs.map((s) => `${s.id}.json`));
  const stray = (existsSync(PLANS_DIR) ? readdirSync(PLANS_DIR) : []).filter(
    (f) => f.endsWith(".json") && !known.has(f),
  );
  if (stray.length)
    console.log(`not configured (delete them if no longer wanted): ${stray.join(", ")}`);
  assemblePlans();
}

const workerAt = process.argv.indexOf("--worker");
if (workerAt >= 0) await worker(process.argv[workerAt + 1].split(","));
else await main(process.argv.slice(2));
