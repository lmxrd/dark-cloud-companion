import { collectables, names } from "@/lib/gamedata";
import { weaponData, weaponById, weaponSources } from "@/lib/planner/sources";
import type { Weapon } from "@/lib/schemas";
import { absToReach } from "./mechanics";

export const buildsFrom = (id: string): Weapon[] =>
  weaponData.weapons.filter((w) => w.buildsUpTo.includes(id));

export const buildsInto = (id: string): Weapon[] =>
  (weaponById.get(id)?.buildsUpTo ?? []).map((t) => weaponById.get(t)!).filter(Boolean);

const recruitChapter = new Map(collectables.recruits.map((r) => [r.npcId, r.chapterNumber]));

/** Shops that sell it: name, first chapter and price. */
export const shopsFor = (id: string) =>
  (weaponSources(id).shops ?? [])
    .filter((l) => l.price !== undefined)
    .map((l) => ({
      shop: names.shops[l.shopId],
      chapter:
        l.fromChapterNumber ??
        (l.afterRecruitNpcId ? recruitChapter.get(l.afterRecruitNpcId) : undefined) ??
        1,
      price: l.price!,
    }));

/** How to invent it: each recipe's photo names, and the materials. */
export const inventionFor = (id: string) => {
  const inv = collectables.inventions.find((i) => i.weaponId === id);
  return (
    inv && {
      recipes: inv.recipes.map((r) => r.map((p) => names.photos[p] ?? p)),
      materials: inv.items.map((m) => ({ name: names.items[m.itemId], quantity: m.quantity })),
    }
  );
};

/** One-off ways to get it: prizes and rewards, as `{ kind, … }` for the page to word. */
export const eventsFor = (id: string) => {
  const s = weaponSources(id);
  return [
    ...(s.sphedaPrizes ?? []).map((p) => ({
      kind: "spheda" as const,
      section: names.sections[p.sectionId],
    })),
    ...(s.sectionRewards ?? []).map((r) => ({
      kind: "sectionReward" as const,
      section: names.sections[r.sectionId],
      who: r.character,
    })),
    ...(s.georamaRewards ?? []).map((r) => ({
      kind: "georama" as const,
      town: names.towns[r.townId],
    })),
    ...(s.contestPrizes ?? []).map((p) => ({
      kind: "contest" as const,
      contest: p.contestId === "finny-frenzy" ? "Finny Frenzy" : "Fishing Contest",
    })),
    ...((s.startingEquipment ?? []).length ? [{ kind: "starting" as const }] : []),
  ];
};

export const dungeonsFor = (id: string) =>
  (weaponSources(id).dungeons ?? []).map((d) => names.dungeons[d]);

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

/**
 * Build-up order: each weapon line from its root weapon onwards, depth first, so a weapon comes
 * right after the one it is built from (the order the weapon list sorts by default).
 */
export const buildOrder: Map<string, number> = (() => {
  const order = new Map<string, number>();
  const visit = (w: Weapon) => {
    if (order.has(w.id)) return;
    order.set(w.id, order.size);
    for (const next of buildsInto(w.id)) visit(next);
  };
  const roots = weaponData.weapons.filter((w) => buildsFrom(w.id).length === 0);
  roots.forEach(visit);
  weaponData.weapons.forEach(visit);
  return order;
})();
