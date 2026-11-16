// Predefined plans (built-in guides) are committed, one file per plan, in data/generated/plans/.
// They are generated on purpose (`pnpm plans`, see scripts/planner/predefined.ts), reviewed and
// committed, and are independent of the code from then on: builds and tests never re-solve them.
// Whenever Astro starts (dev, build, `astro sync`) and before the tests, the files are only
// assembled into src/data/plans.json (git-ignored), which the app reads.
import type { AstroIntegration } from "astro";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const PLANS_OUT = join(ROOT, "src/data/plans.json");
/** The committed plans, one JSON file per plan. */
export const PLANS_DIR = join(ROOT, "data/generated/plans");

/** Writes src/data/plans.json from the committed plan files (in file-name order). */
export function assemblePlans(log: (m: string) => void = console.log): void {
  const files = existsSync(PLANS_DIR)
    ? readdirSync(PLANS_DIR)
        .filter((f) => f.endsWith(".json"))
        .sort()
    : [];
  const plans = files.map((f) => JSON.parse(readFileSync(join(PLANS_DIR, f), "utf8")));
  const guides = plans.map((p) => p.guide);
  // Each configured plan's variant ("balanced", "earliest", "gilda-max", from its <target>/<variant>
  // config key), by guide id: the guides table groups by it rather than by the title's wording.
  const variants = Object.fromEntries(
    plans.filter((p) => p.spec).map((p) => [p.guide.id, p.spec.split("/")[1]]),
  );
  const json = JSON.stringify({ guides, variants }, null, 2) + "\n";
  if (existsSync(PLANS_OUT) && readFileSync(PLANS_OUT, "utf8") === json) return;
  mkdirSync(dirname(PLANS_OUT), { recursive: true });
  writeFileSync(PLANS_OUT, json);
  log(`predefined plans: ${guides.length} assembled into src/data/plans.json`);
}

export default function plans(): AstroIntegration {
  return {
    name: "dcc-predefined-plans",
    hooks: {
      "astro:config:setup": ({ logger }) => assemblePlans((m) => logger.info(m)),
    },
  };
}
