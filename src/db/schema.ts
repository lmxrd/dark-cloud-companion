/**
 * The game-data schema for `drizzle/game.db` (Drizzle, SQLite). Edit the data with `pnpm db:studio`;
 * change this file, then `pnpm db:generate` and `pnpm db:migrate` to change the tables.
 *
 * Only facts about the game live here: no guides, no progress. The JSON the app reads is generated
 * from these tables, and anything that can be counted or looked up (chapter totals, a floor's ABS
 * and gilda, a section's new photos, …) is derived by that export instead of being stored.
 *
 * Conventions:
 * - Names are written out in full: `quantity`, `defense`, `synthAttack`, never `qty`, `def`, `at`.
 *   Game terms stay as the game writes them: `abs`, `hp`, `gilda`. US spelling throughout.
 * - Ids: things with a name use a text id made from the name alone, lowercase with dashes
 *   ("cubic-hammer", "brave-little-linda"); never a chapter or type in it. An id is set once and
 *   never changes, even when the display name is corrected later. Things without a name of their own
 *   (one of the 44 Fruits of Eden, a georama goal) use an integer id. Chapters are keyed by number.
 * - Links end in `Id`, or `Number` for chapters.
 * - `type` (and `subType`) for what kind of thing a row is; values are lowercase ids.
 * - `position` only where the order means something in the game (play order, list order in the
 *   game). Lower comes first; gaps are fine. Sets (a floor's enemies, a recipe's ideas) have none.
 * - NULL means "not applicable" or "unknown", never zero.
 * - Percentages are whole numbers (150 = 150%). Hours are in-game hours, 0-23.
 * - Columns are written camelCase here and stored snake_case (`casing: "snake_case"`).
 * - Fixed value sets and value ranges get a CHECK constraint, so a typo can't be saved. Rules that
 *   span rows (a variant of a variant, a recipe 1 for every invention) are checked at build time.
 * - Data goes in the database; anything calculated from it (totals, progress) is done in queries or
 *   in the export, never stored.
 * - Deleting a row that something still links to fails; nothing is deleted along with it.
 * - Shared column sets: `whereFound` (where a collectable is and when it can be had),
 *   `availability` (when a shop, its stock or a contest is there), `reward` (an item, weapon or
 *   Ridepod part, and how many).
 */
import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  foreignKey,
  integer,
  primaryKey,
  real,
  type SQLiteColumnBuilderBase,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ─── Helpers ──────────────────────────────────────────────────────────────────────────────────────

/** A SQL string literal ('it''s'). */
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/**
 * CHECK (column IN (...values)); NULL passes, so it also suits optional columns. SQLite doesn't
 * allow bound parameters in CHECK constraints, so the values are written into the SQL as literals.
 */
const oneOf = (name: string, column: AnySQLiteColumn, values: readonly string[]) =>
  check(name, sql`${column} IN (${sql.raw(values.map(literal).join(", "))})`);

/** CHECK (column BETWEEN min AND max); NULL passes. Leave `max` out for "at least". */
const inRange = (name: string, column: AnySQLiteColumn, min: number, max?: number) =>
  check(
    name,
    max === undefined
      ? sql`${column} >= ${sql.raw(String(min))}`
      : sql`${column} BETWEEN ${sql.raw(String(min))} AND ${sql.raw(String(max))}`,
  );

/** Ids made from a name: lowercase letters, digits and single dashes. */
const slugCheck = (name: string, column: AnySQLiteColumn) =>
  check(name, sql`${column} GLOB '[a-z0-9]*' AND ${column} NOT GLOB '*[^a-z0-9-]*'`);

/** Exactly one of several optional links is set. */
const exactlyOne = (name: string, ...columns: AnySQLiteColumn[]) =>
  check(
    name,
    sql`${sql.join(
      columns.map((c) => sql`(${c} IS NOT NULL)`),
      sql` + `,
    )} = 1`,
  );

/** Columns that are set together or not at all. */
const together = (name: string, ...columns: AnySQLiteColumn[]) =>
  check(
    name,
    sql`${sql.join(
      columns.map((c) => sql`(${c} IS NULL)`),
      sql` + `,
    )} IN (0, ${sql.raw(String(columns.length))})`,
  );

const bool = () => integer({ mode: "boolean" });

export const CHARACTERS = ["max", "monica"] as const;
export const WEAPON_TYPES = ["wrench", "gun", "club", "sword", "armband"] as const;

// ─── Story ────────────────────────────────────────────────────────────────────────────────────────

/**
 * The 8 chapters plus the postgame as chapter 9. End-of-chapter totals (ideas, scoops, inventions,
 * photo points and level, HP and defense) are derived from the tables below.
 */
export const chapters = sqliteTable(
  "chapters",
  {
    /** Chapter number, 1-8; 9 is the postgame. */
    number: integer().primaryKey(),
    /** Chapter title as the game shows it ("To the Outside World"). */
    title: text().notNull(),
  },
  (t) => [inRange("chapters_number", t.number, 1, 9)],
);

export const ERAS = ["present", "future"] as const;

/**
 * Towns and their future areas. Palm Brinks, the georama towns, and the future versions of a town
 * (Jurak Mall is Sindain's future, Luna Lab Veniccio's), which have their own shops and things to
 * find.
 */
export const towns = sqliteTable(
  "towns",
  {
    /** Id from the name ("sindain", "jurak-mall"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** Present or future. */
    era: text({ enum: ERAS }).notNull().default("present"),
    /** For a future area: the present-day town it is the future of. */
    presentTownId: text().references((): AnySQLiteColumn => towns.id),
    /** Whether it can be rebuilt with georama. */
    hasGeorama: bool().notNull().default(false),
    /** Story order: the order the towns open in. */
    position: integer().notNull(),
  },
  (t) => [
    slugCheck("towns_id", t.id),
    oneOf("towns_era", t.era, ERAS),
    check(
      "towns_future_has_present",
      sql`(${t.era} = 'future') = (${t.presentTownId} IS NOT NULL)`,
    ),
  ],
);

/** Dungeons: a set of floors entered from a town (Underground Channel, Rainbow Butterfly Wood, …). */
export const dungeons = sqliteTable(
  "dungeons",
  {
    /** Id from the name ("rainbow-butterfly-wood"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** The chapter it opens in. */
    chapterNumber: integer()
      .notNull()
      .references(() => chapters.number),
    /** The town it is entered from. */
    townId: text().references(() => towns.id),
    /** Story order: the order the dungeons open in. */
    position: integer().notNull(),
  },
  (t) => [slugCheck("dungeons_id", t.id)],
);

export const SECTION_TYPES = ["story", "dungeon", "boss", "interlude"] as const;
export const CLEAR_GOALS = [
  "items-only",
  "ridepod-only",
  "no-healing",
  "max-close-range-weapon-only",
  "max-gun-only",
  "monica-sword-only",
  "monica-magic-only",
  "monster-transformation-only",
] as const;
/**
 * Seals are the game's limited zones: white = no healing (no healing items or support characters),
 * blue = Max and the Ridepod only, red = Monica only. A seal lifts once every enemy on the floor is
 * defeated.
 */
export const RESTRICTIONS = ["white-seal", "blue-seal", "red-seal"] as const;

/**
 * A part of a chapter in play order: a dungeon floor, a boss fight, a story beat or an interlude.
 * Collectables say which section they are found in.
 */
export const sections = sqliteTable(
  "sections",
  {
    /** Id from the title ("rainbow-butterfly-wood-1"). */
    id: text().primaryKey(),
    /** The chapter it belongs to. */
    chapterNumber: integer()
      .notNull()
      .references(() => chapters.number),
    /** The dungeon it is a floor of; NULL for story beats and interludes in town. */
    dungeonId: text().references(() => dungeons.id),
    /** Play order within the chapter. */
    position: integer().notNull(),
    /** Name of the floor or event. */
    title: text().notNull(),
    /** What kind of part of the chapter it is. */
    type: text({ enum: SECTION_TYPES }).notNull(),
    /** Whether it can be skipped (optional bosses such as the Dark Genie). */
    optional: bool().notNull().default(false),
    /** The section after which it can no longer be played (Moon Flower Palace after its boss). */
    closedAfterSectionId: text().references((): AnySQLiteColumn => sections.id),
    /** A fight's time limit, in seconds (Dark Element: 300). */
    timeLimitSeconds: integer(),
    /** Dungeon medal: time to beat for the time-attack medal, in seconds (2:35 = 155). */
    medalTimeAttackSeconds: integer(),
    /** Dungeon medal: the condition for the clear-goal medal. */
    medalClearGoal: text({ enum: CLEAR_GOALS }),
    /** Dungeon medal: length of the fish to catch for the fishing medal, in centimeters. */
    medalFishingCentimeters: integer(),
    /** The seal on the floor, if any (a limited zone). */
    restriction: text({ enum: RESTRICTIONS }),
    /** Whether the floor has a geostone. The georama parts it unlocks are in `sectionGeostoneParts`. */
    hasGeostone: bool().notNull().default(false),
  },
  (t) => [
    slugCheck("sections_id", t.id),
    unique("sections_chapter_position").on(t.chapterNumber, t.position),
    oneOf("sections_type", t.type, SECTION_TYPES),
    oneOf("sections_medal_clear_goal", t.medalClearGoal, CLEAR_GOALS),
    oneOf("sections_restriction", t.restriction, RESTRICTIONS),
    inRange("sections_time_limit_seconds", t.timeLimitSeconds, 1),
    inRange("sections_medal_time_attack_seconds", t.medalTimeAttackSeconds, 1),
    inRange("sections_medal_fishing_centimeters", t.medalFishingCentimeters, 1),
    check(
      "sections_dungeon_floor_only",
      sql`${t.dungeonId} IS NOT NULL OR (${t.medalTimeAttackSeconds} IS NULL AND ${t.medalClearGoal} IS NULL AND ${t.medalFishingCentimeters} IS NULL AND ${t.hasGeostone} = 0)`,
    ),
  ],
);

export const EXIT_TYPES = ["normal", "sun", "moon", "star"] as const;

/**
 * Where a floor leads. Some floors have several exits: the Sun exit (by day), the Moon exit (at
 * night) and the Star exit (with the Star Key).
 */
