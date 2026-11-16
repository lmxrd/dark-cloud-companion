/**
 * Rows for the database list pages, computed at build time from the whole database and passed to
 * the list islands as props, so the lists can sort and filter by things (an enemy's first chapter,
 * every way to get an item) without loading the big data files in the browser.
 */
import type { Translate } from "@/i18n";
import type { ItemTab } from "./routes";
import type { Sources } from "@/lib/gamedata/types";
import { STAT_KEYS, type StatKey } from "@/lib/schemas";
import { statsOf } from "@/components/db/stats";
import { effectText } from "@/components/db/text";
import {
  byId,
  chapterOf,
  collectables,
  core,
  enemies,
  fishing,
  georama,
  items,
  misc,
  shops,
  weapons,
} from "./data";

const min = (xs: (number | undefined | null)[]) => {
  const ns = xs.filter((x): x is number => typeof x === "number");
  return ns.length ? Math.min(...ns) : undefined;
};

const recruitChapter = (npcId: string | undefined) =>
  npcId ? byId.recruit.get(npcId)?.chapterNumber : undefined;
const enemyFirstChapter = new Map(
  enemies.map((e) => [e.id, min(e.sections.map((s) => chapterOf(s.sectionId)))]),
);

/** The chapter a shop listing can first be bought in. */
export function listingChapter(l: {
  shopId: string;
  fromChapterNumber?: number;
  afterRecruitNpcId?: string;
}) {
  const shop = byId.shop.get(l.shopId);
  return (
    l.fromChapterNumber ??
    recruitChapter(l.afterRecruitNpcId) ??
    shop?.fromChapterNumber ??
    recruitChapter(shop?.afterRecruitNpcId) ??
    1
  );
}

/** The earliest chapter anything in a set of sources can be had. */
export function firstChapter(s: Sources): number | undefined {
  return min([
    ...(s.shops ?? []).map(listingChapter),
    ...(s.inventions ?? []).map((id) => byId.invention.get(id)?.chapterNumber),
    ...(s.pickups ?? []).map((id) => byId.pickup.get(id)?.chapterNumber),
    ...(s.sphedaPrizes ?? []).map((p) => chapterOf(p.sectionId)),
    ...(s.sectionRewards ?? []).map((p) => chapterOf(p.sectionId)),
    ...(s.drops ?? []).map((d) => enemyFirstChapter.get(d.enemyId)),
    ...(s.dungeons ?? []).map((d) => byId.dungeon.get(d)?.chapterNumber),
    ...(s.contestPrizes ?? []).map((p) => byId.contest.get(p.contestId)?.fromChapterNumber),
    ...(s.monsterRewards ?? []).map((p) => byId.monsterClass.get(p.classId)?.chapterNumber),
    ...((s.startingEquipment ?? []).length ? [1] : []),
  ]);
}

/** The kinds of source something has, for the chips on list rows. */
export type SourceKind =
  | "shop"
  | "invention"
  | "drop"
  | "pickup"
  | "chest"
  | "spheda"
  | "reward"
  | "georama"
  | "contest"
  | "monster"
  | "photo"
  | "start"
  | "build";
export function sourceKinds(s: Sources): SourceKind[] {
  const k: [SourceKind, unknown[] | undefined][] = [
    ["shop", s.shops],
    ["invention", s.inventions],
    ["drop", s.drops],
    ["pickup", s.pickups],
    ["chest", s.dungeons],
    ["spheda", s.sphedaPrizes],
    ["reward", s.sectionRewards],
    ["georama", s.georamaRewards],
    ["contest", s.contestPrizes],
    ["monster", s.monsterRewards],
    ["photo", s.photoLevels],
    ["start", s.startingEquipment],
    ["build", s.buildUpFrom],
  ];
  return k.filter(([, v]) => v?.length).map(([kind]) => kind);
}

const cheapest = (s: Sources) => {
  const gilda = (s.shops ?? []).filter(
    (l) => l.price != null && (byId.shop.get(l.shopId)?.currency ?? "gilda") === "gilda",
  );
  if (!gilda.length) return undefined;
  const best = gilda.reduce((a, b) => (b.price! < a.price! ? b : a));
  return { price: best.price!, chapter: listingChapter(best) };
};

// ─── items ────────────────────────────────────────────────────────────────────────────────────────


export interface ItemRow {
  id: string;
  name: string;
  tab: Exclude<ItemTab, "all">;
  /** Also listed under Synth (materials and synth-only items that add stats). */
  synth: boolean;
  gains: Partial<Record<StatKey | "du", number>>;
  ability?: string;
  effects: string[];
  price?: number;
  priceChapter?: number;
  chapter?: number;
  sources: SourceKind[];
}

