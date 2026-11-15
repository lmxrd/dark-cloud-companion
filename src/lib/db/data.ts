/**
 * The whole game database with lookups both ways, for the pages of single things (`/db/<kind>/<id>`).
 * Those pages render at build time only, so this module may load every data file, the bestiary and
 * all floor detail included; islands must not import it.
 */
import { collectables, core, names } from "@/lib/gamedata";
import { weapons } from "@/lib/gamedata/weapons";
import { items } from "@/lib/gamedata/items";
import { shops } from "@/lib/gamedata/shops";
import { ridepod } from "@/lib/gamedata/ridepod";
import { georama } from "@/lib/gamedata/georama";
import { monsters } from "@/lib/gamedata/monsters";
import { fishing } from "@/lib/gamedata/fishing";
import { misc } from "@/lib/gamedata/misc";
import enemiesJson from "@/gamedata/enemies.json";
import type { ChapterDetail, Enemies, FloorDetail, Section } from "@/lib/gamedata/types";
import { FLOOR_TYPES } from "./routes";

export {
  collectables,
  core,
  names,
  weapons,
  items,
  shops,
  ridepod,
  georama,
  monsters,
  fishing,
  misc,
};
export const enemies = (enemiesJson as unknown as Enemies).enemies;

const index = <T, K>(list: T[], key: (x: T) => K) => new Map(list.map((x) => [key(x), x]));
/** Groups a list by a key (a value may belong to several keys). */
function group<T, K>(list: T[], keys: (x: T) => (K | null | undefined)[]): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of list) for (const k of keys(x)) if (k != null) m.set(k, [...(m.get(k) ?? []), x]);
  return m;
}

export const byId = {
  weapon: index(weapons.weapons, (x) => x.id),
  item: index(items.items, (x) => x.id),
  enemy: index(enemies, (x) => x.id),
  shop: index(shops.shops, (x) => x.id),
  npc: index(misc.npcs, (x) => x.id),
  fish: index(fishing.fish, (x) => x.id),
  photo: index(collectables.photos, (x) => x.id),
  invention: index(collectables.inventions, (x) => x.id),
  georamaPart: index(georama.parts, (x) => x.id),
  ridepodPart: index(ridepod.parts, (x) => x.id),
  ridepodCore: index(ridepod.cores, (x) => x.id),
  monsterForm: index(monsters.forms, (x) => x.id),
  monsterClass: index(collectables.monsterClasses, (x) => x.id),
  town: index(core.towns, (x) => x.id),
  dungeon: index(core.dungeons, (x) => x.id),
  section: index(core.sections, (x) => x.id),
  ability: index(weapons.abilities, (x) => x.id),
  pickup: index(collectables.pickups, (x) => x.id),
  recruit: index(collectables.recruits, (x) => x.npcId),
  contest: index(fishing.contests, (x) => x.id),
};

const chapterFiles = import.meta.glob<{ default: ChapterDetail }>("@/gamedata/chapter/*.json", {
  eager: true,
});
/** Per-floor detail of every chapter, by section id. */
export const floorDetail: Record<string, FloorDetail> = Object.assign(
  {},
  ...Object.values(chapterFiles).map((m) => m.default),
);

/** Floors and boss fights: the sections that get a page of their own. */
export const floors: Section[] = core.sections.filter((s) =>
  (FLOOR_TYPES as readonly string[]).includes(s.type),
);

// ─── reverse lookups ──────────────────────────────────────────────────────────────────────────────

/** Weapons that need an enemy killed before they can be built up. */
export const killRequiredBy = group(weapons.weapons, (w) => w.killRequirements);
/** Weapons that build into a weapon. */
export const builtFrom = group(weapons.weapons, (w) => w.buildsInto);
/** Weapons and items (coins) that carry an ability. */
export const weaponsWithAbility = group(weapons.weapons, (w) => w.abilities);
export const itemsWithAbility = group(items.items, (i) => [i.abilityId]);
/** Inventions that use a photo in any recipe, an item as material, or make a thing. */
export const inventionsUsingPhoto = group(collectables.inventions, (i) => i.recipes.flat());
export const inventionsUsingItem = group(collectables.inventions, (i) =>
  i.items.map((m) => m.itemId),
);
export const inventionMaking = (p: {
  itemId?: string;
  weaponId?: string;
  ridepodPartId?: string;
}) =>
  collectables.inventions.find(
    (i) =>
      (p.itemId && i.itemId === p.itemId) ||
      (p.weaponId && i.weaponId === p.weaponId) ||
      (p.ridepodPartId && i.ridepodPartId === p.ridepodPartId),
  );