export const sectionExits = sqliteTable(
  "section_exits",
  {
    /** The floor. */
    fromSectionId: text()
      .notNull()
      .references(() => sections.id),
    /** The floor the exit leads to. */
    toSectionId: text()
      .notNull()
      .references(() => sections.id),
    /** Which exit. */
    type: text({ enum: EXIT_TYPES }).notNull().default("normal"),
  },
  (t) => [
    primaryKey({ columns: [t.fromSectionId, t.toSectionId, t.type] }),
    oneOf("section_exits_type", t.type, EXIT_TYPES),
  ],
);

/** The georama parts a floor's geostone unlocks; none for "requirements only" geostones. */
export const sectionGeostoneParts = sqliteTable(
  "section_geostone_parts",
  {
    /** The floor. */
    sectionId: text()
      .notNull()
      .references(() => sections.id),
    /** A georama part its geostone unlocks. */
    georamaPartId: text()
      .notNull()
      .references(() => georamaParts.id),
  },
  (t) => [primaryKey({ columns: [t.sectionId, t.georamaPartId] })],
);

/** Georama materials that can be found on a floor ("Georama Supplies": Sturdy Rock, Bundle of Hay, …). */
export const sectionGeoramaItems = sqliteTable(
  "section_georama_items",
  {
    /** The floor. */
    sectionId: text()
      .notNull()
      .references(() => sections.id),
    /** A material found there. */
    itemId: text()
      .notNull()
      .references(() => items.id),
  },
  (t) => [primaryKey({ columns: [t.sectionId, t.itemId] })],
);

/**
 * The enemies on a floor or in a fight. A floor's ABS and gilda totals are derived from these.
 * Enemies in a floor's Star Key area are listed separately.
 */
export const sectionEnemies = sqliteTable(
  "section_enemies",
  {
    /** The floor or fight. */
    sectionId: text()
      .notNull()
      .references(() => sections.id),
    /** The enemy (the exact version, when it has several). */
    enemyId: text()
      .notNull()
      .references(() => enemies.id),
    /** Whether they are in the floor's Star Key area. */
    starArea: bool().notNull().default(false),
    /** How many of them there are. */
    count: integer().notNull(),
    /** Whether this enemy carries the floor's key. */
    carriesKey: bool().notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.sectionId, t.enemyId, t.starArea] }),
    inRange("section_enemies_count", t.count, 1),
  ],
);

/**
 * A reward: one item, weapon or Ridepod part, and how many. Shared by Spheda prizes, story rewards,
 * georama rewards and contest prizes.
 */
const reward = () =>
  ({
    /** The reward, when it is an item. */
    itemId: text().references(() => items.id),
    /** The reward, when it is a weapon. */
    weaponId: text().references(() => weapons.id),
    /** The reward, when it is a Ridepod part. */
    ridepodPartId: text().references(() => ridepodParts.id),
    /** How many of it. */
    quantity: integer().notNull().default(1),
  }) satisfies Record<string, SQLiteColumnBuilderBase>;

const rewardChecks = (
  table: string,
  t: {
    itemId: AnySQLiteColumn;
    weaponId: AnySQLiteColumn;
    ridepodPartId: AnySQLiteColumn;
    quantity: AnySQLiteColumn;
  },
) => [
  exactlyOne(`${table}_one_reward`, t.itemId, t.weaponId, t.ridepodPartId),
  inRange(`${table}_quantity`, t.quantity, 1),
];

export const SPHEDA_PRIZE_TIERS = ["first", "second", "repeat"] as const;

/**
 * A floor's Spheda prizes: the first win (which also gives the Spheda medal), the second win, and
 * every win after that. Floors without Spheda have none.
 */
export const sectionSphedaPrizes = sqliteTable(
  "section_spheda_prizes",
  {
    /** Integer id: a prize has no name of its own. */
    id: integer().primaryKey(),
    /** The floor. */
    sectionId: text()
      .notNull()
      .references(() => sections.id),
    /** Which win it is for. */
    tier: text({ enum: SPHEDA_PRIZE_TIERS }).notNull(),
    ...reward(),
  },
  (t) => [
    oneOf("section_spheda_prizes_tier", t.tier, SPHEDA_PRIZE_TIERS),
    unique("section_spheda_prizes_section_tier").on(t.sectionId, t.tier),
    ...rewardChecks("section_spheda_prizes", t),
  ],
);

/**
 * What a story event gives. Some depend on who does it: in Barga's Valley, the Swan if Max clears the
 * distortion, the Turkey if Monica does.
 */
export const sectionRewards = sqliteTable(
  "section_rewards",
  {
    /** Integer id: a reward has no name of its own. */
    id: integer().primaryKey(),
    /** The section it is given in. */
    sectionId: text()
      .notNull()
      .references(() => sections.id),
    /** Who has to do it, when that decides the reward. */
    character: text({ enum: CHARACTERS }),
    ...reward(),
  },
  (t) => [
    oneOf("section_rewards_character", t.character, CHARACTERS),
    ...rewardChecks("section_rewards", t),
  ],
);

// ─── Enemies ──────────────────────────────────────────────────────────────────────────────────────

/** `mimic`: the treasure-chest enemies (Mimic, King Mimic and their "2" versions). */
export const ENEMY_TYPES = ["normal", "sub-boss", "boss", "mimic"] as const;

/**
 * Every enemy and boss. An enemy whose stats differ by dungeon or fight (Mimic, Gaspard, …) has one
 * row per version; the extra versions point at the main one with `variantOfId`.
 */
export const enemies = sqliteTable(
  "enemies",
  {
    /** Id from the name; extra versions add where or when ("mimic-starlight-canyon"). */
    id: text().primaryKey(),
    /** Name as the game shows it; versions of one enemy share it. */
    name: text().notNull(),
    /** For an extra version (another dungeon, a second fight): the main version. NULL for most. */
    variantOfId: text().references((): AnySQLiteColumn => enemies.id),
    /** What sets this version apart ("second battle"); set exactly when `variantOfId` is. */
    variantLabel: text(),
    /** Its role in the game. */
    type: text({ enum: ENEMY_TYPES }).notNull().default("normal"),
    /** Its monster class (bosses have one too); NULL for the few without one. */
    classId: text().references(() => monsterClasses.id),
    /** Its number in the in-game Monster Notes (1-278). */
    notesNumber: integer(),
    /** The scoop that can be taken of it, if any. */
    photoId: text().references(() => photos.id),
    /** Hit points. */
    hp: integer(),
    /** Attack power. */
    attack: integer(),
    /** Defense. */
    defense: integer(),
    /** ABS released when defeated (picked up by the equipped weapon). */
    abs: integer(),
    /** Gilda received when defeated. */
    gilda: integer(),
    /** Damage taken from wrenches, as a percentage (under 100 = resists). */
    effectivenessWrench: integer(),
    /** Damage taken from hammers, as a percentage. */
    effectivenessHammer: integer(),
    /** Damage taken from swords, as a percentage. */
    effectivenessSword: integer(),
    /** Damage taken from guns, as a percentage. */
    effectivenessGun: integer(),
    /** Damage taken from beam guns, as a percentage. */
    effectivenessBeam: integer(),
    /** Damage taken from grenades, as a percentage. */
    effectivenessGrenade: integer(),
    /** Damage taken from magic, as a percentage. */
    effectivenessMagic: integer(),
    /** Damage taken from the Ridepod, as a percentage. */
    effectivenessRidepod: integer(),
    /** Effectiveness of Flame, as a percentage (over 100 = weak to it). */
    effectivenessFlame: integer(),
    /** Effectiveness of Chill, as a percentage. */
    effectivenessChill: integer(),
    /** Effectiveness of Lightning, as a percentage. */
    effectivenessLightning: integer(),
    /** Effectiveness of Cyclone, as a percentage. */
    effectivenessCyclone: integer(),
    /** Effectiveness of Smash, as a percentage. */
    effectivenessSmash: integer(),
    /** Effectiveness of Exorcism, as a percentage. */
    effectivenessExorcism: integer(),
    /** Effectiveness of Beast, as a percentage. */
    effectivenessBeast: integer(),
    /** Effectiveness of Scale, as a percentage. */
    effectivenessScale: integer(),
  },
  (t) => [
    slugCheck("enemies_id", t.id),
    oneOf("enemies_type", t.type, ENEMY_TYPES),
    together("enemies_variant", t.variantOfId, t.variantLabel),
    check("enemies_not_own_variant", sql`${t.variantOfId} <> ${t.id}`),
    inRange("enemies_notes_number", t.notesNumber, 1),
    inRange("enemies_hp", t.hp, 0),
    inRange("enemies_attack", t.attack, 0),
    inRange("enemies_defense", t.defense, 0),
    inRange("enemies_abs", t.abs, 0),
    inRange("enemies_gilda", t.gilda, 0),
  ],
);

export const DROP_METHODS = ["steal", "drop", "rare-drop"] as const;

/** What an enemy can drop or have stolen from it. */
export const enemyDrops = sqliteTable(
  "enemy_drops",
  {
    /** The enemy (the exact version). */
    enemyId: text()
      .notNull()
      .references(() => enemies.id),
    /** The item. */
    itemId: text()
      .notNull()
      .references(() => items.id),
    /** How it is obtained: stolen, a normal drop or a rare drop; NULL when the source doesn't say. */
    method: text({ enum: DROP_METHODS }),
    /** Chance of getting it, as a percentage; NULL until a source gives it. */
    chancePercent: real(),
  },
  (t) => [
    primaryKey({ columns: [t.enemyId, t.itemId] }),
    oneOf("enemy_drops_method", t.method, DROP_METHODS),
    inRange("enemy_drops_chance_percent", t.chancePercent, 0, 100),
  ],
);

// ─── Collectables: things the player can tick off ─────────────────────────────────────────────────

/**
 * Columns every collectable shares: where it is found, from when, until when, and what has to happen
 * first. Each condition is optional; when several are set, all of them apply.
 */
