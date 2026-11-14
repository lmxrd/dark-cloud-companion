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
import { planResultToGuide } from "../../src/lib/guide/fromPlan.ts";
import { guide as guideSchema, type Guide } from "../../src/lib/guide/types.ts";
import { ancestorsOf } from "../../src/lib/planner/graph.ts";
import { planPath, type PlanResult } from "../../src/lib/planner/plan.ts";
import { placeStages, stageUnlockIndex, storyGilda } from "../../src/lib/planner/timeline.ts";
import { names } from "../../src/lib/gamedata/index.ts";
import { coinFor, getWeapon, weaponData } from "../../src/lib/planner/sources.ts";
import { freshState } from "../../src/lib/weapons/mechanics.ts";
import { PLANS_CACHE_DIR, PLANS_OUT, ROOT, plansHash } from "../../integrations/plans.ts";
import { plansConfig } from "./plans.config.ts";
import { expandPlans, parsePlansConfig, type PlanSpec } from "./plans-config.ts";

const specs = expandPlans(parsePlansConfig(plansConfig));
const codeHash = plansHash({ withConfig: false });
/** A plan's own hash: the game data and planning code plus its settings. */
const planHash = (spec: PlanSpec) =>
  createHash("sha256").update(codeHash).update(JSON.stringify(spec)).digest("hex");
const cacheFile = (spec: PlanSpec) => join(PLANS_CACHE_DIR, `plan-${planHash(spec)}.json`);

const killChapter = new Map(weaponData.killEnemies.map((e) => [e.name, e.chapter]));

/**
 * The earliest chapter a plan can possibly finish in: the target's own kill requirements, and the
 * coins for abilities that no weapon in its line carries. Searching below it would be wasted solves.
 */
function earliestPossibleChapter(spec: PlanSpec): number {
  const target = getWeapon(spec.targetId);
  const carried = new Set([...ancestorsOf(spec.targetId)].flatMap((id) => getWeapon(id).abilities));
  return Math.max(
    1,
    ...target.requiresKills.map((e) => killChapter.get(e) ?? 8),
    ...spec.abilities.filter((a) => !carried.has(a)).map((a) => coinFor(a)?.fromChapter ?? 8),
  );
}

async function planOne(spec: PlanSpec): Promise<{ guide: Guide; log: string }> {
  const target = getWeapon(spec.targetId);
  const solve = (maxChapter: number) =>
    planPath({
      // optimalStart picks the cheapest acquirable weapon in the line; the start field is unused.
      start: freshState(target),
      optimalStart: true,
      targetId: spec.targetId,
      objective: spec.objective,
      goal: spec.goal === "max" ? { kind: "max" } : { kind: "reach" },
      maxChapter,
      spBonus: spec.spBonus,
      // Never spend more than the story has paid out by the end of the chapter.
      maxGilda: Math.min(spec.maxGilda ?? Infinity, storyGilda(maxChapter)),
      abilities: spec.abilities,
      // Generation is one-off, so let the exact solves run longer than the interactive default.
      timeLimitSec: 10,
    });
  const complete = (r: PlanResult) => r.status === "ok" && !r.abilitiesMissing?.length;
  let result = await solve(spec.maxChapter);
  if (spec.flow === "earliest" && complete(result)) {
    // The earliest chapter whose content is enough to finish (more chapters never hurt).
    let lo = Math.min(earliestPossibleChapter(spec), spec.maxChapter);
    let hi = spec.maxChapter;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const r = await solve(mid);
      if (complete(r)) {
        hi = mid;
        result = r;
      } else lo = mid + 1;
    }
  }
  if (result.status !== "ok")
    throw new Error(
      `${spec.id}: planning failed (${result.status}${result.message ? `: ${result.message}` : ""})`,
    );
  if (result.abilitiesMissing?.length)
    throw new Error(`${spec.id}: missing abilities ${result.abilitiesMissing.join(", ")}`);
  const stages = result.plan!.stages;
  const acquireGilda =
    result.acquire?.kind === "shop"
      ? result.acquire.price
      : result.acquire?.kind === "invent"
        ? result.acquire.gilda
        : 0;
  const placement = placeStages(
    stages.map((_, j) => {
      const c = result.simulation!.stages?.[j]?.cost;
      return { abs: c?.abs ?? 0, gilda: (c?.gilda ?? 0) + (j === 0 ? acquireGilda : 0) };
    }),
    stages.map((st, j) => stageUnlockIndex(st, stages[j + 1], (w) => getWeapon(w).requiresKills)),
    result.acquire,
    spec.flow,
  );
  const done = placement.at(-1)!;
  const grind = placement.reduce((n, p) => n + p.grindAbs, 0);
  const farm = placement.reduce((n, p) => n + p.grindGilda, 0);
  const start = freshState(getWeapon(stages[0].weaponId));
  const cost = result.simulation!.cost;
  const startName = getWeapon(start.weaponId).name;
  const description = [
    spec.label,
    spec.goal === "max" ? "maxed stats" : "reach the weapon",
    ...(spec.abilities.length ? [`${spec.abilities.length} abilities`] : []),
    `optimal start (${startName})`,
    `done after ${names.sections[done.sectionId]} (chapter ${done.chapter})`,
    grind ? `${grind.toLocaleString("en")} ABS to grind` : "no ABS grinding",
    ...(farm ? [`${farm.toLocaleString("en")} gilda to farm`] : []),
  ].join(" · ");
  const guide = guideSchema.parse(
    planResultToGuide({
      id: spec.id,
      title: `${target.name} — ${spec.label}`,
      description,
      kind: "builtin",
      result,
      start,
      spBonus: spec.spBonus,
      acquire: result.acquire,
      createdAt: 0,
      placement,
    }),
  );
  const log = `${spec.id} — from ${startName} · ${cost.abs} ABS · ${cost.gilda} gilda · ${cost.steps} steps · done ch${done.chapter} ${done.sectionId} · grind ${grind} ABS / ${farm} gilda`;
  return { guide, log };
}

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