export const georamaPartsUsingItem = group(georama.parts, (p) => p.items.map((m) => m.itemId));
export const recruitsNeeding = {
  item: group(collectables.recruits, (r) => r.requirements.map((q) => q.itemId)),
  weapon: group(collectables.recruits, (r) => r.requirements.map((q) => q.weaponId)),
  photo: group(collectables.recruits, (r) => r.requirements.map((q) => q.photoId)),
  fish: group(collectables.recruits, (r) => r.requirements.map((q) => q.fishId)),
};
export const monsterUnlocksWithItem = group(monsters.unlocks, (u) => [u.itemId]);
export const monsterUnlocksWithEnemy = group(monsters.unlocks, (u) => [u.enemyId]);
/** Forms that evolve into a form. */
export const evolvesFrom = group(monsters.forms, (f) => f.evolvesInto.map((e) => e.toId));
export const evolutionsNeedingItem = group(monsters.forms, (f) =>
  f.evolvesInto.map((e) => e.requiredItemId),
);
export const fishWithTackle = group(fishing.fish, (f) => f.tackle);
export const fishAsItem = index(
  fishing.fish.filter((f) => f.itemId),
  (f) => f.itemId!,
);
export const ridepodPartAsItem = index(
  ridepod.parts.filter((p) => p.itemId),
  (p) => p.itemId!,
);
export const enemiesOfClass = group(enemies, (e) => [e.classId]);
export const enemiesOnFloor = group(enemies, (e) => e.sections.map((s) => s.sectionId));
export const shopsInTown = group(shops.shops, (s) => [s.townId]);
export const shopsKeptBy = group(shops.shops, (s) => [s.npcId]);
export const shopsAfterRecruiting = group(shops.shops, (s) => [s.afterRecruitNpcId]);
export const peopleOfTown = group(misc.npcs, (n) => [n.homeTownId]);
export const dungeonsOfTown = group(core.dungeons, (d) => [d.townId]);
export const sectionsOfDungeon = group(core.sections, (s) => [s.dungeonId]);
export const pickupsInTown = group(collectables.pickups, (p) => [p.townId]);
export const pickupsOnFloor = group(collectables.pickups, (p) => [p.sectionId]);
export const photosOnFloor = group(collectables.photos, (p) => [p.sectionId]);
export const photosInTown = group(collectables.photos, (p) => [p.townId]);
export const fishInTown = group(fishing.fish, (f) => f.habitats.map((h) => h.townId));
export const fishOnFloor = group(fishing.fish, (f) => f.habitats.map((h) => h.sectionId));
export const fishInDungeon = group(fishing.fish, (f) => f.habitats.map((h) => h.dungeonId));
export const weaponsInDungeon = group(weapons.weapons, (w) => w.sources.dungeons ?? []);
export const trophiesFor = {
  enemy: group(misc.trophies, (t) => [t.enemyId]),
  fish: group(misc.trophies, (t) => [t.fishId]),
  ridepodCore: group(misc.trophies, (t) => [t.ridepodCoreId]),
  weapon: group(misc.trophies, (t) => t.weapons ?? []),
};
/** Floors whose geostone unlocks a Georama part, and floors where a material is found. */
export const geostoneFloorsOf = new Map<string, string[]>();
export const materialFloorsOf = new Map<string, string[]>();
for (const [sectionId, d] of Object.entries(floorDetail)) {
  for (const p of d.geostoneParts)
    geostoneFloorsOf.set(p, [...(geostoneFloorsOf.get(p) ?? []), sectionId]);
  for (const i of d.georamaItems)
    materialFloorsOf.set(i, [...(materialFloorsOf.get(i) ?? []), sectionId]);
}
export const townsBuilding = group(georama.townParts, (t) => [t.georamaPartId]);
export const housingNeeds = group(georama.housingRequirements, (h) => [h.npcId]);
export const housingNear = group(georama.housingRequirements, (h) => [h.georamaPartId]);
/** Spheda prizes (by floor and win) that give a thing, from the floor detail. */
export const sphedaPrizesOf = new Map<
  string,
  { sectionId: string; tier: string; quantity: number }[]
>();
for (const [sectionId, d] of Object.entries(floorDetail))
  for (const [tier, p] of Object.entries(d.sphedaPrizes)) {
    const id = p.itemId ?? p.weaponId ?? p.ridepodPartId ?? p.ridepodCoreId;
    if (id)
      sphedaPrizesOf.set(id, [
        ...(sphedaPrizesOf.get(id) ?? []),
        { sectionId, tier, quantity: p.quantity },
      ]);
  }

/** The chapter of a section. */
export const chapterOf = (sectionId: string | undefined) =>
  sectionId ? byId.section.get(sectionId)?.chapterNumber : undefined;

/** Where a town's or floor's dungeon is: the section's dungeon name, or its chapter title. */
export const isFloor = (sectionId: string) =>
  (FLOOR_TYPES as readonly string[]).includes(byId.section.get(sectionId)?.type ?? "");

/** Names of everything, for the database home's search. */
export const allNames = names;
