// Game data is exported from drizzle/game.db into src/gamedata/ (git-ignored) whenever Astro starts:
// `astro dev`, `astro build` and `astro sync` (which `pnpm typecheck` runs). In dev, saving the
// database (e.g. from `pnpm db:studio`) exports again and reloads the page.
import type { AstroIntegration } from "astro";
import { DB_PATH, exportGameData } from "../scripts/db/export.ts";

function runExport(logger: { info: (m: string) => void }) {
  const started = performance.now();
  const files = exportGameData();
  logger.info(`exported ${files.length} files in ${Math.round(performance.now() - started)} ms`);
}

export default function gamedata(): AstroIntegration {
  return {
    name: "dcc-gamedata",
    hooks: {
      "astro:config:setup": ({ logger }) => runExport(logger),
      "astro:server:setup": ({ server, logger }) => {
        server.watcher.add(DB_PATH);
        server.watcher.on("change", (path) => {
          if (path !== DB_PATH) return;
          runExport(logger);
          server.ws.send({ type: "full-reload" });
        });
      },
    },
  };
}