const whereFound = () =>
  ({
    /** The chapter it becomes available in (9 = only after the ending). */
    chapterNumber: integer()
      .notNull()
      .references(() => chapters.number),
    /** The last chapter it can still be had in; NULL if it stays available. */
    untilChapterNumber: integer().references(() => chapters.number),
    /** The section it is found in, when it belongs to one. */
    sectionId: text().references(() => sections.id),
    /** The town or future area it is found in, when it is found in town. */
    townId: text().references(() => towns.id),
    /** It only appears once this section has been reached. */
    afterSectionId: text().references(() => sections.id),
    /** It only appears once this georama task is done. */
    afterGeoramaTaskId: integer().references(() => georamaTasks.id),
    /** It only appears once this georama part has been placed. */
    requiresGeoramaPartId: text().references(() => georamaParts.id),
    /** Whether it can be lost for good if not collected in time. */
    missable: bool().notNull().default(false),
    /** Short facts on where exactly or from whom ("in front of Cedric's shop"). */
    notes: text({ mode: "json" }).$type<string[]>(),
  }) satisfies Record<string, SQLiteColumnBuilderBase>;

export const PHOTO_TYPES = ["idea", "scoop"] as const;

/** Photos: ideas (things to invent with) and scoops (photos of enemies and characters). */
export const photos = sqliteTable(
  "photos",
  {
    /** Id from the name ("fountain", "brave-little-linda"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** Idea or scoop. */
    type: text({ enum: PHOTO_TYPES }).notNull(),
    /** Album points it is worth (ideas 2, scoops 5). */
    points: integer().notNull(),
    /** The game's description of it (the Scoop Memo text for scoops). */
    description: text(),
    ...whereFound(),
    /** First in-game hour it can be taken; NULL for any time. */
    fromHour: integer(),
    /** Hour it can no longer be taken (may be lower than `fromHour` for overnight). */
    toHour: integer(),
    /** Whether there is only one chance to take it. */
    onlyChance: bool().notNull().default(false),
    /** Whether it is a ghost photo (taken at night); scoops only. */
    ghost: bool().notNull().default(false),
  },
  (t) => [
    slugCheck("photos_id", t.id),
    oneOf("photos_type", t.type, PHOTO_TYPES),
    inRange("photos_points", t.points, 1),
    together("photos_hours", t.fromHour, t.toHour),
    inRange("photos_from_hour", t.fromHour, 0, 23),
    inRange("photos_to_hour", t.toHour, 0, 23),
    check("photos_ghost_scoops_only", sql`${t.ghost} = 0 OR ${t.type} = 'scoop'`),
  ],
);

/**
 * Inventions: combining photos (`inventionIdeas`) and items (`inventionItems`) creates a Ridepod
 * part, a weapon or an item.
 */
export const inventions = sqliteTable(
  "inventions",
  {
    /** Id from the name ("aquarium"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    ...whereFound(),
    /** Where its recipe is found ("Max's Room, right bookshelf"). */
    recipeLocation: text(),
    /** What it creates, when it is a Ridepod part. */
    ridepodPartId: text().references(() => ridepodParts.id),
    /** What it creates, when it is a weapon. */
    weaponId: text().references(() => weapons.id),
    /** What it creates, when it is an item. */
    itemId: text().references(() => items.id),
  },
  (t) => [
    slugCheck("inventions_id", t.id),
    exactlyOne("inventions_one_result", t.ridepodPartId, t.weaponId, t.itemId),
  ],
);

/**
 * The photos an invention combines, usually three ideas or scoops per recipe. Some inventions have
 * an alternate recipe (Bucket Leg) or accept another photo in one slot (Heavy Hammer: Paznos or
 * Gigantor Paznos); each such combination is its own recipe number.
 */
export const inventionIdeas = sqliteTable(
  "invention_ideas",
  {
    /** The invention. */
    inventionId: text()
      .notNull()
      .references(() => inventions.id),
    /** Which recipe: 1 is the main one, 2 and up are alternates. */
    recipe: integer().notNull().default(1),
    /** A photo the recipe needs. */
    photoId: text()
      .notNull()
      .references(() => photos.id),
  },
  (t) => [
    primaryKey({ columns: [t.inventionId, t.recipe, t.photoId] }),
    inRange("invention_ideas_recipe", t.recipe, 1),
  ],
);

/** The items an invention needs to be built (the same for every recipe). */
export const inventionItems = sqliteTable(
  "invention_items",
  {
    /** The invention. */
    inventionId: text()
      .notNull()
      .references(() => inventions.id),
    /** An item it needs. */
    itemId: text()
      .notNull()
      .references(() => items.id),
    /** How many of it. */
    quantity: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.inventionId, t.itemId] }),
    inRange("invention_items_quantity", t.quantity, 1),
  ],
);

/**
 * Items lying around to be picked up, each spot its own row: power-ups (each Fruit of Eden), gems,
 * Wind Crystals. What a power-up does is on the item (`items.powerup*`).
 */
export const pickups = sqliteTable(
  "pickups",
  {
    /** Integer id: pickups have no name of their own. */
    id: integer().primaryKey(),
    /** The item picked up. */
    itemId: text()
      .notNull()
      .references(() => items.id),
    /** How many of it (Wind Crystal x4). */
    quantity: integer().notNull().default(1),
    ...whereFound(),
  },
  (t) => [inRange("pickups_quantity", t.quantity, 1)],
);

// ─── NPCs and recruits ────────────────────────────────────────────────────────────────────────────

/** Characters in the game: townspeople, shopkeepers, recruits. Their roles link here. */
export const npcs = sqliteTable(
  "npcs",
  {
    /** Id from the name ("priest-bruno"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** The town they live in, when they have one. */
    homeTownId: text().references(() => towns.id),
    /** Skill points they have for their support skills, once recruited. */
    maxSkillPoints: integer(),
  },
  (t) => [slugCheck("npcs_id", t.id), inRange("npcs_max_skill_points", t.maxSkillPoints, 1)],
);

/** NPCs who can be recruited, and where. Recruiting is something the player ticks off. */
export const recruits = sqliteTable(
  "recruits",
  {
    /** The NPC. */
    npcId: text()
      .primaryKey()
      .references(() => npcs.id),
    ...whereFound(),
    /** Where to find them to recruit them. */
    location: text(),
    /** Who has to talk to them, when only one of the two can recruit them (Milane: Monica). */
    character: text({ enum: CHARACTERS }),
    /** The quest's name in the notebook ("Portrait of a Bride"). */
    questName: text(),
  },
  (t) => [oneOf("recruits_character", t.character, CHARACTERS)],
);

export const RECRUIT_REQUIREMENT_TYPES = [
  "give-item",
  "show-item",
  "show-weapon",
  "show-photo",
  "catch-fish",
  "pay-gilda",
  "win-contest",
  "win-spheda",
  "beat-time",
  "enter-code",
  "story",
  "other",
] as const;

/**
 * What recruiting someone takes: give items, show an item, weapon or photo, catch a big enough fish,
 * pay, win a contest or Spheda games, beat a time, enter a code, or a story event. `text` holds the
 * wording for codes, stories and anything else.
 */
export const recruitRequirements = sqliteTable(
  "recruit_requirements",
  {
    /** Integer id: a requirement has no name of its own. */
    id: integer().primaryKey(),
    /** The recruit. */
    npcId: text()
      .notNull()
      .references(() => recruits.npcId),
    /** What kind of requirement it is; decides which of the columns below are set. */
    type: text({ enum: RECRUIT_REQUIREMENT_TYPES }).notNull(),
    /** give-item / show-item: the item. */
    itemId: text().references(() => items.id),
    /** show-weapon: the weapon (Gerald: Bell Trigger). */
    weaponId: text().references(() => weapons.id),
    /** show-photo: the photo (Claire: Lafrescia Stem). */
    photoId: text().references(() => photos.id),
    /** catch-fish: the fish (Fabio: a Nonky). */
    fishId: text().references(() => fish.id),
    /** catch-fish: its minimum length, in centimeters. */
    minimumCentimeters: integer(),
    /** win-contest: the contest class to win (any class when NULL). */
    contestClassId: integer().references(() => fishingContestClasses.id),
    /** How many: items to give, gilda to pay, Spheda games to win. */
    quantity: integer(),
    /** beat-time: the time to beat, in seconds. */
    seconds: integer(),
    /** enter-code, story, other: the code or what has to happen ("1221"). */
    text: text(),
  },
  (t) => [
    oneOf("recruit_requirements_type", t.type, RECRUIT_REQUIREMENT_TYPES),
    inRange("recruit_requirements_quantity", t.quantity, 1),
    inRange("recruit_requirements_minimum_centimeters", t.minimumCentimeters, 1),
    inRange("recruit_requirements_seconds", t.seconds, 1),
    check(
      "recruit_requirements_link_matches_type",
      sql`CASE ${t.type}
        WHEN 'give-item' THEN ${t.itemId} IS NOT NULL AND ${t.quantity} IS NOT NULL
        WHEN 'show-item' THEN ${t.itemId} IS NOT NULL
        WHEN 'show-weapon' THEN ${t.weaponId} IS NOT NULL
        WHEN 'show-photo' THEN ${t.photoId} IS NOT NULL
        WHEN 'catch-fish' THEN ${t.fishId} IS NOT NULL
        WHEN 'pay-gilda' THEN ${t.quantity} IS NOT NULL
        WHEN 'win-spheda' THEN ${t.quantity} IS NOT NULL
        WHEN 'beat-time' THEN ${t.seconds} IS NOT NULL
        WHEN 'enter-code' THEN ${t.text} IS NOT NULL
        WHEN 'story' THEN ${t.text} IS NOT NULL
        WHEN 'other' THEN ${t.text} IS NOT NULL
        ELSE 1
      END`,
    ),
  ],
);

/**
 * A recruit's support skills (in battle or in town) and their skill-point cost. Some make items
 * (Erik: 3 Improved Bombs), some help one weapon type (Cedric: wrenches).
 */
export const npcSkills = sqliteTable(
  "npc_skills",
  {
    /** Integer id: skill names repeat across NPCs. */
    id: integer().primaryKey(),
    /** The NPC. */
    npcId: text()
      .notNull()
      .references(() => npcs.id),
    /** Name as the game shows it ("Repair Weapons"). */
    name: text().notNull(),
    /** What it does. */
    description: text(),
    /** Skill points it costs; NULL for always-on bonuses. */
    skillPointCost: integer(),
    /** For skills that make an item: the item. */
    itemId: text().references(() => items.id),
    /** For skills that make an item: how many. */
    quantity: integer(),
    /** For bonuses to one weapon type: the type. */
    weaponType: text({ enum: WEAPON_TYPES }),
  },
  (t) => [
    unique("npc_skills_npc_name").on(t.npcId, t.name),
    inRange("npc_skills_skill_point_cost", t.skillPointCost, 1),
    together("npc_skills_item", t.itemId, t.quantity),
    inRange("npc_skills_quantity", t.quantity, 1),
    oneOf("npc_skills_weapon_type", t.weaponType, WEAPON_TYPES),
  ],
);

