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
//   --runs <n>                        solve each plan n times (default 2)
//   --replace                         keep the ids but don't compare with the committed plans
//                                     (after a change of settings, to take the new runs' best)
// Each plan is solved `--runs` times (the solver stops at a time limit, so runs differ a little);
// the best run and the committed plan are compared (plan-score.ts: valid, earliest finish, least
// ABS, earliest pace, least gilda) and the committed file only changes when a run is better.
// The runs are spread over parallel worker processes (the script runs itself with --worker).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { assemblePlans, PLANS_DIR, ROOT } from "../../integrations/plans.ts";
import { plansConfig } from "./plans.config.ts";
import { expandPlans, parsePlansConfig } from "./plans-config.ts";
import { planOne } from "./plan-one.ts";
import { newGuideId, planPath, readPlanFiles, type PlanFile } from "./plan-files.ts";
import { compareScores, scorePlan, scoreText } from "./plan-score.ts";
import type { Guide } from "../../src/lib/guide/types.ts";
import type { SavedSolution } from "../../src/lib/planner/plan.ts";

const specs = expandPlans(parsePlansConfig(plansConfig));
const fileFor = (key: string) => readPlanFiles().find((p) => p.spec === key);
const write = (file: PlanFile) =>
  writeFileSync(planPath(file.guide.id), JSON.stringify(file, null, 2) + "\n");

/** A run's candidate file: <out>/<key with / as __>@<run>.json holding the guide. */
const candidatePath = (out: string, key: string, run: number) =>
  join(out, `${key.replace("/", "__")}@${run}.json`);

/** Worker: solves the given runs ("<key>@<run>") and writes each candidate guide to `out`. */
async function worker(tasks: string[], out: string) {
  for (const task of tasks) {
    const [key, run] = task.split("@");
    const spec = specs.find((s) => s.id === key)!;
    const t0 = Date.now();
    try {
      // Start from the committed plan's solver values (a fresh guide with --new has none).
      const { guide, log, result } = await planOne(spec, undefined, fileFor(key)?.solution);
      writeFileSync(
        candidatePath(out, key, Number(run)),
        JSON.stringify({ guide, solution: result.solution }),
      );
      console.log(`  ${key} run ${run}: ${log} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (err) {
      console.log(`  ${key} run ${run}: failed (${String(err)})`);
    }
  }
}

/** Runs this script as a worker process for a share of the runs. */
function runWorker(tasks: string[], out: string): Promise<void> {
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
        tasks.join(","),
        out,
      ],
      { stdio: "inherit", cwd: ROOT },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`plan worker failed (${tasks.join(", ")})`)),
    );
  });
}

async function main(args: string[]) {
  const fresh = args.includes("--new");
  const replace = args.includes("--replace");
  const runsAt = args.indexOf("--runs");
  const runs = runsAt >= 0 ? Math.max(1, Number(args[runsAt + 1]) || 1) : 2;
  const keys = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--runs");
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
    const tasks = Array.from({ length: runs }, (_, run) =>
      order.map((s) => `${s.id}@${run}`),
    ).flat();
    // Each worker loads its own solver (~100 MB); leave a core for the rest of the machine.
    const workers = Math.max(1, Math.min(tasks.length, availableParallelism() - 1, 8));
    console.log(`predefined plans: ${order.length} plans × ${runs} runs on ${workers} processes`);
    const out = mkdtempSync(join(tmpdir(), "dcc-plans-"));
    const shares: string[][] = Array.from({ length: workers }, () => []);
    tasks.forEach((task, i) => shares[i % workers].push(task));
    await Promise.all(shares.map((share) => runWorker(share, out)));

    // Keep the best of the runs and the committed plan.
    for (const spec of order) {
      const current = fresh ? undefined : fileFor(spec.id);
      const candidates: { label: string; guide: Guide; solution?: SavedSolution }[] = [];
      if (current && !replace)
        candidates.push({ label: "committed", guide: current.guide, solution: current.solution });
      for (let run = 0; run < runs; run++) {
        const path = candidatePath(out, spec.id, run);
        if (existsSync(path))
          candidates.push({
            label: `run ${run + 1}`,
            ...(JSON.parse(readFileSync(path, "utf8")) as {
              guide: Guide;
              solution?: SavedSolution;
            }),
          });
      }
      const scored = candidates.map((c) => ({ ...c, score: scorePlan(c.guide, spec) }));
      scored.sort((a, b) => compareScores(a.score, b.score));
      console.log(`  ${spec.id}:`);
      for (const c of scored) console.log(`    ${c.label.padEnd(9)} ${scoreText(c.score)}`);
      const best = scored[0];
      if (!best || best.label === "committed") {
        console.log(`    → ${best ? "keeps the committed plan" : "no plan"}`);
        continue;
      }
      if (best.score.problems.length) {
        console.log("    → no valid plan; nothing written");
        continue;
      }
      const guide = best.guide;
      guide.id = current?.guide.id ?? newGuideId(spec.targetId, guide);
      mkdirSync(PLANS_DIR, { recursive: true });
      write({
        name: guide.title,
        spec: spec.id,
        guide,
        ...(best.solution ? { solution: best.solution } : {}),
      });
      console.log(`    → ${best.label} written as ${guide.id}`);
    }
    rmSync(out, { recursive: true, force: true });
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
if (workerAt >= 0) await worker(process.argv[workerAt + 1].split(","), process.argv[workerAt + 2]);
else await main(process.argv.slice(2));
