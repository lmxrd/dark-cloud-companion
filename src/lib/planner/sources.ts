// The planner's inputs (weapons, synth items, prices), built from the game data exported from
// drizzle/game.db. The shapes are the planner's own (`Weapon`, `SynthItem` in lib/schemas), so the
// verified mechanics and solver stay as they are.
import { collectables, core, names, type Sources } from "@/lib/gamedata";
import { weapons as weaponsFile } from "@/lib/gamedata/weapons";
import { items as itemsFile } from "@/lib/gamedata/items";
import { shops as shopsFile } from "@/lib/gamedata/shops";
import {
  STAT_KEYS,
  type AbilityId,
  type StatKey,
  type Stats,
  type SynthItem,
  type Weapon,
} from "@/lib/schemas";
import type { Acquire } from "./types";

const STAT_COLUMNS: Record<StatKey, string> = {
  at: "Attack",
  fl: "Flame",
  ch: "Chill",
  li: "Lightning",
  cy: "Cyclone",
  sm: "Smash",
  ex: "Exorcism",
  be: "Beast",
  sc: "Scale",
};
const statsOf = (row: object, prefix: string): Stats =>
  Object.fromEntries(
    STAT_KEYS.map((k) => [k, (row as Record<string, number>)[`${prefix}${STAT_COLUMNS[k]}`] ?? 0]),
  ) as Stats;
const GUN_TYPES = { normal: "N", "machine-gun": "M", grenade: "G", beam: "B" } as const;

const weaponList: Weapon[] = weaponsFile.weapons.map((w) => ({
  id: w.id,
  name: w.name,
  character: w.character,
  type: w.type,
  ...(w.type === "gun" && w.subType && w.subType in GUN_TYPES
    ? { gunType: GUN_TYPES[w.subType as keyof typeof GUN_TYPES] }
    : {}),
  ...(w.combo ? { combo: w.combo } : {}),
  ...(w.description ? { description: w.description } : {}),
  ...(w.attackVariesByTime ? { attackVariesByTime: true } : {}),
  baseAbs: w.baseAbs,
  spPerLevel: w.synthPointsPerLevel,
  abilities: w.abilities as AbilityId[],
  buildsUpTo: w.buildsInto,
  // The simulator matches kills by enemy name.
  requiresKills: w.killRequirements.map((e) => names.enemies[e] ?? e),
  baseStats: statsOf(w, "base"),
  baseSp: w.baseSynthPoints,
  maxStats: statsOf(w, "max"),
  maxDu: w.maxDurability,
}));

/** Every weapon, in the planner's shape, plus where kill-requirement enemies first appear. */
export const weaponData = {
  weapons: weaponList,
  /** Enemy name → first chapter it appears in. */
  killEnemies: Object.entries(weaponsFile.killEnemyChapters).map(([id, chapter]) => ({
    name: names.enemies[id] ?? id,
    chapter,
  })),
};
export const weaponById = new Map<string, Weapon>(weaponList.map((w) => [w.id, w]));
export const getWeapon = (id: string): Weapon => {
  const w = weaponById.get(id);
  if (!w) throw new Error(`unknown weapon: ${id}`);
  return w;
};
/** Where a weapon can be had (shops, inventions, dungeons, rewards…), from the game data. */
export const weaponSources = (id: string): Sources =>
  weaponsFile.weapons.find((w) => w.id === id)?.sources ?? {};

// ---------- prices ----------

const recruitChapter = new Map(collectables.recruits.map((r) => [r.npcId, r.chapterNumber]));
const shopById = new Map(shopsFile.shops.map((s) => [s.id, s]));
/** The chapter a shop listing can first be bought in: its own, else the shop's, else 1. */
function listingChapter(l: NonNullable<Sources["shops"]>[number]): number {
  const shop = shopById.get(l.shopId);
  return (
    l.fromChapterNumber ??
    shop?.fromChapterNumber ??
    (shop?.afterRecruitNpcId ? recruitChapter.get(shop.afterRecruitNpcId) : undefined) ??
    1
  );
}
const gildaShop = (shopId: string) => (shopById.get(shopId)?.currency ?? "gilda") === "gilda";

interface ShopItem {
  price: number;
  fromChapter: number;
  shops: string[];
}
/** Cheapest gilda price per item name, the earliest chapter it is sold and where. */
const shopItems = new Map<string, ShopItem>();
for (const item of itemsFile.items) {
  const listings = (item.sources.shops ?? []).filter(
    (l) => l.price !== undefined && gildaShop(l.shopId),
  );
  if (!listings.length) continue;
  shopItems.set(item.name, {
    price: Math.min(...listings.map((l) => l.price!)),
    fromChapter: Math.min(...listings.map(listingChapter)),
    shops: [...new Set(listings.map((l) => names.shops[l.shopId]))],
  });
}

export interface SynthSource extends SynthItem {
  /** Gilda per item when sold in a shop; undefined when only found/dropped/invented. */
  price?: number;
  /** Earliest chapter it is sold; undefined when not sold. */
  fromChapter?: number;
  /** Coins add this ability instead of stats (opposites cancel). */
  ability?: AbilityId;
}

