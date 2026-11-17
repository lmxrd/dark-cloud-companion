import { weaponData, weaponById } from "@/lib/planner/sources";
import type { Weapon } from "@/lib/schemas";
import { absToReach } from "./mechanics";

export const buildsFrom = (id: string): Weapon[] =>
  weaponData.weapons.filter((w) => w.buildsUpTo.includes(id));

export const buildsInto = (id: string): Weapon[] =>
  (weaponById.get(id)?.buildsUpTo ?? []).map((t) => weaponById.get(t)!).filter(Boolean);

/** Total ABS to reach each of the given levels. */
export const absTable = (w: Weapon, levels = [1, 5, 10, 20, 30, 50, 99]) =>
  levels.map((l) => ({ level: l, abs: absToReach(w.baseAbs, l) }));

/**
 * Line order: each weapon line from its first weapon onwards, depth first, so a weapon comes right
 * after the one it is built from. Used to keep a line together within a tier.
 */
const lineOrder: Map<string, number> = (() => {
  const order = new Map<string, number>();
  const visit = (w: Weapon) => {
    if (order.has(w.id)) return;
    order.set(w.id, order.size);
    for (const next of buildsInto(w.id)) visit(next);
  };
  weaponData.weapons.filter((w) => buildsFrom(w.id).length === 0).forEach(visit);
  weaponData.weapons.forEach(visit);
  return order;
})();

/**
 * Tier order, the weapon list's default: lowest tier first (the build-up charts' columns), a line's
 * weapons together within a tier, then by name.
 */
export const byTier = (a: Weapon, b: Weapon) =>
  (a.tier ?? 0) - (b.tier ?? 0) ||
  (lineOrder.get(a.id) ?? 0) - (lineOrder.get(b.id) ?? 0) ||
  a.name.localeCompare(b.name);