export const HOUSING_REQUIREMENT_TYPES = [
  "near-part",
  "in-part",
  "not-in-part",
  "roof-color",
  "minimum-stories",
  "other",
] as const;

/**
 * What a recruit wants from their home in a georama town: near a part (Gordon: a tree), in a part
 * (Bruno: only a Church), not in one (Milane: no Straw House), a roof color, a number of stories.
 */
export const npcHousingRequirements = sqliteTable(
  "npc_housing_requirements",
  {
    /** Integer id: a requirement has no name of its own. */
    id: integer().primaryKey(),
    /** The NPC. */
    npcId: text()
      .notNull()
      .references(() => npcs.id),
    /** What kind of requirement it is. */
    type: text({ enum: HOUSING_REQUIREMENT_TYPES }).notNull(),
    /** near-part / in-part / not-in-part: the part. */
    georamaPartId: text().references(() => georamaParts.id),
    /** roof-color: the color ("purple"). */
    color: text(),
    /** minimum-stories: how many stories. */
    quantity: integer(),
    /** other: what they want. */
    text: text(),
  },
  (t) => [
    oneOf("npc_housing_requirements_type", t.type, HOUSING_REQUIREMENT_TYPES),
    check(
      "npc_housing_requirements_link_matches_type",
      sql`CASE ${t.type}
        WHEN 'roof-color' THEN ${t.color} IS NOT NULL
        WHEN 'minimum-stories' THEN ${t.quantity} IS NOT NULL
        WHEN 'other' THEN ${t.text} IS NOT NULL
        ELSE ${t.georamaPartId} IS NOT NULL
      END`,
    ),
  ],
);

// ─── Photo album ──────────────────────────────────────────────────────────────────────────────────

/** Album levels; a photo's points are on the photo (`photos.points`). */
export const photoLevels = sqliteTable(
  "photo_levels",
  {
    /** Album level. */
    level: integer().primaryKey(),
    /** Album points needed to reach it. */
    minimumPoints: integer().notNull(),
    /** What Donny gives for reaching it, if anything. */
    rewardItemId: text().references(() => items.id),
  },
  (t) => [
    inRange("photo_levels_level", t.level, 1),
    inRange("photo_levels_points", t.minimumPoints, 0),
  ],
);

// ─── Georama ──────────────────────────────────────────────────────────────────────────────────────

/** What reaching 100% georama in a town gives (Veniccio: the Nova Cannon, a Ridepod part). */
export const georamaTownRewards = sqliteTable(
  "georama_town_rewards",
  {
    /** Integer id: a reward has no name of its own. */
    id: integer().primaryKey(),
    /** The town. */
    townId: text()
      .notNull()
      .references(() => towns.id),
    ...reward(),
  },
  (t) => [...rewardChecks("georama_town_rewards", t)],
);

/** A town's georama tasks: restore something by meeting its goals ("Forest Lake restored"). */
export const georamaTasks = sqliteTable(
  "georama_tasks",
  {
    /** Integer id: task names are not unique across towns. */
    id: integer().primaryKey(),
    /** The town. */
    townId: text()
      .notNull()
      .references(() => towns.id),
    /** The task as the game shows it. */
    name: text().notNull(),
    /** How much it adds to the town's completion, as a percentage. */
    percent: integer().notNull(),
    /** Order in the town's task list in the game. */
    position: integer().notNull(),
  },
  (t) => [inRange("georama_tasks_percent", t.percent, 1, 100)],
);

export const GEORAMA_GOAL_TYPES = [
  "parts-placed",
  "npc-resides",
  "residents",
  "task-completed",
  "culture-points",
  "story-event",
  "other",
] as const;
export const PART_RELATIONS = ["on", "near", "between", "around"] as const;

/**
 * Georama goals: the conditions of a task, each one linked to what fulfills it. Examples:
 * "At least 15 Trees planted" (parts-placed: Tree, 15), "Star Lamp on Brick House" (parts-placed with
 * a related part), "Resident in Straw House" (residents: 1, in a Straw House), "Priest Bruno resides
 * here" (npc-resides), "Gaspard defeated" (story-event). A line naming several tasks becomes several
 * goals. `other` keeps conditions with nothing to link to ("All 4 Plateaus at same height").
 */
export const georamaGoals = sqliteTable(
  "georama_goals",
  {
    /** Integer id: the same goal text appears in several towns. */
    id: integer().primaryKey(),
    /** The task it is a condition of. */
    taskId: integer()
      .notNull()
      .references(() => georamaTasks.id),
    /** The goal as the game shows it. */
    name: text().notNull(),
    /** What kind of condition it is; decides which of the columns below are set. */
    type: text({ enum: GEORAMA_GOAL_TYPES }).notNull(),
    /** parts-placed: the part to place; npc-resides / residents: the part they must live in, if any. */
    georamaPartId: text().references(() => georamaParts.id),
    /** parts-placed: how the part relates to `relatedGeoramaPartId`. */
    relation: text({ enum: PART_RELATIONS }),
    /** parts-placed: the other part ("on Brick House", "near River"). */
    relatedGeoramaPartId: text().references(() => georamaParts.id),
    /** A paint color the part must have ("Red Iron House"). */
    color: text(),
    /** parts-placed: how many to place; residents: how many people must live there. */
    quantity: integer(),
    /** npc-resides: who has to live there. */
    npcId: text().references(() => npcs.id),
    /** task-completed: the task that has to be done first (in any town). */
    requiredTaskId: integer().references((): AnySQLiteColumn => georamaTasks.id),
    /** culture-points: the culture points to reach. */
    culturePoints: integer(),
    /** story-event: the section where it happens. */
    sectionId: text().references(() => sections.id),
  },
  (t) => [
    oneOf("georama_goals_type", t.type, GEORAMA_GOAL_TYPES),
    oneOf("georama_goals_relation", t.relation, PART_RELATIONS),
    together("georama_goals_related_part", t.relation, t.relatedGeoramaPartId),
    inRange("georama_goals_quantity", t.quantity, 1),
    inRange("georama_goals_culture_points", t.culturePoints, 1),
    check(
      "georama_goals_link_matches_type",
      sql`CASE ${t.type}
        WHEN 'parts-placed' THEN ${t.georamaPartId} IS NOT NULL AND ${t.quantity} IS NOT NULL
        WHEN 'npc-resides' THEN ${t.npcId} IS NOT NULL
        WHEN 'residents' THEN ${t.quantity} IS NOT NULL
        WHEN 'task-completed' THEN ${t.requiredTaskId} IS NOT NULL
        WHEN 'culture-points' THEN ${t.culturePoints} IS NOT NULL
        WHEN 'story-event' THEN ${t.sectionId} IS NOT NULL
        ELSE 1
      END`,
    ),
  ],
);

export const PART_PLACEMENTS = ["ground", "house", "wall", "roof"] as const;

/** Georama parts: what can be placed in a town. */
export const georamaParts = sqliteTable(
  "georama_parts",
  {
    /** Id from the name ("iron-chimney-1"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** Where it goes: on the ground, as a house, on a house's wall or on its roof. */
    placement: text({ enum: PART_PLACEMENTS }),
    /** The group goals count it in ("tree", "house", "river"); NULL if none. */
    category: text(),
    /** Polyn it costs to place; NULL where the game doesn't use polyn (Moon Flower Palace). */
    polynCost: integer(),
    /** Culture points it gives; NULL where not counted. */
    culturePoints: integer(),
  },
  (t) => [
    slugCheck("georama_parts_id", t.id),
    oneOf("georama_parts_placement", t.placement, PART_PLACEMENTS),
    inRange("georama_parts_polyn_cost", t.polynCost, 0),
    inRange("georama_parts_culture_points", t.culturePoints, 0),
  ],
);

/** The items a georama part is built from; its gilda cost is derived from their prices. */
export const georamaPartItems = sqliteTable(
  "georama_part_items",
  {
    /** The part. */
    georamaPartId: text()
      .notNull()
      .references(() => georamaParts.id),
    /** An item it needs. */
    itemId: text()
      .notNull()
      .references(() => items.id),
    /** How many of it. */
    quantity: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.georamaPartId, t.itemId] }),
    inRange("georama_part_items_quantity", t.quantity, 1),
  ],
);

/** Which parts a town allows, and how many at most (Moon Flower Palace: Fountain 1). */
export const georamaTownParts = sqliteTable(
  "georama_town_parts",
  {
    /** The town. */
    townId: text()
      .notNull()
      .references(() => towns.id),
    /** A part it allows. */
    georamaPartId: text()
      .notNull()
      .references(() => georamaParts.id),
    /** The most that can be placed; NULL for no limit. */
    maxCount: integer(),
  },
  (t) => [
    primaryKey({ columns: [t.townId, t.georamaPartId] }),
    inRange("georama_town_parts_max_count", t.maxCount, 1),
  ],
);

/** The parts a town's georama starts with (Sindain: 4 Grass, 4 Rock, 3 Log). */
export const georamaStartingParts = sqliteTable(
  "georama_starting_parts",
  {
    /** The town. */
    townId: text()
      .notNull()
      .references(() => towns.id),
    /** The part. */
    georamaPartId: text()
      .notNull()
      .references(() => georamaParts.id),
    /** How many of it. */
    quantity: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.townId, t.georamaPartId] }),
    inRange("georama_starting_parts_quantity", t.quantity, 1),
  ],
);

// ─── Items and shops ──────────────────────────────────────────────────────────────────────────────

export const POWERUP_STATS = ["hp", "defense"] as const;
export const POWERUP_CHARACTERS = ["max", "monica", "both"] as const;
export const ITEM_TYPES = [
  "material",
  "functional",
  "clothing",
  "coin",
  "badge",
  "fishing",
  "ridepod-accessory",
  "synth-only",
] as const;
export const SYNTH_CATEGORIES = [
  "attack",
  "flame",
  "chill",
  "lightning",
  "cyclone",
  "smash",
  "exorcism",
  "beast",
  "scale",
  "gems",
  "durable",
] as const;
/** Max wears clothes, a hat and shoes; Monica clothes, a hair ornament and shoes. */
export const EQUIP_SLOTS = ["clothes", "hat", "hair-ornament", "shoes"] as const;

