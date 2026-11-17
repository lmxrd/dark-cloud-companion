/**
 * The app's entry point to the game data exported from `drizzle/game.db` (see
 * `scripts/db/export.ts`): names, chapters/sections and collectables, which nearly every page
 * needs. The other files have their own modules next to this one (`./weapons`, `./items`, …), so
 * Vite bundles each only into the islands that import it; floor detail and the bestiary load on
 * demand.
 */
import namesJson from "@/gamedata/names.json";
import coreJson from "@/gamedata/core.json";
import collectablesJson from "@/gamedata/collectables.json";
import type { ChapterDetail, Collectables, Core, Names } from "./types";

export type * from "./types";

/** Display names by id. */
export const names = namesJson as Names;
/** Chapters, sections, dungeons and towns. */
export const core = coreJson as unknown as Core;
/** Everything that can be ticked off. */
export const collectables = collectablesJson as unknown as Collectables;

const chapterFiles = import.meta.glob<{ default: unknown }>("@/gamedata/chapter/*.json");
const chapterCache = new Map<number, Promise<ChapterDetail>>();
/** Per-floor detail of one chapter (enemies, materials, prizes, exits, totals), loaded on demand. */
export function loadChapterDetail(chapter: number): Promise<ChapterDetail> {
  let p = chapterCache.get(chapter);
  if (!p) {
    const load = chapterFiles[`/src/gamedata/chapter/${chapter}.json`];
    p = load ? load().then((m) => m.default as ChapterDetail) : Promise.resolve({});
    chapterCache.set(chapter, p);
  }
  return p;
}
