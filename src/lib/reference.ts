import monstersRaw from "@/data/monsters.json";
import ridepodRaw from "@/data/ridepod.json";
import { chapters, medalItems, sectionsOf } from "@/lib/data";
import { itemAvailability, synthSources, weaponData } from "@/lib/planner/sources";
import { monstersData, ridepodData, type RidepodPart } from "@/lib/schemas";

/** Counts shown on the Reference hub: static totals plus the active profile's tracker progress. */

export type Progress = { done: number; total: number };

export const ridepod = ridepodData.parse(ridepodRaw);
export const monsterClasses = monstersData.parse(monstersRaw);

export const ridepodPartCheckId = (p: RidepodPart) => `ridepod:${p.id}`;
export const ridepodCoreCheckId = (name: string) => `ridepod-core:${name}`;
export const monsterCheckIds = (classId: string) =>
  [`monster:${classId}:badge`, `monster:${classId}:mastered`] as const;

/** Spheda medals: the "spheda" prizes of the main-story chapters, as the Spheda tracker lists them. */
export const sphedaMedals = chapters
  .filter((c) => c.phase === "main")
  .flatMap((c) => sectionsOf(c.id).flatMap(medalItems))
  .filter((m) => m.kind === "prize" && m.prizeType === "spheda");

const count = (ids: string[], checks: Record<string, true>): Progress => ({
  done: ids.filter((id) => checks[id]).length,
  total: ids.length,
});

export const ridepodProgress = (checks: Record<string, true>) =>
  count(
    [
      ...ridepod.parts.map(ridepodPartCheckId),
      ...ridepod.cores.map((c) => ridepodCoreCheckId(c.name)),
    ],
    checks,
  );

export const monsterProgress = (checks: Record<string, true>) =>
  count(
    monsterClasses.flatMap((c) => monsterCheckIds(c.id)),
    checks,
  );

export const sphedaProgress = (checks: Record<string, true>) =>
  count(
    sphedaMedals.map((m) => m.id),
    checks,
  );

export const weaponCount = weaponData.weapons.length;

export const itemCounts = (() => {
  const found = synthSources.filter((s) => itemAvailability(s.name).kind === "found").length;
  return { buyable: synthSources.length - found, found };
})();
