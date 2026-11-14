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
import { planPath } from "../../src/lib/planner/plan.ts";
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
  const result = await planPath({
    // optimalStart picks the cheapest acquirable weapon in the line; the start field is unused.
    start: freshState(target),
    optimalStart: true,
    targetId: spec.targetId,
    objective: spec.objective,
    goal: spec.goal === "max" ? { kind: "max" } : { kind: "reach" },
    maxChapter: spec.maxChapter,
    spBonus: spec.spBonus,
    ...(spec.maxGilda !== undefined ? { maxGilda: spec.maxGilda } : {}),
    abilities: spec.abilities,
    // Generation is one-off, so let the exact solves run longer than the interactive default.
    timeLimitSec: 10,
  });
  if (result.status !== "ok")
    throw new Error(
      `${spec.id}: planning failed (${result.status}${result.message ? `: ${result.message}` : ""})`,
    );
  if (result.abilitiesMissing?.length)
    throw new Error(`${spec.id}: missing abilities ${result.abilitiesMissing.join(", ")}`);
  const start = freshState(getWeapon(result.plan!.stages[0].weaponId));
  const cost = result.simulation!.cost;
  const startName = getWeapon(start.weaponId).name;
  const description = [
    spec.label,
    spec.goal === "max" ? "maxed stats" : "reach the weapon",
    ...(spec.abilities.length ? [`${spec.abilities.length} abilities`] : []),
    `optimal start (${startName})`,
    `up to chapter ${spec.maxChapter}`,
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
      }),
    ),
  );
  console.log(
    `  [${i + 1}/${specs.length}] ${spec.id} — from ${startName} · ${cost.abs} ABS · ${cost.gilda} gilda · ${cost.steps} steps (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
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
