/** `pnpm db:check`: checks drizzle/game.db and exits non-zero on any problem. */
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { checkDatabase } from "./rules.ts";

const path = fileURLToPath(new URL("../../drizzle/game.db", import.meta.url));
const db = new DatabaseSync(path, { readOnly: true });
const problems = checkDatabase(db);
db.close();

if (problems.length) {
  console.error(`${problems.length} problem(s) in ${path}:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`${path}: no problems`);
