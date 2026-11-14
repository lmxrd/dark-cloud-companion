/** `pnpm db:check`: checks drizzle/game.db and exits non-zero on any problem. */
import { DatabaseSync } from "node:sqlite";
import { checkDatabase } from "./rules.ts";

const path = new URL("../../drizzle/game.db", import.meta.url).pathname;
const db = new DatabaseSync(path, { readOnly: true });
const problems = checkDatabase(db);
db.close();

if (problems.length) {
  console.error(`${problems.length} problem(s) in ${path}:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`${path}: no problems`);
