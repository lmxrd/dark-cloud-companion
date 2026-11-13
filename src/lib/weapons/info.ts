import { weaponData, weaponById } from "@/lib/planner/sources";
import type { Weapon } from "@/lib/schemas";
import { absToReach } from "./mechanics";

export const buildsFrom = (id: string): Weapon[] =>
  weaponData.weapons.filter((w) => w.buildsUpTo.includes(id));

export const buildsInto = (id: string): Weapon[] =>
  (weaponById.get(id)?.buildsUpTo ?? []).map((t) => weaponById.get(t)!).filter(Boolean);

export const shopsFor = (id: string) => weaponData.shops.filter((s) => s.weaponId === id);
export const inventionFor = (id: string) => weaponData.invented.find((i) => i.weaponId === id);
export const eventFor = (id: string) => weaponData.events.find((e) => e.weaponId === id);
export const dungeonsFor = (id: string) =>
  weaponData.dungeonWeapons.filter((d) => d.weaponIds.includes(id)).map((d) => d.dungeon);

/** Total ABS to reach each of the given levels. */
export const absTable = (w: Weapon, levels = [1, 5, 10, 20, 30, 50, 99]) =>
  levels.map((l) => ({ level: l, abs: absToReach(w.baseAbs, l) }));

/**
 * The build-up line leading to a weapon, from the root of its line: each step follows the first weapon
 * that builds into the previous one (lines rarely merge; the first parent is the usual route).
 */
export function lineTo(id: string): Weapon[] {
  const line: Weapon[] = [];
  const seen = new Set<string>();
  let current = weaponById.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    line.unshift(current);
    current = buildsFrom(current.id)[0];
  }
  return line;
}
