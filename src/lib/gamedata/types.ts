/**
 * Shapes of the game-data files that `scripts/db/export.ts` writes from `drizzle/game.db` into
 * `src/gamedata/` (generated, not committed). Row types come straight from the database schema, so
 * a schema change shows up here as a type error. Empty values are left out of the files, which is
 * why every nullable column is an optional field.
 */
import type * as db from "@/db/schema";

/** A table row as exported: nullable columns become optional fields without `null`. */
export type Row<T> = {
  [K in keyof T as null extends T[K] ? never : K]: T[K];
} & {
  [K in keyof T as null extends T[K] ? K : never]?: Exclude<T[K], null>;
};
type Select<T extends { $inferSelect: unknown }> = Row<T["$inferSelect"]>;

/** Something you can get: exactly one of these ids is set. */
export interface ProductRef {
  itemId?: string;
  weaponId?: string;
  ridepodPartId?: string;
  ridepodCoreId?: string;
}
/** A reward or prize: what, and how many. */
export type Reward = ProductRef & { quantity: number };

// ─── names.json (always loaded) ──────────────────────────────────────────────────────────────────

/** Display names by id, so every other file can reference things by id only. */
export interface Names {
  items: Record<string, string>;
  weapons: Record<string, string>;
  ridepodParts: Record<string, string>;
  ridepodCores: Record<string, string>;
  enemies: Record<string, string>;
  photos: Record<string, string>;
  inventions: Record<string, string>;
  npcs: Record<string, string>;
  sections: Record<string, string>;
  towns: Record<string, string>;
  dungeons: Record<string, string>;
  georamaParts: Record<string, string>;
  fish: Record<string, string>;
  shops: Record<string, string>;
  abilities: Record<string, string>;
  monsterClasses: Record<string, string>;
}

// ─── core.json (always loaded) ───────────────────────────────────────────────────────────────────

export type Chapter = Select<typeof db.chapters>;
export type Section = Select<typeof db.sections>;
export type Dungeon = Select<typeof db.dungeons>;
export type Town = Select<typeof db.towns>;

export interface Core {
  chapters: Chapter[];
  /** All sections in play order (chapter, then position). */
  sections: Section[];
  dungeons: Dungeon[];
  towns: Town[];
}

// ─── collectables.json: everything that can be ticked off ────────────────────────────────────────

export type Photo = Select<typeof db.photos>;
export type Invention = Select<typeof db.inventions> & {
  /** Photo ids per recipe; the first is the main recipe. */
  recipes: string[][];
  /** Materials it costs. */
  items: { itemId: string; quantity: number }[];
};
export type Pickup = Select<typeof db.pickups>;
export type Recruit = Select<typeof db.recruits> & {
  requirements: Omit<Select<typeof db.recruitRequirements>, "id" | "npcId">[];
};
export type GeoramaGoal = Omit<Select<typeof db.georamaGoals>, "taskId">;
export type GeoramaTask = Select<typeof db.georamaTasks> & { goals: GeoramaGoal[] };
export type MonsterClass = Select<typeof db.monsterClasses>;

export interface Collectables {
  photos: Photo[];
  inventions: Invention[];
  pickups: Pickup[];
  recruits: Recruit[];
  /** Per town, in order; the goals are what gets ticked. */
  georamaTasks: GeoramaTask[];
  /** The badges to collect, one per class. */
  monsterClasses: MonsterClass[];
  photoLevels: Select<typeof db.photoLevels>[];
}

// ─── chapter/<n>.json: per-floor detail, loaded with the chapter ─────────────────────────────────

export type FloorEnemy = Omit<Select<typeof db.sectionEnemies>, "sectionId">;
export interface FloorDetail {
  enemies: FloorEnemy[];
  /** Georama materials found on the floor. */
  georamaItems: string[];
  /** Georama parts its geostone unlocks. */
  geostoneParts: string[];
  /** first / second / repeat win. */
  sphedaPrizes: Partial<Record<(typeof db.SPHEDA_PRIZE_TIERS)[number], Reward>>;
  rewards: (Reward & { character?: (typeof db.CHARACTERS)[number] })[];
  exits: { toSectionId: string; type: (typeof db.EXIT_TYPES)[number] }[];
  /** Derived: ABS and gilda of all enemies outside / inside the Star Key area. */
  totals: { abs: number; gilda: number; starAreaAbs?: number; starAreaGilda?: number };
}
/** Floors and fights of one chapter, by section id. */
export type ChapterDetail = Record<string, FloorDetail>;

// ─── where things come from (weapons.json, items.json) ───────────────────────────────────────────

/** When a shop listing can be bought (the `availability()` columns of the schema). */
export interface Availability {
  fromChapterNumber?: number;
  afterSectionId?: string;
  afterRecruitNpcId?: string;
  afterGeoramaTaskId?: number;
  untilChapterNumber?: number;
  untilSectionId?: string;
  untilRecruitNpcId?: string;
}

