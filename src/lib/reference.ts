import { collectables, names } from "@/lib/gamedata";
import { tick } from "@/lib/gamedata/ticks";
import { allMedals } from "@/lib/data";

/** Tracker progress shown on the database home: the active profile's ticks. */

export type Progress = { done: number; total: number };

/** Spheda medals: every section's first-win prize, as the Spheda tracker lists them. */
export const sphedaMedals = allMedals.filter((m) => m.kind === "spheda");

const count = (ids: string[], checks: Record<string, true>): Progress => ({
  done: ids.filter((id) => checks[id]).length,
  total: ids.length,
});

const ridepodIds = [
  ...Object.keys(names.ridepodParts).map(tick.ridepodPart),
  ...Object.keys(names.ridepodCores).map(tick.ridepodCore),
];
export const ridepodProgress = (checks: Record<string, true>) => count(ridepodIds, checks);

const monsterIds = collectables.monsterClasses.flatMap((c) => [
  tick.badge(c.id),
  tick.mastered(c.id),
]);
export const monsterProgress = (checks: Record<string, true>) => count(monsterIds, checks);

export const sphedaProgress = (checks: Record<string, true>) =>
  count(
    sphedaMedals.map((m) => m.id),
    checks,
  );