/**
 * Every item: materials, consumables, clothing, coins, badges, baits and lures, Ridepod accessories
 * (the Voice Unit). Ridepod parts and fish have their own tables but link to an item here for what
 * spectrumizing them gives (type `synth-only`). What a usable item does is in `itemEffects`; where it
 * is sold and for how much is in `shopStock`.
 */
export const items = sqliteTable(
  "items",
  {
    /** Id from the name ("gold-bar"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** What kind of item it is. */
    type: text({ enum: ITEM_TYPES }),
    /** The game's description of it ("Restores 30 HP", "Lets you take pictures"). */
    description: text(),
    /** How many can be carried; NULL for the usual 20. */
    maxStack: integer(),
    /** For clothing: who wears it. */
    equipCharacter: text({ enum: CHARACTERS }),
    /** For clothing: where it is worn. */
    equipSlot: text({ enum: EQUIP_SLOTS }),
    /** The weapon-synthesis category; NULL when it can't be synthesized into a weapon. */
    synthCategory: text({ enum: SYNTH_CATEGORIES }),
    /** Synthesis points a weapon needs free to synthesize it ("SP Needed"). */
    synthPointCost: integer(),
    /** What synthesizing it adds: Attack. */
    synthAttack: integer(),
    /** What synthesizing it adds: Flame. */
    synthFlame: integer(),
    /** What synthesizing it adds: Chill. */
    synthChill: integer(),
    /** What synthesizing it adds: Lightning. */
    synthLightning: integer(),
    /** What synthesizing it adds: Cyclone. */
    synthCyclone: integer(),
    /** What synthesizing it adds: Smash. */
    synthSmash: integer(),
    /** What synthesizing it adds: Exorcism. */
    synthExorcism: integer(),
    /** What synthesizing it adds: Beast. */
    synthBeast: integer(),
    /** What synthesizing it adds: Scale. */
    synthScale: integer(),
    /** What synthesizing it adds: Durability. */
    synthDurability: integer(),
    /** For coins: the ability synthesizing it gives a weapon. */
    abilityId: text().references(() => abilities.id),
    /** For power-up items (Fruit of Eden, …): who it powers up. */
    powerupCharacter: text({ enum: POWERUP_CHARACTERS }),
    /** For power-up items: which stat it raises. */
    powerupStat: text({ enum: POWERUP_STATS }),
    /** For power-up items: how much it raises that stat by. */
    powerupAmount: integer(),
  },
  (t) => [
    slugCheck("items_id", t.id),
    oneOf("items_type", t.type, ITEM_TYPES),
    oneOf("items_equip_character", t.equipCharacter, CHARACTERS),
    oneOf("items_equip_slot", t.equipSlot, EQUIP_SLOTS),
    together("items_equip", t.equipCharacter, t.equipSlot),
    oneOf("items_synth_category", t.synthCategory, SYNTH_CATEGORIES),
    inRange("items_synth_point_cost", t.synthPointCost, 0),
    inRange("items_max_stack", t.maxStack, 1),
    oneOf("items_powerup_character", t.powerupCharacter, POWERUP_CHARACTERS),
    oneOf("items_powerup_stat", t.powerupStat, POWERUP_STATS),
    together("items_powerup", t.powerupCharacter, t.powerupStat, t.powerupAmount),
    inRange("items_powerup_amount", t.powerupAmount, 1),
  ],
);

export const ITEM_EFFECTS = [
  "heal",
  "cause-status",
  "cure-status",
  "prevent-status",
  "inflict-status",
  "damage",
  "repair-weapon",
  "boost-attack",
  "boost-defense",
  "level-up-weapon",
  "rename-weapon",
  "revive",
  "escape-dungeon",
  "refuel-ridepod",
  "break-seal",
  "open-chest",
  "reveal-map",
  "reveal-enemies",
  "cross-floor",
  "boost-monster",
  "slow-transformation-timer",
] as const;
export const STATUSES = [
  "poison",
  "thirsty",
  "cursed",
  "gooey",
  "petrify",
  "stop",
  "pumped-up",
  "all",
] as const;
export const ELEMENTS = [
  "flame",
  "chill",
  "lightning",
  "cyclone",
  "smash",
  "exorcism",
  "beast",
  "scale",
] as const;
export const EFFECT_AREAS = ["single", "small", "medium", "large"] as const;
export const EFFECT_TARGETS = ["self", "both", "enemy", "melee-weapon", "gun", "armband"] as const;
export const FLOOR_HAZARDS = ["hot", "slippery", "muddy"] as const;

/**
 * What using (or equipping) an item does. An item can have several effects (Mellow Banana heals
 * and causes Thirsty); the columns after `effect` are set only where they apply. What feeding a bait
 * to a fish does is in `fishFeedEffects`.
 */
export const itemEffects = sqliteTable(
  "item_effects",
  {
    /** Integer id: an effect has no name of its own. */
    id: integer().primaryKey(),
    /** The item. */
    itemId: text()
      .notNull()
      .references(() => items.id),
    /** What it does. */
    effect: text({ enum: ITEM_EFFECTS }).notNull(),
    /** heal: HP restored; NULL means all. */
    amount: integer(),
    /** The status caused, cured, prevented (while equipped) or inflicted. */
    status: text({ enum: STATUSES }),
    /** damage: the element; NULL means non-elemental. */
    element: text({ enum: ELEMENTS }),
    /** damage: how wide it hits. */
    area: text({ enum: EFFECT_AREAS }),
    /** Who or what it affects (the user, both characters, an enemy, a weapon kind). */
    target: text({ enum: EFFECT_TARGETS }),
    /** cross-floor: the kind of floor it lets you walk on (Dragon Shoes: hot floors). */
    floor: text({ enum: FLOOR_HAZARDS }),
  },
  (t) => [
    oneOf("item_effects_effect", t.effect, ITEM_EFFECTS),
    oneOf("item_effects_status", t.status, STATUSES),
    oneOf("item_effects_element", t.element, ELEMENTS),
    oneOf("item_effects_area", t.area, EFFECT_AREAS),
    oneOf("item_effects_target", t.target, EFFECT_TARGETS),
    oneOf("item_effects_floor", t.floor, FLOOR_HAZARDS),
    inRange("item_effects_amount", t.amount, 1),
    check(
      "item_effects_status_needed",
      sql`(${t.status} IS NOT NULL) = (${t.effect} IN ('cause-status', 'cure-status', 'prevent-status', 'inflict-status'))`,
    ),
    check(
      "item_effects_floor_needed",
      sql`(${t.floor} IS NOT NULL) = (${t.effect} = 'cross-floor')`,
    ),
  ],
);

/**
 * When something is available: from and until a chapter or section, after recruiting someone, after
 * a georama task. Each is optional; when several are set, all of them apply. Used by shops, their
 * stock and fishing contests.
 */
const availability = () =>
  ({
    /** Available from this chapter. */
    fromChapterNumber: integer().references(() => chapters.number),
    /** Available once this section has been reached. */
    afterSectionId: text().references(() => sections.id),
    /** Available once this NPC has been recruited. */
    afterRecruitNpcId: text().references(() => npcs.id),
    /** Available once this georama task is done. */
    afterGeoramaTaskId: integer().references(() => georamaTasks.id),
    /** The last chapter it is available in. */
    untilChapterNumber: integer().references(() => chapters.number),
    /** No longer available once this section has been reached ("until defeating Linda"). */
    untilSectionId: text().references(() => sections.id),
    /** No longer available once this NPC has been recruited ("until you recruit Donny"). */
    untilRecruitNpcId: text().references(() => npcs.id),
  }) satisfies Record<string, SQLiteColumnBuilderBase>;

export const CURRENCIES = ["gilda", "medals", "abs"] as const;

/**
 * Places to buy things: a shop in a town or future area, or a recruited NPC who sells without a
 * shop of their own (no town). What it sells is in `shopStock`.
 */
export const shops = sqliteTable(
  "shops",
  {
    /** Id from the name ("mortons-sundries"). */
    id: text().primaryKey(),
    /** Name as the game shows it ("Morton's Sundries"). */
    name: text().notNull().unique(),
    /** The town or future area it is in; NULL for an NPC who sells without a shop. */
    townId: text().references(() => towns.id),
    /** For an NPC who sells without a shop: who. */
    npcId: text().references(() => npcs.id),
    /** What its prices are paid in. */
    currency: text({ enum: CURRENCIES }).notNull().default("gilda"),
    ...availability(),
  },
  (t) => [
    slugCheck("shops_id", t.id),
    oneOf("shops_currency", t.currency, CURRENCIES),
    check("shops_place", sql`${t.townId} IS NOT NULL OR ${t.npcId} IS NOT NULL`),
  ],
);

/**
 * What a shop sells, for how much and from when until when; each listing is one item, weapon,
 * Ridepod part or core.
 */
export const shopStock = sqliteTable(
  "shop_stock",
  {
    /** Integer id: a listing has no name of its own. */
    id: integer().primaryKey(),
    /** The shop. */
    shopId: text()
      .notNull()
      .references(() => shops.id),
    /** What is sold, when it is an item. */
    itemId: text().references(() => items.id),
    /** What is sold, when it is a weapon. */
    weaponId: text().references(() => weapons.id),
    /** What is sold, when it is a Ridepod part. */
    ridepodPartId: text().references(() => ridepodParts.id),
    /** What is sold, when it is a Ridepod core. */
    ridepodCoreId: text().references(() => ridepodCores.id),
    /** Price in the shop's currency; NULL when it varies (repair powders). */
    price: integer(),
    /** How many can be bought in total ("only sells one"); NULL for no limit. */
    purchaseLimit: integer(),
    ...availability(),
  },
  (t) => [
    exactlyOne("shop_stock_one_product", t.itemId, t.weaponId, t.ridepodPartId, t.ridepodCoreId),
    inRange("shop_stock_price", t.price, 0),
    inRange("shop_stock_purchase_limit", t.purchaseLimit, 1),
    uniqueIndex("shop_stock_shop_item")
      .on(t.shopId, t.itemId)
      .where(sql`${t.itemId} IS NOT NULL`),
    uniqueIndex("shop_stock_shop_weapon")
      .on(t.shopId, t.weaponId)
      .where(sql`${t.weaponId} IS NOT NULL`),
    uniqueIndex("shop_stock_shop_ridepod_part")
      .on(t.shopId, t.ridepodPartId)
      .where(sql`${t.ridepodPartId} IS NOT NULL`),
    uniqueIndex("shop_stock_shop_ridepod_core")
      .on(t.shopId, t.ridepodCoreId)
      .where(sql`${t.ridepodCoreId} IS NOT NULL`),
  ],
);

