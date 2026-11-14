// Generates the predefined plans (built-in guides) into src/generated/plans.json (git-ignored).
// What gets generated is configured in scripts/planner/plans.config.ts.
// Flow (see integrations/plans.ts): when the game data or the planning code changed (content hash
// vs the one stored in the file), the planner runs here and logs each plan as it is made. Results
// are also cached by hash in node_modules/.cache/dcc-plans, so going back to earlier inputs is free.
// By hand:
//   pnpm plans          regenerate only when stale
//   pnpm plans:force    regenerate always
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { planResultToGuide } from "../../src/lib/guide/fromPlan.ts";
import { guide as guideSchema, type Guide } from "../../src/lib/guide/types.ts";
import { planPath, type PlanResult } from "../../src/lib/planner/plan.ts";
import { placeStages, stageUnlockIndex, storyGilda } from "../../src/lib/planner/timeline.ts";
import { names } from "../../src/lib/gamedata/index.ts";
import { getWeapon } from "../../src/lib/planner/sources.ts";
import { freshState } from "../../src/lib/weapons/mechanics.ts";
import { PLANS_CACHE_DIR, PLANS_OUT, plansHash } from "../../integrations/plans.ts";
import { plansConfig } from "./plans.config.ts";
import { expandPlans, parsePlansConfig } from "./plans-config.ts";

const outPath = PLANS_OUT;
const force = process.argv.includes("--force");
const hash = plansHash();
if (!force && existsSync(outPath)) {
  const stored = JSON.parse(readFileSync(outPath, "utf8")) as { hash?: string };
  if (stored.hash === hash) {
    console.log("predefined plans are up to date");
    process.exit(0);
  }
}

const specs = expandPlans(parsePlansConfig(plansConfig));
const began = Date.now();
console.log(`predefined plans: generating ${specs.length} plans (inputs changed)`);
const guides: Guide[] = [];
for (const [i, spec] of specs.entries()) {
  const target = getWeapon(spec.targetId);
  const t0 = Date.now();
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
    let lo = 1;
    let hi = spec.maxChapter;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const r = await solve(mid);
      if (complete(r)) {
        hi = mid;
        result = r;
      } else lo = mid + 1;
    }
    if (hi < spec.maxChapter && !complete(result)) result = await solve(hi);
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
  const start = freshState(getWeapon(result.plan!.stages[0].weaponId));
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
  guides.push(
    guideSchema.parse(
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
    ),
  );
  console.log(
    `  [${i + 1}/${specs.length}] ${spec.id} — from ${startName} · ${cost.abs} ABS · ${cost.gilda} gilda · ${cost.steps} steps · done ch${done.chapter} ${done.sectionId} · grind ${grind} ABS / ${farm} gilda (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
  );
}

const json = JSON.stringify({ hash, guides }, null, 2) + "\n";
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json);
mkdirSync(PLANS_CACHE_DIR, { recursive: true });
writeFileSync(join(PLANS_CACHE_DIR, `${hash}.json`), json);
console.log(
  `predefined plans: ${guides.length} guides written to src/generated/plans.json in ${((Date.now() - began) / 1000).toFixed(1)}s`,
);
