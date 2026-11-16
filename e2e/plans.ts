// The built-in plans as the tests see them, read from the committed plan files and the exported
// game data. Tests look a plan up by its config key (<target>/<variant>), which never changes, and
// take its id, title, weapons and enemies from here, so regenerating a plan can't break them.
// Call these inside a test: the game data is exported by the build the web server runs.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const PLANS_DIR = join(root, "data/generated/plans");

interface Step {
  id: string;
  title: string;
  build?: { weaponId: string };
  buildUp?: { weaponId: string };
}
interface PlanFile {
  name: string;
  spec?: string;
  guide: { id: string; title: string; steps: Step[] };
}

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

/** The committed built-in plan generated from the config key `spec`, e.g. "island-king/balanced". */
export function builtinPlan(spec: string) {
  const file = readdirSync(PLANS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(join(PLANS_DIR, f)) as PlanFile)
    .find((p) => p.spec === spec);
  if (!file) throw new Error(`no committed plan for ${spec}`);
  return file.guide;
}

let weapons: { id: string; name: string; killRequirements: string[] }[] | undefined;
let enemies: { id: string; name: string }[] | undefined;
const gamedata = () => {
  weapons ??= readJson(join(root, "src/gamedata/weapons.json")).weapons;
  enemies ??= readJson(join(root, "src/gamedata/enemies.json")).enemies;
  return { weapons: weapons!, enemies: enemies! };
};

export const weaponName = (id: string) => gamedata().weapons.find((w) => w.id === id)!.name;

/** The plan's first work step's weapon (the start of its map). */
export function startWeapon(spec: string) {
  return weaponName(builtinPlan(spec).steps.find((s) => s.build)!.build!.weaponId);
}

/** The plan's first build-up into a weapon that needs enemies defeated, with those enemies' names. */
export function firstKills(spec: string) {
  const { weapons, enemies } = gamedata();
  for (const s of builtinPlan(spec).steps) {
    const w = s.buildUp && weapons.find((x) => x.id === s.buildUp!.weaponId);
    if (w?.killRequirements.length)
      return {
        weapon: w.name,
        enemies: w.killRequirements.map((id) => enemies.find((e) => e.id === id)!.name),
      };
  }
  throw new Error(`${spec} has no build-up that needs enemies defeated`);
}
