import { defineConfig } from "drizzle-kit";

/** The game-data database: schema in src/db/schema.ts, migrations and game.db in drizzle/. */
export default defineConfig({
  dialect: "sqlite",
  casing: "snake_case",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: "file:./drizzle/game.db" },
});