const itemTab = (type: string | undefined): ItemRow["tab"] =>
  type === "functional"
    ? "usable"
    : type === "clothing"
      ? "gear"
      : type === "material"
        ? "materials"
        : type === "coin"
          ? "coins"
          : type === "synth-only"
            ? "synth"
            : "other";

export function itemRows(t: Translate): ItemRow[] {
  return items.items.map((i) => {
    const s = statsOf(i, "synth");
    const gains: ItemRow["gains"] = {};
    for (const k of STAT_KEYS) if (s[k]) gains[k] = s[k];
    if (i.synthDurability) gains.du = i.synthDurability;
    const shop = cheapest(i.sources);
    return {
      id: i.id,
      name: i.name,
      tab: itemTab(i.type),
      synth: !!i.synthCategory,
      gains,
      ability: i.abilityId,
      effects: i.effects.map((e) => effectText(t, e)),
      price: shop?.price,
      priceChapter: shop?.chapter,
      chapter: firstChapter(i.sources),
      sources: sourceKinds(i.sources),
    };
  });
}

// ─── enemies ──────────────────────────────────────────────────────────────────────────────────────

export interface EnemyRow {
  id: string;
  name: string;
  variant?: string;
  number?: number;
  type: string;
  className?: string;
  hp?: number;
  abs?: number;
  gilda?: number;
  chapter?: number;
  /** Dungeons it appears in; "" for fights outside a dungeon. */
  dungeons: string[];
  /** Words it can be found by: drops and floors. */
  search: string;
}

export function enemyRows(): EnemyRow[] {
  return enemies.map((e) => ({
    id: e.id,
    name: e.name,
    variant: e.variantLabel,
    number: e.notesNumber,
    type: e.type,
    className: e.classId ? byId.monsterClass.get(e.classId)?.name : undefined,
    hp: e.hp,
    abs: e.abs,
    gilda: e.gilda,
    chapter: enemyFirstChapter.get(e.id),
    dungeons: [...new Set(e.sections.map((s) => byId.section.get(s.sectionId)?.dungeonId ?? ""))],
    search: [
      ...e.drops.map((d) => byId.item.get(d.itemId)?.name),
      ...e.sections.map((s) => byId.section.get(s.sectionId)?.title),
    ].join(" "),
  }));
}

// ─── people ───────────────────────────────────────────────────────────────────────────────────────

export interface PersonRow {
  id: string;
  name: string;
  town?: string;
  townId?: string;
  skills: string[];
  chapter?: number;
  quest?: string;
}
export const personRows = (): PersonRow[] =>
  misc.npcs.map((n) => {
    const r = byId.recruit.get(n.id);
    return {
      id: n.id,
      name: n.name,
      town: n.homeTownId ? byId.town.get(n.homeTownId)?.name : undefined,
      townId: n.homeTownId,
      skills: n.skills.map((s) => s.name),
      chapter: r?.chapterNumber,
      quest: r?.questName,
    };
  });

// ─── trophies ─────────────────────────────────────────────────────────────────────────────────────

export interface TrophyRow {
  id: string;
  name: string;
  tier: string;
  description?: string;
  position: number;
  chapter?: number;
  links: { kind: "enemy" | "fish" | "ridepodCore" | "weapon"; id: string; name: string }[];
}
export const trophyRows = (): TrophyRow[] =>
  misc.trophies.map((x) => ({
    id: x.id,
    name: x.name,
    tier: x.tier,
    description: x.description,
    position: x.position,
    chapter: x.chapterNumber,
    links: [
      ...(x.enemyId
        ? [
            {
              kind: "enemy" as const,
              id: x.enemyId,
              name: byId.enemy.get(x.enemyId)?.name ?? x.enemyId,
            },
          ]
        : []),
      ...(x.fishId
        ? [{ kind: "fish" as const, id: x.fishId, name: byId.fish.get(x.fishId)?.name ?? x.fishId }]
        : []),
      ...(x.ridepodCoreId
        ? [
            {
              kind: "ridepodCore" as const,
              id: x.ridepodCoreId,
              name: byId.ridepodCore.get(x.ridepodCoreId)?.name ?? x.ridepodCoreId,
            },
          ]
        : []),
      ...(x.weapons ?? []).map((w) => ({
        kind: "weapon" as const,
        id: w,
        name: byId.weapon.get(w)?.name ?? w,
      })),
    ],
  }));

// ─── abilities ────────────────────────────────────────────────────────────────────────────────────

export const abilityRows = () =>
  weapons.abilities.map((a, position) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    position,
    weapons: weapons.weapons.filter((w) => w.abilities.includes(a.id)).length,
    items: items.items.filter((i) => i.abilityId === a.id).map((i) => ({ id: i.id, name: i.name })),
  }));
export type AbilityRow = ReturnType<typeof abilityRows>[number];