// ─── Weapons ──────────────────────────────────────────────────────────────────────────────────────

/** Subtypes per weapon type; types not listed have none. */
export const WEAPON_SUB_TYPES = {
  gun: ["normal", "machine-gun", "grenade", "beam"],
  wrench: ["wrench", "hammer"],
} as const satisfies Partial<Record<(typeof WEAPON_TYPES)[number], readonly string[]>>;
export const ALL_WEAPON_SUB_TYPES = [...WEAPON_SUB_TYPES.gun, ...WEAPON_SUB_TYPES.wrench] as const;

/**
 * Every weapon: its stats and how it builds up. Where it comes from is in other tables: shops
 * (`shopStock`), inventions, dungeons, Spheda prizes, story and georama rewards, contest prizes,
 * starting equipment.
 */
export const weapons = sqliteTable(
  "weapons",
  {
    /** Id from the name ("cubic-hammer"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** Who wields it. */
    character: text({ enum: CHARACTERS }).notNull(),
    /** Weapon type. */
    type: text({ enum: WEAPON_TYPES }).notNull(),
    /** The kind of weapon within its type: a gun's damage type, wrench or hammer. */
    subType: text({ enum: ALL_WEAPON_SUB_TYPES }),
    /** Combo length as printed ("5"; "5F" fast, "5b" a variant); shown as is. */
    combo: text(),
    /** The in-game item description. */
    description: text(),
    /** Whether its attack changes with the time of day (Lamb's Sword). */
    attackVariesByTime: bool().notNull().default(false),
    /** ABS needed to reach +1 (the "B" in the ABS formulas); some guns use halves, hence real. */
    baseAbs: real().notNull(),
    /** Synthesis points gained per level: 3 low, 4 mid, 6 high tier. */
    synthPointsPerLevel: integer().notNull(),
    /** Synthesis points it starts with. */
    baseSynthPoints: integer().notNull(),
    /** Maximum durability. */
    maxDurability: integer().notNull(),
    /** Starting stat: Attack. */
    baseAttack: integer().notNull(),
    /** Starting stat: Flame. */
    baseFlame: integer().notNull(),
    /** Starting stat: Chill. */
    baseChill: integer().notNull(),
    /** Starting stat: Lightning. */
    baseLightning: integer().notNull(),
    /** Starting stat: Cyclone. */
    baseCyclone: integer().notNull(),
    /** Starting stat: Smash. */
    baseSmash: integer().notNull(),
    /** Starting stat: Exorcism. */
    baseExorcism: integer().notNull(),
    /** Starting stat: Beast. */
    baseBeast: integer().notNull(),
    /** Starting stat: Scale. */
    baseScale: integer().notNull(),
    /** Stat cap: Attack. */
    maxAttack: integer().notNull(),
    /** Stat cap: Flame. */
    maxFlame: integer().notNull(),
    /** Stat cap: Chill. */
    maxChill: integer().notNull(),
    /** Stat cap: Lightning. */
    maxLightning: integer().notNull(),
    /** Stat cap: Cyclone. */
    maxCyclone: integer().notNull(),
    /** Stat cap: Smash. */
    maxSmash: integer().notNull(),
    /** Stat cap: Exorcism. */
    maxExorcism: integer().notNull(),
    /** Stat cap: Beast. */
    maxBeast: integer().notNull(),
    /** Stat cap: Scale. */
    maxScale: integer().notNull(),
  },
  (t) => [
    slugCheck("weapons_id", t.id),
    oneOf("weapons_character", t.character, CHARACTERS),
    oneOf("weapons_type", t.type, WEAPON_TYPES),
    inRange("weapons_base_abs", t.baseAbs, 0),
    inRange("weapons_synth_points_per_level", t.synthPointsPerLevel, 1),
    inRange("weapons_max_durability", t.maxDurability, 1),
    check(
      "weapons_sub_type_matches_type",
      sql`${t.subType} IS NULL OR CASE ${t.type} ${sql.join(
        Object.entries(WEAPON_SUB_TYPES).map(
          ([type, subs]) =>
            sql`WHEN ${sql.raw(literal(type))} THEN ${t.subType} IN (${sql.raw(subs.map(literal).join(", "))})`,
        ),
        sql` `,
      )} ELSE 0 END`,
    ),
  ],
);

/**
 * Weapon abilities (Steal, Poison, Abs Up, …): what a weapon or a coin can give. Some pairs cancel
 * each other out (Wealth and Poverty).
 */
export const abilities = sqliteTable(
  "abilities",
  {
    /** Id from the name ("abs-up"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** What it does. */
    description: text(),
    /** The ability that cancels it out, if any (Wealth: Poverty). */
    oppositeId: text().references((): AnySQLiteColumn => abilities.id),
  },
  (t) => [
    slugCheck("abilities_id", t.id),
    check("abilities_not_own_opposite", sql`${t.oppositeId} <> ${t.id}`),
  ],
);

/** The abilities a weapon comes with. */
export const weaponAbilities = sqliteTable(
  "weapon_abilities",
  {
    /** The weapon. */
    weaponId: text()
      .notNull()
      .references(() => weapons.id),
    /** An ability it has. */
    abilityId: text()
      .notNull()
      .references(() => abilities.id),
  },
  (t) => [primaryKey({ columns: [t.weaponId, t.abilityId] })],
);

/** Which weapons a weapon builds up into. */
export const weaponBuildUps = sqliteTable(
  "weapon_build_ups",
  {
    /** The weapon that builds up. */
    weaponId: text()
      .notNull()
      .references(() => weapons.id),
    /** A weapon it can build up into. */
    targetId: text()
      .notNull()
      .references(() => weapons.id),
  },
  (t) => [
    primaryKey({ columns: [t.weaponId, t.targetId] }),
    check("weapon_build_ups_not_itself", sql`${t.weaponId} <> ${t.targetId}`),
  ],
);

/** Enemies that must have been killed before building up *into* a weapon. */
export const weaponKillRequirements = sqliteTable(
  "weapon_kill_requirements",
  {
    /** The weapon being built up into. */
    weaponId: text()
      .notNull()
      .references(() => weapons.id),
    /** An enemy that must have been killed first (the main version, when it has several). */
    enemyId: text()
      .notNull()
      .references(() => enemies.id),
  },
  (t) => [primaryKey({ columns: [t.weaponId, t.enemyId] })],
);

/**
 * Weapons found somewhere in a dungeon: in chests or as random loot, per the weapon guide's
 * "Dungeon Weapons" list. The source doesn't say which floor or enemy.
 */
export const dungeonWeapons = sqliteTable(
  "dungeon_weapons",
  {
    /** The dungeon. */
    dungeonId: text()
      .notNull()
      .references(() => dungeons.id),
    /** A weapon found there. */
    weaponId: text()
      .notNull()
      .references(() => weapons.id),
  },
  (t) => [primaryKey({ columns: [t.dungeonId, t.weaponId] })],
);

export const EQUIPMENT_OWNERS = ["max", "monica", "ridepod"] as const;

/**
 * What Max, Monica and the Ridepod start the game with (Battle Wrench, Knight Boots, Cannonball Arm,
 * Core, …).
 */
export const startingEquipment = sqliteTable(
  "starting_equipment",
  {
    /** Integer id: a starting piece has no name of its own. */
    id: integer().primaryKey(),
    /** Who starts with it. */
    owner: text({ enum: EQUIPMENT_OWNERS }).notNull(),
    /** The piece, when it is an item (clothing). */
    itemId: text().references(() => items.id),
    /** The piece, when it is a weapon. */
    weaponId: text().references(() => weapons.id),
    /** The piece, when it is a Ridepod part. */
    ridepodPartId: text().references(() => ridepodParts.id),
    /** The piece, when it is a Ridepod core. */
    ridepodCoreId: text().references(() => ridepodCores.id),
  },
  (t) => [
    oneOf("starting_equipment_owner", t.owner, EQUIPMENT_OWNERS),
    exactlyOne(
      "starting_equipment_one_piece",
      t.itemId,
      t.weaponId,
      t.ridepodPartId,
      t.ridepodCoreId,
    ),
  ],
);

// ─── Monster transformation (Monica) ──────────────────────────────────────────────────────────────

/**
 * Monster classes. Enemies belong to one; Monica unlocks each with its badge, which the player ticks
 * off (hence the where-found columns). How to get the badge is in `monsterClassUnlocks`, what
 * evolving gives in `monsterClassLevelRewards`.
 */
export const monsterClasses = sqliteTable(
  "monster_classes",
  {
    /** Id from the name ("flora"); also the badge's tick id. */
    id: text().primaryKey(),
    /** Name as the game shows it ("Flora"). */
    name: text().notNull().unique(),
    /** The badge's name as the game shows it ("Flora Badge"). */
    badgeName: text().notNull().unique(),
    ...whereFound(),
  },
  (t) => [slugCheck("monster_classes_id", t.id)],
);

export const UNLOCK_METHODS = ["buy", "gift", "kill-with"] as const;

/**
 * Ways to get a class's badge, one row per way: buy the badge (an item, sold in `shopStock`), give an
 * enemy a Gift Capsule with items, or kill an enemy with an item. Any variety of the enemy works, so
 * each one that does gets a row.
 */
export const monsterClassUnlocks = sqliteTable(
  "monster_class_unlocks",
  {
    /** Integer id: a way to unlock has no name of its own. */
    id: integer().primaryKey(),
    /** The class it unlocks. */
    classId: text()
      .notNull()
      .references(() => monsterClasses.id),
    /** How. */
    method: text({ enum: UNLOCK_METHODS }).notNull(),
    /** buy: the badge item; gift: what to put in the Gift Capsule; kill-with: what to kill it with. */
    itemId: text()
      .notNull()
      .references(() => items.id),
    /** gift / kill-with: an enemy it works on. */
    enemyId: text().references(() => enemies.id),
    /** gift: how many of the item. */
    quantity: integer(),
  },
  (t) => [
    oneOf("monster_class_unlocks_method", t.method, UNLOCK_METHODS),
    inRange("monster_class_unlocks_quantity", t.quantity, 1),
    check(
      "monster_class_unlocks_link_matches_method",
      sql`CASE ${t.method}
        WHEN 'buy' THEN ${t.enemyId} IS NULL AND ${t.quantity} IS NULL
        WHEN 'gift' THEN ${t.enemyId} IS NOT NULL AND ${t.quantity} IS NOT NULL
        WHEN 'kill-with' THEN ${t.enemyId} IS NOT NULL AND ${t.quantity} IS NULL
      END`,
    ),
  ],
);