/** Every way to get one thing. Lists are left out when empty. */
export interface Sources {
  shops?: (Availability & { shopId: string; price?: number; purchaseLimit?: number })[];
  inventions?: string[];
  drops?: { enemyId: string; method?: (typeof db.DROP_METHODS)[number] }[];
  pickups?: number[];
  dungeons?: string[];
  sphedaPrizes?: {
    sectionId: string;
    tier: (typeof db.SPHEDA_PRIZE_TIERS)[number];
    quantity: number;
  }[];
  sectionRewards?: {
    sectionId: string;
    character?: (typeof db.CHARACTERS)[number];
    quantity: number;
  }[];
  georamaRewards?: { townId: string; quantity: number }[];
  contestPrizes?: {
    contestId: string;
    classId?: number;
    place: number;
    prizeSet: (typeof db.PRIZE_SETS)[number];
    quantity: number;
  }[];
  monsterRewards?: { classId: string; level: number; quantity: number }[];
  photoLevels?: number[];
  startingEquipment?: (typeof db.EQUIPMENT_OWNERS)[number][];
  /** Weapons: built up from these weapons. */
  buildUpFrom?: string[];
}

export type Weapon = Select<typeof db.weapons> & {
  abilities: string[];
  /** Weapons it can be built up into. */
  buildsInto: string[];
  /** Enemies to defeat with it before it can be built up. */
  killRequirements: string[];
  sources: Sources;
};
export type Ability = Select<typeof db.abilities>;
export interface Weapons {
  weapons: Weapon[];
  abilities: Ability[];
}

export type Item = Select<typeof db.items> & {
  effects: Omit<Select<typeof db.itemEffects>, "id" | "itemId">[];
  sources: Sources;
};
export interface Items {
  items: Item[];
}

// ─── enemies.json ────────────────────────────────────────────────────────────────────────────────

export type Enemy = Select<typeof db.enemies> & {
  drops: Omit<Select<typeof db.enemyDrops>, "enemyId">[];
  /** Floors and fights it appears in. */
  sections: { sectionId: string; count: number; starArea?: boolean }[];
};
export interface Enemies {
  enemies: Enemy[];
}

// ─── shops.json ──────────────────────────────────────────────────────────────────────────────────

export type ShopStock = Omit<Select<typeof db.shopStock>, "shopId">;
export type Shop = Select<typeof db.shops> & { stock: ShopStock[] };
export interface Shops {
  shops: Shop[];
}

// ─── ridepod.json ────────────────────────────────────────────────────────────────────────────────

export type RidepodPart = Select<typeof db.ridepodParts> & {
  weapon?: Omit<Select<typeof db.ridepodWeapons>, "partId" | "partType">;
  body?: Omit<Select<typeof db.ridepodBodies>, "partId" | "partType">;
  legs?: Omit<Select<typeof db.ridepodLegs>, "partId" | "partType">;
  energyPack?: Omit<Select<typeof db.ridepodEnergyPacks>, "partId" | "partType">;
  sources: Sources;
};
export type RidepodCore = Select<typeof db.ridepodCores> & { sources: Sources };
export interface Ridepod {
  parts: RidepodPart[];
  cores: RidepodCore[];
  shieldKitCosts: Select<typeof db.shieldKitCosts>[];
}

// ─── georama.json ────────────────────────────────────────────────────────────────────────────────

export type GeoramaPart = Select<typeof db.georamaParts> & {
  items: { itemId: string; quantity: number }[];
};
export interface Georama {
  parts: GeoramaPart[];
  /** Per town: which parts it can build, and how many at most. */
  townParts: Select<typeof db.georamaTownParts>[];
  startingParts: Select<typeof db.georamaStartingParts>[];
  townRewards: Select<typeof db.georamaTownRewards>[];
  housingRequirements: Select<typeof db.npcHousingRequirements>[];
}

// ─── monsters.json ───────────────────────────────────────────────────────────────────────────────

export type MonsterForm = Select<typeof db.monsterForms> & {
  evolvesInto: Omit<Select<typeof db.monsterEvolutions>, "fromId">[];
};
export interface Monsters {
  forms: MonsterForm[];
  unlocks: Select<typeof db.monsterClassUnlocks>[];
  levelRewards: Select<typeof db.monsterClassLevelRewards>[];
}

// ─── fishing.json ────────────────────────────────────────────────────────────────────────────────

export type Fish = Select<typeof db.fish> & {
  habitats: Omit<Select<typeof db.fishHabitats>, "id" | "fishId">[];
  /** Baits and lures that attract it. */
  tackle: string[];
};
export type FishingContest = Select<typeof db.fishingContests> & {
  classes: Omit<Select<typeof db.fishingContestClasses>, "contestId">[];
  prizes: Omit<Select<typeof db.fishingContestPrizes>, "contestId">[];
};
export interface Fishing {
  fish: Fish[];
  breeding: Select<typeof db.fishBreeding>[];
  tackle: Select<typeof db.fishingTackle>[];
  feedEffects: Select<typeof db.fishFeedEffects>[];
  rodStats: Select<typeof db.fishingRodStats>[];
  contests: FishingContest[];
}

// ─── misc.json ───────────────────────────────────────────────────────────────────────────────────

export type Trophy = Select<typeof db.trophies> & { weapons?: string[] };
export type Npc = Select<typeof db.npcs> & {
  skills: Omit<Select<typeof db.npcSkills>, "npcId">[];
};
export interface Misc {
  trophies: Trophy[];
  npcs: Npc[];
}