const CATEGORY_LABELS: Record<string, string> = { gems: "Gems", durable: "Durable" };
const label = (c: string) => CATEGORY_LABELS[c] ?? c[0].toUpperCase() + c.slice(1);

/** Items that add stats when spectrumized and synthesized. */
const statSources: SynthSource[] = itemsFile.items
  .filter((i) => i.synthCategory)
  .map((i) => {
    const gains: SynthItem["gains"] = {};
    for (const k of STAT_KEYS) {
      const v = (i as Record<string, unknown>)[`synth${STAT_COLUMNS[k]}`];
      if (typeof v === "number" && v) gains[k] = v;
    }
    if (i.synthDurability) gains.du = i.synthDurability;
    const shop = shopItems.get(i.name);
    return {
      name: i.name,
      category: label(i.synthCategory!),
      gains,
      ...(shop ? { price: shop.price, fromChapter: shop.fromChapter } : {}),
    };
  });

/** Coins and the ability each one carries. */
const coinSources: SynthSource[] = itemsFile.items
  .filter((i) => i.type === "coin" && i.abilityId)
  .map((i) => {
    const shop = shopItems.get(i.name);
    return {
      name: i.name,
      category: "Coins",
      gains: {},
      ability: i.abilityId as AbilityId,
      ...(shop ? { price: shop.price, fromChapter: shop.fromChapter } : {}),
    };
  });

export const synthSources: SynthSource[] = [...statSources, ...coinSources];

export type ItemAvailability =
  | { kind: "buyable"; price: number; fromChapter: number; shops: string[] }
  | { kind: "found" };

/**
 * Whether a synth item can be bought. Items without a price are found-only (dungeon chests, drops, fishing,
 * inventions). The chapter is the first chapter it can be bought in (the listing's own chapter, else
 * when the shop opens).
 */
export function itemAvailability(name: string): ItemAvailability {
  const shop = shopItems.get(name);
  return shop
    ? { kind: "buyable", price: shop.price, fromChapter: shop.fromChapter, shops: shop.shops }
    : { kind: "found" };
}
export const coinFor = (ability: AbilityId) => coinSources.find((c) => c.ability === ability);

const sectionChapter = new Map(core.sections.map((s) => [s.id, s.chapterNumber]));
/**
 * The earliest chapter an ability's coin can be had: bought, or won as a Spheda prize. Spheda is a
 * slow and unreliable source (a floor to clear, a course that may not be winnable), so the planner
 * only falls back on it when nothing else provides the ability; `viaSpheda` says when it does.
 */
export function coinChapter(
  ability: AbilityId,
): { chapter: number; viaSpheda: boolean } | undefined {
  const coin = coinFor(ability);
  if (!coin) return undefined;
  const item = itemsFile.items.find((i) => i.name === coin.name);
  const prizes = (item?.sources.sphedaPrizes ?? [])
    .map((p) => sectionChapter.get(p.sectionId))
    .filter((c): c is number => c !== undefined);
  const shop = coin.fromChapter;
  const spheda = prizes.length ? Math.min(...prizes) : undefined;
  if (shop !== undefined && (spheda === undefined || shop <= spheda))
    return { chapter: shop, viaSpheda: false };
  return spheda !== undefined ? { chapter: spheda, viaSpheda: true } : undefined;
}
export const synthSourceByName = new Map(synthSources.map((s) => [s.name, s]));

/** Chapter in which a photo (invention ingredient) first becomes available. */
const photoChapter = new Map(collectables.photos.map((p) => [p.id, p.chapterNumber]));

/** Cheapest reliable ways to obtain a weapon at +0 (shop or invention). Dungeon/event drops are excluded. */
export function acquisitionOptions(weaponId: string): Acquire[] {
  const out: Acquire[] = [];
  const cheapest = new Map<string, { shop: string; price: number; chapter: number }>();
  for (const l of weaponSources(weaponId).shops ?? []) {
    if (l.price === undefined) continue;
    const shop = names.shops[l.shopId];
    const chapter = listingChapter(l);
    const cur = cheapest.get(shop);
    if (!cur || chapter < cur.chapter) cheapest.set(shop, { shop, price: l.price, chapter });
  }
  for (const v of cheapest.values()) out.push({ kind: "shop", ...v });

  const inv = collectables.inventions.find((i) => i.weaponId === weaponId);
  if (inv) {
    let gilda = 0;
    let chapter = 1;
    for (const m of inv.items) {
      const p = shopItems.get(names.items[m.itemId]);
      gilda += (p?.price ?? 0) * m.quantity;
      chapter = Math.max(chapter, p?.fromChapter ?? 1);
    }
    // With alternative recipes, the one available earliest counts.
    const recipeChapter = Math.min(
      ...inv.recipes.map((r) => Math.max(...r.map((id) => photoChapter.get(id) ?? 8))),
    );
    out.push({ kind: "invent", chapter: Math.max(chapter, recipeChapter), gilda });
  }
  return out;
}