// ─── fish ─────────────────────────────────────────────────────────────────────────────────────────

export const fishRows = () =>
  fishing.fish.map((f) => ({
    id: f.id,
    name: f.name,
    places: f.habitats.map((h) =>
      h.sectionId
        ? (byId.section.get(h.sectionId)?.title ?? "")
        : h.dungeonId
          ? (byId.dungeon.get(h.dungeonId)?.name ?? "")
          : (byId.town.get(h.townId ?? "")?.name ?? ""),
    ),
    chapter: min(
      f.habitats.map((h) =>
        h.sectionId
          ? chapterOf(h.sectionId)
          : h.dungeonId
            ? byId.dungeon.get(h.dungeonId)?.chapterNumber
            : 1,
      ),
    ),
    tackle: f.tackle.map((id) => byId.item.get(id)?.name ?? id),
    bredFrom: fishing.breeding.filter((b) => b.childId === f.id).length,
  }));
export type FishRow = ReturnType<typeof fishRows>[number];

// ─── inventions and photos ────────────────────────────────────────────────────────────────────────

export const inventionRows = () =>
  collectables.inventions.map((v) => ({
    id: v.id,
    name: v.name,
    chapter: v.chapterNumber,
    makes: (v.weaponId ? "weapon" : v.ridepodPartId ? "ridepod" : "item") as
      | "weapon"
      | "ridepod"
      | "item",
    ideas: v.recipes[0]?.map((p) => byId.photo.get(p)?.name ?? p) ?? [],
    missable: !!v.missable,
  }));
export type InventionRow = ReturnType<typeof inventionRows>[number];

export const photoRows = () =>
  collectables.photos.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    points: p.points,
    chapter: p.chapterNumber,
    place: p.sectionId
      ? byId.section.get(p.sectionId)?.title
      : p.townId
        ? byId.town.get(p.townId)?.name
        : undefined,
    missable: !!p.missable,
    usedIn: collectables.inventions.filter((v) => v.recipes.some((r) => r.includes(p.id))).length,
  }));
export type PhotoRow = ReturnType<typeof photoRows>[number];

// ─── Georama parts ────────────────────────────────────────────────────────────────────────────────

export const georamaRows = () =>
  georama.parts.map((p) => ({
    id: p.id,
    name: p.name,
    placement: p.placement,
    polyn: p.polynCost,
    culture: p.culturePoints,
    materials: p.items.map((m) => ({
      name: byId.item.get(m.itemId)?.name ?? m.itemId,
      quantity: m.quantity,
    })),
    towns: georama.townParts.filter((x) => x.georamaPartId === p.id).map((x) => x.townId),
  }));
export type GeoramaRow = ReturnType<typeof georamaRows>[number];

// ─── places ───────────────────────────────────────────────────────────────────────────────────────

export const placeRows = () =>
  core.towns.map((tw) => ({
    id: tw.id,
    name: tw.name,
    era: tw.era,
    georama: !!tw.hasGeorama,
    shops: shops.shops.filter((s) => s.townId === tw.id).length,
    dungeons: core.dungeons
      .filter((d) => d.townId === tw.id)
      .map((d) => {
        const floors = core.sections
          .filter((s) => s.dungeonId === d.id)
          .sort((a, b) => a.chapterNumber - b.chapterNumber || a.position - b.position);
        return {
          id: d.id,
          name: d.name,
          chapter: d.chapterNumber,
          floors: floors.map((s) => ({
            id: s.id,
            title: s.title,
            type: s.type,
            chapter: s.chapterNumber,
            abs: s.abs,
          })),
        };
      }),
  }));
export type PlaceRow = ReturnType<typeof placeRows>[number];

// ─── shops ────────────────────────────────────────────────────────────────────────────────────────

export const shopRows = () =>
  shops.shops.map((s) => ({
    id: s.id,
    name: s.name,
    townId: s.townId,
    town: s.townId ? byId.town.get(s.townId)?.name : undefined,
    keeper: s.npcId ? byId.npc.get(s.npcId)?.name : undefined,
    currency: s.currency,
    chapter: listingChapter({ shopId: s.id }),
    stock: s.stock.map((x) => ({
      name:
        (x.itemId && byId.item.get(x.itemId)?.name) ||
        (x.weaponId && byId.weapon.get(x.weaponId)?.name) ||
        (x.ridepodPartId && byId.ridepodPart.get(x.ridepodPartId)?.name) ||
        (x.ridepodCoreId && byId.ridepodCore.get(x.ridepodCoreId)?.name) ||
        "",
      chapter: x.fromChapterNumber ?? recruitChapter(x.afterRecruitNpcId),
      until: x.untilChapterNumber,
    })),
  }));
export type ShopRow = ReturnType<typeof shopRows>[number];
