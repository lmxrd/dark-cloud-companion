/**
 * Ids from before game data came from `drizzle/game.db` (state version 2 and content files of
 * version 2), mapped to today's ids. `legacy-ids.json` was built once from the old `src/data` files
 * and is kept so that old saves and shared files keep working. Ids it doesn't know are left as they
 * are, so nothing stored is ever dropped.
 */
import legacyIds from "./legacy-ids.json";
import type { Guide, Step, Entry } from "@/lib/guide/types";

const MAP = legacyIds as Record<string, string | string[]>;

/** Today's ids for an old tick, section or checklist id (several when one old line covered several). */
export function migrateId(id: string): string[] {
  const to = MAP[id];
  return to === undefined ? [id] : Array.isArray(to) ? to : [to];
}

/** Old chapter keys were "c1"…"c8" and "postgame" (now chapter 8); today's are "1"…"8". */
export function migrateChapterKey(key: string): string {
  if (key === "postgame") return "8";
  const m = /^c(\d)$/.exec(key);
  return m ? m[1] : key;
}

/** A tick of a built-in guide step: the main walkthrough's step ids contain chapter and section ids. */
function migrateStepTick(id: string): string {
  const m = /^(g:main:)(ch|sec)-(.+)$/.exec(id);
  if (!m) return id;
  const [, prefix, kind, rest] = m;
  return kind === "ch"
    ? `${prefix}ch-${migrateChapterKey(rest)}`
    : `${prefix}sec-${migrateId(rest)[0]}`;
}

export function migrateChecks(checks: Record<string, true>): Record<string, true> {
  return Object.fromEntries(
    Object.keys(checks).flatMap((k) =>
      k.startsWith("g:")
        ? [[migrateStepTick(k), true as const]]
        : migrateId(k).map((n) => [n, true as const]),
    ),
  );
}

function migrateEntries(entries: Entry[]): Entry[] {
  return entries.flatMap((e): Entry[] => {
    if (e.kind === "text") return [e];
    if (e.kind === "section") return [{ ...e, ref: migrateId(e.ref)[0] }];
    return migrateId(e.ref).map((ref) => ({ ...e, ref }));
  });
}

function migrateStep(s: Step): Step {
  return {
    ...s,
    ...(s.chapterId ? { chapterId: migrateChapterKey(s.chapterId) } : {}),
    ...(s.sectionId ? { sectionId: migrateId(s.sectionId)[0] } : {}),
    entries: migrateEntries(s.entries),
  };
}

export const migrateGuide = (g: Guide): Guide => ({ ...g, steps: g.steps.map(migrateStep) });
