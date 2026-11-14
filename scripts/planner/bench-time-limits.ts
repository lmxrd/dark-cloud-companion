// Compares the predefined plans at several solver time limits, under the same parallel load as a
// build (one worker process per core but one, at most 8). Writes a table to stdout and, as JSON,
// to the path given with --out.
// Run: pnpm exec vite-node --config vitest.config.ts scripts/planner/bench-time-limits.ts [--limits 3,5,10] [--out file.json]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { ROOT } from "../../integrations/plans.ts";
import { plansConfig } from "./plans.config.ts";
import { expandPlans, parsePlansConfig } from "./plans-config.ts";
import { planOne } from "./plan-one.ts";

interface Row {
  id: string;
  limit: number;
  abs: number;
  gilda: number;
  steps: number;
  seconds: number;
}

const specs = expandPlans(parsePlansConfig(plansConfig));
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function worker(limit: number, ids: string[]) {
  for (const id of ids) {
    const spec = specs.find((s) => s.id === id)!;
    const t0 = Date.now();
    const { result } = await planOne(spec, limit);
    const c = result.simulation!.cost;
    const row: Row = { id, limit, ...c, seconds: (Date.now() - t0) / 1000 };
    console.log(`RESULT ${JSON.stringify(row)}`);
  }
}

function runWorker(limit: number, ids: string[]): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "exec",
        "vite-node",
        "--config",
        "vitest.config.ts",
        "scripts/planner/bench-time-limits.ts",
        "--worker",
        String(limit),
        ids.join(","),
      ],
      { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] },
    );
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve(
            out
              .split("\n")
              .filter((l) => l.startsWith("RESULT "))
              .map((l) => JSON.parse(l.slice(7)) as Row),
          )
        : reject(new Error(`worker failed at ${limit}s`)),
    );
  });
}

async function main() {
  const limits = (arg("--limits") ?? "3,5,10,15,20,30,60").split(",").map(Number);
  const workers = Math.max(1, Math.min(specs.length, availableParallelism() - 1, 8));
  const order = [...specs].sort(
    (a, b) => Number(b.flow === "earliest") - Number(a.flow === "earliest"),
  );
  const rows: Row[] = [];
  for (const limit of limits) {
    const t0 = Date.now();
    const shares: string[][] = Array.from({ length: workers }, () => []);
    order.forEach((s, i) => shares[i % workers].push(s.id));
    const got = (await Promise.all(shares.map((ids) => runWorker(limit, ids)))).flat();
    rows.push(...got);
    const abs = got.reduce((n, r) => n + r.abs, 0);
    console.log(
      `limit ${limit}s: wall ${((Date.now() - t0) / 1000).toFixed(0)} s · total ABS ${abs} · total gilda ${got.reduce((n, r) => n + r.gilda, 0)}`,
    );
  }
  const out = arg("--out");
  if (out) writeFileSync(out, JSON.stringify(rows, null, 2));
  // Per plan: ABS at each limit, relative to the best found.
  console.log(`\n${"plan".padEnd(28)}${limits.map((l) => `${l}s`.padStart(9)).join("")}`);
  for (const s of specs) {
    const mine = rows.filter((r) => r.id === s.id);
    const best = Math.min(...mine.map((r) => r.abs));
    console.log(
      s.id.padEnd(28) +
        limits
          .map((l) => {
            const r = mine.find((x) => x.limit === l)!;
            return (r.abs === best ? `${r.abs}` : `${r.abs}*`).padStart(9);
          })
          .join(""),
    );
  }
}

const w = process.argv.indexOf("--worker");
if (w >= 0) await worker(Number(process.argv[w + 1]), process.argv[w + 2].split(","));
else await main();