/**
 * What a class gives when Monica evolves it at level 26, 51 and 76: a Monster Drop each time, and
 * 5 gemstones at 76 for mastering it (Beast: Garnet).
 */
export const monsterClassLevelRewards = sqliteTable(
  "monster_class_level_rewards",
  {
    /** The class. */
    classId: text()
      .notNull()
      .references(() => monsterClasses.id),
    /** The level the reward is given at. */
    level: integer().notNull(),
    /** The item given. */
    itemId: text()
      .notNull()
      .references(() => items.id),
    /** How many of it. */
    quantity: integer().notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.classId, t.level, t.itemId] }),
    inRange("monster_class_level_rewards_level", t.level, 2, 99),
    inRange("monster_class_level_rewards_quantity", t.quantity, 1),
  ],
);

/** The forms Monica can transform into, per class. How far along a form is follows from the evolutions. */
export const monsterForms = sqliteTable(
  "monster_forms",
  {
    /** Id from the name; a second form with the same name gets a number ("spider-lady-2"). */
    id: text().primaryKey(),
    /** The class it belongs to. */
    classId: text()
      .notNull()
      .references(() => monsterClasses.id),
    /** Name as the game shows it (Darkling has two "Spider Lady" forms). */
    name: text().notNull(),
    /** Attack at level 99. */
    attack: integer().notNull(),
    /** Defense at level 99. */
    defense: integer().notNull(),
  },
  (t) => [slugCheck("monster_forms_id", t.id)],
);

/** Which form evolves into which, from what level, and what it takes. */
export const monsterEvolutions = sqliteTable(
  "monster_evolutions",
  {
    /** The form that evolves. */
    fromId: text()
      .notNull()
      .references(() => monsterForms.id),
    /** A form it can evolve into. */
    toId: text()
      .notNull()
      .references(() => monsterForms.id),
    /** The level from which the change is possible (26, 51 or 76). */
    level: integer().notNull(),
    /** An item the change needs, if any (Holy Gemron: Ruby). */
    requiredItemId: text().references(() => items.id),
    /** How many of that item (5). */
    requiredQuantity: integer(),
  },
  (t) => [
    primaryKey({ columns: [t.fromId, t.toId] }),
    inRange("monster_evolutions_level", t.level, 2, 99),
    together("monster_evolutions_requirement", t.requiredItemId, t.requiredQuantity),
    inRange("monster_evolutions_required_quantity", t.requiredQuantity, 1),
  ],
);

// ─── Ridepod (Steve) ─────────────────────────────────────────────────────────────────────────────

export const RIDEPOD_PART_TYPES = ["weapon", "body", "legs", "energy-pack"] as const;

/**
 * Ridepod parts. Every one is invented (`inventions.ridepodPartId`); some can also be bought
 * (`shopStock`). What a part does depends on its type and is in the table for that type; each of
 * those tables only accepts parts of its own type. Accessories (the Voice Unit) are items.
 */
export const ridepodParts = sqliteTable(
  "ridepod_parts",
  {
    /** Id from the name ("cannonball-arm-ii"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** Which slot it goes in. */
    type: text({ enum: RIDEPOD_PART_TYPES }).notNull(),
    /** Capacity it uses up. */
    capacity: integer().notNull(),
    /** The item row with what spectrumizing it gives, for parts that can be spectrumized. */
    itemId: text()
      .unique()
      .references(() => items.id),
  },
  (t) => [
    slugCheck("ridepod_parts_id", t.id),
    oneOf("ridepod_parts_type", t.type, RIDEPOD_PART_TYPES),
    unique("ridepod_parts_id_type").on(t.id, t.type),
    inRange("ridepod_parts_capacity", t.capacity, 1),
  ],
);

/**
 * The link from a type table to its part: the part's id plus a fixed type, so a part can only get
 * details of its own type (a legs part can't get weapon stats).
 */
const partOfType = (type: (typeof RIDEPOD_PART_TYPES)[number]) =>
  ({
    /** The part. */
    partId: text().primaryKey(),
    /** The part's type; always the same in this table, it only lets the link check the type. */
    partType: text({ enum: RIDEPOD_PART_TYPES }).notNull().default(type),
  }) satisfies Record<string, SQLiteColumnBuilderBase>;

const partOfTypeChecks = (
  table: string,
  type: (typeof RIDEPOD_PART_TYPES)[number],
  t: { partId: AnySQLiteColumn; partType: AnySQLiteColumn },
) => [
  check(`${table}_part_type`, sql`${t.partType} = ${sql.raw(literal(type))}`),
  foreignKey({
    name: `${table}_part_fk`,
    columns: [t.partId, t.partType],
    foreignColumns: [ridepodParts.id, ridepodParts.type],
  }),
];

/** Ridepod weapon families by range; the range is derived from the family. */
export const RIDEPOD_WEAPON_SUB_TYPES = {
  short: ["cannonball-arm", "clown-hand", "samurai-arm", "hammer-arm", "drill-arm"],
  long: ["barrel-cannon", "machine-gun-arm", "missile-pod-arm", "nova-cannon", "laser-arm"],
} as const;
export const ALL_RIDEPOD_WEAPON_SUB_TYPES = [
  ...RIDEPOD_WEAPON_SUB_TYPES.short,
  ...RIDEPOD_WEAPON_SUB_TYPES.long,
] as const;

/** Ridepod weapons (arms): each family comes in four tiers ("Hammer Arm III"). */
export const ridepodWeapons = sqliteTable(
  "ridepod_weapons",
  {
    ...partOfType("weapon"),
    /** The weapon family. */
    subType: text({ enum: ALL_RIDEPOD_WEAPON_SUB_TYPES }).notNull(),
    /** Tier within the family, 1-4. */
    tier: integer().notNull(),
    /** Weapon HP. */
    weaponHp: integer().notNull(),
    /** Attack. */
    attack: integer().notNull(),
    /** Flame, if it has it. */
    flame: integer(),
    /** Chill, if it has it. */
    chill: integer(),
    /** Lightning, if it has it. */
    lightning: integer(),
    /** Cyclone, if it has it. */
    cyclone: integer(),
    /** Smash, if it has it. */
    smash: integer(),
    /** Exorcism, if it has it. */
    exorcism: integer(),
    /** Beast, if it has it. */
    beast: integer(),
    /** Scale, if it has it. */
    scale: integer(),
  },
  (t) => [
    ...partOfTypeChecks("ridepod_weapons", "weapon", t),
    oneOf("ridepod_weapons_sub_type", t.subType, ALL_RIDEPOD_WEAPON_SUB_TYPES),
    inRange("ridepod_weapons_tier", t.tier, 1, 4),
    unique("ridepod_weapons_sub_type_tier").on(t.subType, t.tier),
    inRange("ridepod_weapons_weapon_hp", t.weaponHp, 1),
    inRange("ridepod_weapons_attack", t.attack, 0),
  ],
);

/** Ridepod bodies (the guide's "armor"). */
export const ridepodBodies = sqliteTable(
  "ridepod_bodies",
  {
    ...partOfType("body"),
    /** Armor it gives. */
    armor: integer().notNull(),
  },
  (t) => [
    ...partOfTypeChecks("ridepod_bodies", "body", t),
    inRange("ridepod_bodies_armor", t.armor, 0),
  ],
);

/** Legs walk; wheels roll (Buggy, Caterpillar); airborne parts fly (Propeller Leg, Jet Hover). */
export const RIDEPOD_LEG_SUB_TYPES = ["legs", "wheels", "airborne"] as const;
export const RIDEPOD_SPEEDS = ["slow", "average", "fast", "very-fast"] as const;

/** Ridepod legs: what Steve moves on, and how fast. */
export const ridepodLegs = sqliteTable(
  "ridepod_legs",
  {
    ...partOfType("legs"),
    /** How it moves: legs, wheels or airborne. */
    subType: text({ enum: RIDEPOD_LEG_SUB_TYPES }).notNull(),
    /** Movement speed. */
    speed: text({ enum: RIDEPOD_SPEEDS }).notNull(),
  },
  (t) => [
    ...partOfTypeChecks("ridepod_legs", "legs", t),
    oneOf("ridepod_legs_sub_type", t.subType, RIDEPOD_LEG_SUB_TYPES),
    oneOf("ridepod_legs_speed", t.speed, RIDEPOD_SPEEDS),
  ],
);

/** Ridepod energy packs. */
export const ridepodEnergyPacks = sqliteTable(
  "ridepod_energy_packs",
  {
    ...partOfType("energy-pack"),
    /** Energy it holds. */
    energy: integer().notNull(),
  },
  (t) => [
    ...partOfTypeChecks("ridepod_energy_packs", "energy-pack", t),
    inRange("ridepod_energy_packs_energy", t.energy, 1),
  ],
);

/** Ridepod cores: how much Steve can carry. Bought in order, with ABS (`shopStock`). */
export const ridepodCores = sqliteTable(
  "ridepod_cores",
  {
    /** Id from the name ("hyper-core"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** Capacity it provides for parts. */
    capacity: integer().notNull(),
    /** Extra armor capacity it adds. */
    armorCapacity: integer().notNull(),
    /** Purchase order: each core goes on sale once the one before it is bought. */
    position: integer().notNull(),
  },
  (t) => [
    slugCheck("ridepod_cores_id", t.id),
    inRange("ridepod_cores_capacity", t.capacity, 1),
    inRange("ridepod_cores_armor_capacity", t.armorCapacity, 0),
  ],
);

/** Cost in ABS of each shield-kit purchase (each adds 4 armor; one at a time). */
export const shieldKitCosts = sqliteTable(
  "shield_kit_costs",
  {
    /** Which purchase, from 1. */
    purchase: integer().primaryKey(),
    /** ABS it costs. */
    cost: integer().notNull(),
  },
  (t) => [
    inRange("shield_kit_costs_purchase", t.purchase, 1),
    inRange("shield_kit_costs_cost", t.cost, 1),
  ],
);

