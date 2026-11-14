import { collectables, names } from "@/lib/gamedata";
import { tick } from "@/lib/gamedata/ticks";
import { allMedals } from "@/lib/data";
import { itemAvailability, synthSources } from "@/lib/planner/sources";

/** Counts shown on the Reference hub: static totals plus the active profile's tracker progress. */

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

export const weaponCount = Object.keys(names.weapons).length;

export const itemCounts = (() => {
  const found = synthSources.filter((s) => itemAvailability(s.name).kind === "found").length;
  return { buyable: synthSources.length - found, found };
})();
