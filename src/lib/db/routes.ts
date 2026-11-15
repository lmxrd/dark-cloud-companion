/**
 * Where everything in the game database lives in the app: the list pages under `/db/` and a page per
 * thing (`/db/<kind>/<id>`). Kept free of game-data imports so any island can link without pulling a
 * data file into its bundle; the one exception (a monster form's class) is passed in.
 */

/** The list pages, by path segment under `/db/`, in the order the home and the menu show them. */
export const DB_LISTS = [
  "weapons",
  "items",
  "ridepod",
  "abilities",
  "bestiary",
  "monsters",
  "places",
  "shops",
  "people",
  "georama",
  "fishing",
  "inventions",
  "spheda",
  "trophies",
] as const;
export type DbList = (typeof DB_LISTS)[number];

/** Each kind of thing with a page: its path segment, and the list page it belongs to. */
export const DB_KINDS = {
  weapon: { segment: "weapons", list: "weapons" },
  item: { segment: "items", list: "items" },
  ridepodPart: { segment: "ridepod", list: "ridepod" },
  ridepodCore: { segment: "ridepod", list: "ridepod" },
  ability: { segment: "abilities", list: "abilities" },
  enemy: { segment: "bestiary", list: "bestiary" },
  monsterClass: { segment: "monsters", list: "monsters" },
  town: { segment: "towns", list: "places" },
  dungeon: { segment: "dungeons", list: "places" },
  floor: { segment: "floors", list: "places" },
  shop: { segment: "shops", list: "shops" },
  npc: { segment: "people", list: "people" },
  georamaPart: { segment: "georama", list: "georama" },
  fish: { segment: "fishing", list: "fishing" },
  invention: { segment: "inventions", list: "inventions" },
  photo: { segment: "photos", list: "inventions" },
} as const satisfies Record<string, { segment: string; list: DbList }>;
export type DbKind = keyof typeof DB_KINDS;

/** The list page of a kind or list name. */
export const dbListHref = (list: DbList) => `/db/${list}`;

/** A thing's page. */
export const dbHref = (kind: DbKind, id: string | number) =>
  `/db/${DB_KINDS[kind].segment}/${encodeURIComponent(String(id))}`;

/** A monster form's page sits under its class: `/db/monsters/<class>/<form>`. */
export const monsterFormHref = (classId: string, formId: string) =>
  `${dbHref("monsterClass", classId)}/${encodeURIComponent(formId)}`;

/** Section types that have a floor page; story scenes and interludes link to their chapter. */
export const FLOOR_TYPES = ["dungeon", "boss"] as const;

/** A section's page: its floor page, or the chapter it belongs to. */
export const sectionHref = (section: { id: string; type: string; chapterNumber: number }) =>
  (FLOOR_TYPES as readonly string[]).includes(section.type)
    ? dbHref("floor", section.id)
    : `/chapters/${section.chapterNumber}`;

/** A product (shop stock, prize, reward): exactly one of these ids is set. */
export const productHref = (p: {
  itemId?: string;
  weaponId?: string;
  ridepodPartId?: string;
  ridepodCoreId?: string;
}) =>
  p.itemId
    ? dbHref("item", p.itemId)
    : p.weaponId
      ? dbHref("weapon", p.weaponId)
      : p.ridepodPartId
        ? dbHref("ridepodPart", p.ridepodPartId)
        : dbHref("ridepodCore", p.ridepodCoreId ?? "");