// ─── Fishing ──────────────────────────────────────────────────────────────────────────────────────

export const WATER_TYPES = ["fresh", "ocean"] as const;

/** Fish species. */
export const fish = sqliteTable(
  "fish",
  {
    /** Id from the name ("baron-garayan"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** The water where it can bite whatever the bait (Gummy: fresh, Bon: ocean); NULL for most. */
    rejectIn: text({ enum: WATER_TYPES }),
    /** The item row with what spectrumizing it gives, for fish that can be spectrumized. */
    itemId: text()
      .unique()
      .references(() => items.id),
  },
  (t) => [slugCheck("fish_id", t.id), oneOf("fish_reject_in", t.rejectIn, WATER_TYPES)],
);

/** Where and when each fish can be caught: a floor, a whole dungeon or a town, and the hours. */
export const fishHabitats = sqliteTable(
  "fish_habitats",
  {
    /** Integer id: a habitat has no name of its own. */
    id: integer().primaryKey(),
    /** The fish. */
    fishId: text()
      .notNull()
      .references(() => fish.id),
    /** A floor where it bites (Umadakara: the last four floors of Starlight Canyon). */
    sectionId: text().references(() => sections.id),
    /** A dungeon where it bites on any fishing floor. */
    dungeonId: text().references(() => dungeons.id),
    /** A town where it bites (Baron Garayan: Heim Rada). */
    townId: text().references(() => towns.id),
    /** The exact spot, when it matters ("King Mardan's pond", "the hot springs pond"). */
    spot: text(),
    /** First in-game hour it bites; NULL for any time. */
    fromHour: integer(),
    /** Hour it stops biting (may be lower than `fromHour` for overnight, 18 to 6). */
    toHour: integer(),
  },
  (t) => [
    exactlyOne("fish_habitats_place", t.sectionId, t.dungeonId, t.townId),
    together("fish_habitats_hours", t.fromHour, t.toHour),
    inRange("fish_habitats_from_hour", t.fromHour, 0, 23),
    inRange("fish_habitats_to_hour", t.toHour, 0, 23),
  ],
);

/** Which two fish breed into which (in the Breeding Tank); a pair can have several outcomes. */
export const fishBreeding = sqliteTable(
  "fish_breeding",
  {
    /** One parent. */
    parentAId: text()
      .notNull()
      .references(() => fish.id),
    /** The other parent. */
    parentBId: text()
      .notNull()
      .references(() => fish.id),
    /** A fish they can produce. */
    childId: text()
      .notNull()
      .references(() => fish.id),
  },
  (t) => [primaryKey({ columns: [t.parentAId, t.parentBId, t.childId] })],
);

export const FISHING_TACKLE_TYPES = ["bait", "lure"] as const;
export const BAIT_WATERS = ["any", "ocean", "special"] as const;

/**
 * Baits (used up on the Bait Rod) and lures (kept, on the Lure Rod). Both are items; this says how
 * they are used for fishing.
 */
export const fishingTackle = sqliteTable(
  "fishing_tackle",
  {
    /** The item. */
    itemId: text()
      .primaryKey()
      .references(() => items.id),
    /** Bait or lure. */
    type: text({ enum: FISHING_TACKLE_TYPES }).notNull(),
    /** Baits: where they work (any water, the ocean, or one special spot); NULL for lures. */
    water: text({ enum: BAIT_WATERS }),
  },
  (t) => [
    oneOf("fishing_tackle_type", t.type, FISHING_TACKLE_TYPES),
    oneOf("fishing_tackle_water", t.water, BAIT_WATERS),
    check("fishing_tackle_water_for_bait", sql`(${t.water} IS NOT NULL) = (${t.type} = 'bait')`),
  ],
);

/** Which fish a bait or lure attracts. */
export const fishingTackleFish = sqliteTable(
  "fishing_tackle_fish",
  {
    /** The bait or lure. */
    itemId: text()
      .notNull()
      .references(() => fishingTackle.itemId),
    /** A fish that likes it. */
    fishId: text()
      .notNull()
      .references(() => fish.id),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.fishId] })],
);

export const FISH_STATS = [
  "boost",
  "endurance",
  "strength",
  "tenacity",
  "stamina",
  "weight",
  "gender",
] as const;
export const STAT_CHANGES = ["raise", "lower", "switch"] as const;

/** What feeding a bait to an aquarium fish does to it (Battan: raises tenacity; Carrot: switches gender). */
export const fishFeedEffects = sqliteTable(
  "fish_feed_effects",
  {
    /** The bait. */
    itemId: text()
      .notNull()
      .references(() => fishingTackle.itemId),
    /** The fish stat it changes. */
    stat: text({ enum: FISH_STATS }).notNull(),
    /** How: raises it, lowers it, or switches it (gender). */
    change: text({ enum: STAT_CHANGES }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.stat] }),
    oneOf("fish_feed_effects_stat", t.stat, FISH_STATS),
    oneOf("fish_feed_effects_change", t.change, STAT_CHANGES),
  ],
);

/** The fishing rod's stats, upgraded with FP (Flight, Strength, Resilience, Grip, Luck). */
export const fishingRodStats = sqliteTable(
  "fishing_rod_stats",
  {
    /** Id from the name ("resilience"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** What it does ("how far you can cast the line, in meters"). */
    description: text(),
    /** Its value on a new rod. */
    startValue: integer().notNull(),
    /** FP one point of it costs. */
    fpPerPoint: integer().notNull(),
  },
  (t) => [
    slugCheck("fishing_rod_stats_id", t.id),
    inRange("fishing_rod_stats_start_value", t.startValue, 0),
    inRange("fishing_rod_stats_fp_per_point", t.fpPerPoint, 1),
  ],
);

export const FISHING_CONTEST_TYPES = ["catch", "race"] as const;

/**
 * Fishing contests: the Fishing Contest (weigh in your biggest catches) and Finny Frenzy (race your
 * fish). They take turns, each running for a while every so many days.
 */
export const fishingContests = sqliteTable(
  "fishing_contests",
  {
    /** Id from the name ("finny-frenzy"). */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** Weigh-in contest or fish race. */
    type: text({ enum: FISHING_CONTEST_TYPES }).notNull(),
    /** The town it is held in. */
    townId: text().references(() => towns.id),
    /** How often it comes round, in in-game days. */
    intervalDays: integer(),
    /** How long it runs, in in-game hours. */
    durationHours: integer(),
    ...availability(),
  },
  (t) => [
    slugCheck("fishing_contests_id", t.id),
    oneOf("fishing_contests_type", t.type, FISHING_CONTEST_TYPES),
    inRange("fishing_contests_interval_days", t.intervalDays, 1),
    inRange("fishing_contests_duration_hours", t.durationHours, 1),
  ],
);

/** The classes of a contest (Beginner, Junior, Senior, Master), easiest first. */
export const fishingContestClasses = sqliteTable("fishing_contest_classes", {
  /** Integer id: class names repeat across contests. */
  id: integer().primaryKey(),
  /** The contest. */
  contestId: text()
    .notNull()
    .references(() => fishingContests.id),
  /** Name as the game shows it ("Beginner"). */
  name: text().notNull(),
  /** Order of the classes, easiest first. */
  position: integer().notNull(),
});

export const PRIZE_SETS = ["first-win", "pool"] as const;

/**
 * What a contest (or one of its classes) gives for a placing: a fixed prize the first time you win
 * it, then one prize from a pool each time after.
 */
export const fishingContestPrizes = sqliteTable(
  "fishing_contest_prizes",
  {
    /** Integer id: a prize has no name of its own. */
    id: integer().primaryKey(),
    /** The contest. */
    contestId: text()
      .notNull()
      .references(() => fishingContests.id),
    /** The class, for contests that have classes. */
    classId: integer().references(() => fishingContestClasses.id),
    /** The placing it is for (1 = first place). */
    place: integer().notNull(),
    /** Whether it is the first-win prize or one of the pool. */
    prizeSet: text({ enum: PRIZE_SETS }).notNull(),
    ...reward(),
  },
  (t) => [
    oneOf("fishing_contest_prizes_prize_set", t.prizeSet, PRIZE_SETS),
    inRange("fishing_contest_prizes_place", t.place, 1),
    ...rewardChecks("fishing_contest_prizes", t),
  ],
);

// ─── Trophies (PS4) ───────────────────────────────────────────────────────────────────────────────

export const TROPHY_TIERS = ["bronze", "silver", "gold", "platinum"] as const;

/**
 * PS4 trophies. Where a trophy is about one thing, it links to it; "all of X" trophies (every
 * invention, every medal) are worked out from the other tables.
 */
export const trophies = sqliteTable(
  "trophies",
  {
    /** Id from the name. */
    id: text().primaryKey(),
    /** Name as the game shows it. */
    name: text().notNull().unique(),
    /** Bronze, silver, gold or platinum. */
    tier: text({ enum: TROPHY_TIERS }).notNull(),
    /** What it takes, as the game describes it. */
    description: text().notNull(),
    /** Order in the game's trophy list. */
    position: integer().notNull(),
    /** For "Complete chapter N": the chapter. */
    chapterNumber: integer().references(() => chapters.number),
    /** For defeating an enemy: the enemy. */
    enemyId: text().references(() => enemies.id),
    /** For catching a fish: the fish. */
    fishId: text().references(() => fish.id),
    /** For buying a core: the core. */
    ridepodCoreId: text().references(() => ridepodCores.id),
    /** For winning a contest class: the class. */
    contestClassId: integer().references(() => fishingContestClasses.id),
    /** For reaching an album level: the level. */
    photoLevel: integer().references(() => photoLevels.level),
  },
  (t) => [slugCheck("trophies_id", t.id), oneOf("trophies_tier", t.tier, TROPHY_TIERS)],
);

/** Weapons a trophy asks for (Island King, Five-Star Armlet, LEGEND, Supernova). */
export const trophyWeapons = sqliteTable(
  "trophy_weapons",
  {
    /** The trophy. */
    trophyId: text()
      .notNull()
      .references(() => trophies.id),
    /** A weapon it asks for. */
    weaponId: text()
      .notNull()
      .references(() => weapons.id),
  },
  (t) => [primaryKey({ columns: [t.trophyId, t.weaponId] })],
);
