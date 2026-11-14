/**
 * Exports `drizzle/game.db` into the app's data files in `src/gamedata/` (generated, git-ignored).
 * Run by the `gamedata` Astro integration (dev, build, `astro sync`), by the test setup, and by
 * `pnpm db:export`. The shapes are in `src/lib/gamedata/types.ts`.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import type {
  Chapter,
  ChapterDetail,
  Collectables,
  Core,
  Enemies,
  Fishing,
  FloorDetail,
  Georama,
  Items,
  Misc,
  Monsters,
  Names,
  Ridepod,
  Reward,
  Section,
  Shops,
  Sources,
  Weapons,
} from "../../src/lib/gamedata/types.ts";

/** Columns stored as 0/1 that the app reads as booleans. */
const BOOLEANS = new Set([
  "has_georama",
  "optional",
  "has_geostone",
  "star_area",
  "carries_key",
  "missable",
  "only_chance",
  "ghost",
  "attack_varies_by_time",
]);
/** Columns stored as JSON text. */
const JSON_COLUMNS = new Set(["notes"]);

const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

type Out = Record<string, unknown>;

/** Rows as exported: camelCase keys, booleans as booleans, JSON parsed, empty values left out. */
function rowsOf(db: DatabaseSync, sql: string): Out[] {
  return (db.prepare(sql).all() as Record<string, unknown>[]).map((row) => {
    const out: Out = {};
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) continue;
      if (BOOLEANS.has(key)) {
        if (value) out[camel(key)] = true;
        continue;
      }
      out[camel(key)] = JSON_COLUMNS.has(key) ? JSON.parse(String(value)) : value;
    }
    return out;
  });
}

const groupBy = <T extends Out>(rows: T[], key: string): Map<unknown, T[]> => {
  const map = new Map<unknown, T[]>();
  for (const r of rows) {
    const k = r[key];
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return map;
};

const without = <T extends Out>(row: T, ...keys: string[]): T => {
  const copy = { ...row };
  for (const k of keys) delete copy[k];
  return copy;
};

const productKey = (r: Out): string | undefined =>
  r.itemId
    ? `item:${r.itemId}`
    : r.weaponId
      ? `weapon:${r.weaponId}`
      : r.ridepodPartId
        ? `part:${r.ridepodPartId}`
        : r.ridepodCoreId
          ? `core:${r.ridepodCoreId}`
          : undefined;

const productOnly = (r: Out): Reward => {
  const out: Out = { quantity: r.quantity ?? 1 };
  for (const k of ["itemId", "weaponId", "ridepodPartId", "ridepodCoreId"]) if (r[k]) out[k] = r[k];
  return out as unknown as Reward;
};

/** Every way to get each product, keyed by `item:<id>`, `weapon:<id>`, `part:<id>`, `core:<id>`. */
function buildSources(db: DatabaseSync): Map<string, Sources> {
  const sources = new Map<string, Sources>();
  const add = <K extends keyof Sources>(
    key: string | undefined,
    list: K,
    entry: NonNullable<Sources[K]>[number],
  ) => {
    if (!key) return;
    const s = sources.get(key) ?? {};
    ((s[list] ??= [] as never) as unknown[]).push(entry);
    sources.set(key, s);
  };

  for (const r of rowsOf(db, "SELECT * FROM shop_stock ORDER BY shop_id, id"))
    add(
      productKey(r),
      "shops",
      without(r, "id", "itemId", "weaponId", "ridepodPartId", "ridepodCoreId") as never,
    );
  for (const r of rowsOf(db, "SELECT * FROM inventions ORDER BY id"))
    add(productKey(r), "inventions", r.id as string);
  for (const r of rowsOf(db, "SELECT * FROM enemy_drops ORDER BY enemy_id"))
    add(productKey(r), "drops", without(r, "itemId", "chancePercent") as never);
  for (const r of rowsOf(db, "SELECT * FROM pickups ORDER BY id"))
    add(productKey(r), "pickups", r.id as number);
  for (const r of rowsOf(db, "SELECT * FROM dungeon_weapons ORDER BY dungeon_id"))
    add(productKey(r), "dungeons", r.dungeonId as string);
  for (const r of rowsOf(db, "SELECT * FROM section_spheda_prizes ORDER BY id"))
    add(productKey(r), "sphedaPrizes", {
      sectionId: r.sectionId,
      tier: r.tier,
      quantity: r.quantity,
    } as never);
  for (const r of rowsOf(db, "SELECT * FROM section_rewards ORDER BY id"))
    add(
      productKey(r),
      "sectionRewards",
      without(r, "id", "itemId", "weaponId", "ridepodPartId") as never,
    );
  for (const r of rowsOf(db, "SELECT * FROM georama_town_rewards ORDER BY id"))
    add(productKey(r), "georamaRewards", { townId: r.townId, quantity: r.quantity } as never);
  for (const r of rowsOf(db, "SELECT * FROM fishing_contest_prizes ORDER BY id"))
    add(
      productKey(r),
      "contestPrizes",
      without(r, "id", "itemId", "weaponId", "ridepodPartId") as never,
    );
  for (const r of rowsOf(db, "SELECT * FROM monster_class_level_rewards ORDER BY class_id, level"))
    add(productKey(r), "monsterRewards", without(r, "itemId") as never);
  for (const r of rowsOf(
    db,
    "SELECT level, reward_item_id AS item_id FROM photo_levels WHERE reward_item_id IS NOT NULL",
  ))
    add(productKey(r), "photoLevels", r.level as number);
  for (const r of rowsOf(db, "SELECT * FROM starting_equipment ORDER BY id"))
    add(productKey(r), "startingEquipment", r.owner as never);
  for (const r of rowsOf(
    db,
    "SELECT weapon_id AS from_id, target_id AS weapon_id FROM weapon_build_ups",
  ))
    add(productKey(r), "buildUpFrom", r.fromId as string);
  return sources;
}

const namesOf = (db: DatabaseSync, table: string, label = "name"): Record<string, string> =>
  Object.fromEntries(
    (
      db.prepare(`SELECT id, ${label} AS name FROM ${table} ORDER BY id`).all() as {
        id: string;
        name: string;
      }[]
    ).map((r) => [r.id, r.name]),
  );

/** Builds every file's content from the database. */
export function buildGameData(db: DatabaseSync) {
  const sources = buildSources(db);
  const src = (key: string): Sources => sources.get(key) ?? {};

  const names: Names = {
    items: namesOf(db, "items"),
    weapons: namesOf(db, "weapons"),
    ridepodParts: namesOf(db, "ridepod_parts"),
    ridepodCores: namesOf(db, "ridepod_cores"),
    enemies: namesOf(db, "enemies"),
    photos: namesOf(db, "photos"),
    inventions: namesOf(db, "inventions"),
    npcs: namesOf(db, "npcs"),
    sections: namesOf(db, "sections", "title"),
    towns: namesOf(db, "towns"),
    dungeons: namesOf(db, "dungeons"),
    georamaParts: namesOf(db, "georama_parts"),
    fish: namesOf(db, "fish"),
    shops: namesOf(db, "shops"),
    abilities: namesOf(db, "abilities"),
    monsterClasses: namesOf(db, "monster_classes"),
  };

  const firstPrizes = new Map(
    rowsOf(db, "SELECT * FROM section_spheda_prizes WHERE tier = 'first'").map((r) => [
      r.sectionId,
      productOnly(r),
    ]),
  );
  const sections = rowsOf(db, "SELECT * FROM sections ORDER BY chapter_number, position").map(
    (s) => (firstPrizes.has(s.id) ? { ...s, sphedaPrize: firstPrizes.get(s.id) } : s),
  ) as unknown as Section[];
  const core: Core = {
    chapters: rowsOf(db, "SELECT * FROM chapters ORDER BY number") as unknown as Chapter[],
    sections,
    dungeons: rowsOf(db, "SELECT * FROM dungeons ORDER BY position") as never,
    towns: rowsOf(db, "SELECT * FROM towns ORDER BY position") as never,
  };

  const ideas = groupBy(
    rowsOf(db, "SELECT * FROM invention_ideas ORDER BY invention_id, recipe, photo_id"),
    "inventionId",
  );
  const invItems = groupBy(
    rowsOf(db, "SELECT * FROM invention_items ORDER BY invention_id, item_id"),
    "inventionId",
  );
  const requirements = groupBy(
    rowsOf(db, "SELECT * FROM recruit_requirements ORDER BY id"),
    "npcId",
  );
  const goals = groupBy(rowsOf(db, "SELECT * FROM georama_goals ORDER BY id"), "taskId");
  const collectables: Collectables = {
    photos: rowsOf(db, "SELECT * FROM photos ORDER BY chapter_number, id") as never,
    inventions: rowsOf(db, "SELECT * FROM inventions ORDER BY chapter_number, id").map((inv) => {
      const byRecipe = groupBy(ideas.get(inv.id) ?? [], "recipe");
      return {
        ...inv,
        recipes: [...byRecipe.keys()]
          .sort()
          .map((k) => byRecipe.get(k)!.map((i) => i.photoId as string)),
        items: (invItems.get(inv.id) ?? []).map((i) => without(i, "inventionId")),
      };
    }) as never,
    pickups: rowsOf(db, "SELECT * FROM pickups ORDER BY chapter_number, id") as never,
    recruits: rowsOf(db, "SELECT * FROM recruits ORDER BY chapter_number, npc_id").map((r) => ({
      ...r,
      requirements: (requirements.get(r.npcId) ?? []).map((q) => without(q, "id", "npcId")),
    })) as never,
    georamaTasks: rowsOf(db, "SELECT * FROM georama_tasks ORDER BY town_id, position").map((t) => ({
      ...t,
      goals: (goals.get(t.id) ?? []).map((g) => without(g, "taskId")),
    })) as never,
    monsterClasses: rowsOf(
      db,
      "SELECT * FROM monster_classes ORDER BY chapter_number, id",
    ) as never,
    photoLevels: rowsOf(db, "SELECT * FROM photo_levels ORDER BY level") as never,
  };

  // Per-chapter floor detail.
  const floorEnemies = groupBy(
    rowsOf(
      db,
      `SELECT se.*, e.abs, e.gilda, NULLIF(e.type, 'normal') AS type FROM section_enemies se
       JOIN enemies e ON e.id = se.enemy_id
       ORDER BY se.section_id, se.star_area, se.enemy_id`,
    ),
    "sectionId",
  );
  const byTable = (table: string, order = "section_id") =>
    groupBy(rowsOf(db, `SELECT * FROM ${table} ORDER BY ${order}`), "sectionId");
  const georamaItems = byTable("section_georama_items", "section_id, item_id");
  const geostoneParts = byTable("section_geostone_parts", "section_id, georama_part_id");
  const spheda = byTable("section_spheda_prizes", "section_id, id");
  const rewards = byTable("section_rewards", "section_id, id");
  const exits = groupBy(
    rowsOf(db, "SELECT * FROM section_exits ORDER BY from_section_id, type"),
    "fromSectionId",
  );
  const chapterDetails = new Map<number, ChapterDetail>();
  for (const s of sections) {
    const enemies = floorEnemies.get(s.id) ?? [];
    const sum = (key: "abs" | "gilda", star: boolean) =>
      enemies
        .filter((e) => !!e.starArea === star)
        .reduce((n, e) => n + (Number(e[key]) || 0) * Number(e.count), 0);
    const totals: FloorDetail["totals"] = { abs: sum("abs", false), gilda: sum("gilda", false) };
    if (enemies.some((e) => e.starArea)) {
      totals.starAreaAbs = sum("abs", true);
      totals.starAreaGilda = sum("gilda", true);
    }
    const detail: FloorDetail = {
      enemies: enemies.map((e) => without(e, "sectionId", "abs", "gilda")) as never,
      georamaItems: (georamaItems.get(s.id) ?? []).map((r) => r.itemId as string),
      geostoneParts: (geostoneParts.get(s.id) ?? []).map((r) => r.georamaPartId as string),
      sphedaPrizes: Object.fromEntries(
        (spheda.get(s.id) ?? []).map((r) => [r.tier, productOnly(r)]),
      ),
      rewards: (rewards.get(s.id) ?? []).map((r) => ({
        ...productOnly(r),
        ...(r.character ? { character: r.character } : {}),
      })) as never,
      exits: (exits.get(s.id) ?? []).map((r) => ({
        toSectionId: r.toSectionId,
        type: r.type,
      })) as never,
      totals,
    };
    const chapter = chapterDetails.get(s.chapterNumber) ?? {};
    chapter[s.id] = detail;
    chapterDetails.set(s.chapterNumber, chapter);
  }

  const abilitiesOf = groupBy(
    rowsOf(db, "SELECT * FROM weapon_abilities ORDER BY ability_id"),
    "weaponId",
  );
  const buildUps = groupBy(
    rowsOf(db, "SELECT * FROM weapon_build_ups ORDER BY target_id"),
    "weaponId",
  );
  const kills = groupBy(
    rowsOf(db, "SELECT * FROM weapon_kill_requirements ORDER BY enemy_id"),
    "weaponId",
  );
  const weapons: Weapons = {
    weapons: rowsOf(db, "SELECT * FROM weapons ORDER BY character, type, id").map((w) => ({
      ...w,
      abilities: (abilitiesOf.get(w.id) ?? []).map((a) => a.abilityId as string),
      buildsInto: (buildUps.get(w.id) ?? []).map((b) => b.targetId as string),
      killRequirements: (kills.get(w.id) ?? []).map((k) => k.enemyId as string),
      sources: src(`weapon:${w.id}`),
    })) as never,
    abilities: rowsOf(db, "SELECT * FROM abilities ORDER BY id") as never,
    killEnemyChapters: Object.fromEntries(
      (
        db
          .prepare(
            `SELECT k.enemy_id AS id, min(s.chapter_number) AS chapter FROM weapon_kill_requirements k
             JOIN section_enemies se ON se.enemy_id = k.enemy_id JOIN sections s ON s.id = se.section_id
             GROUP BY k.enemy_id`,
          )
          .all() as { id: string; chapter: number }[]
      ).map((r) => [r.id, r.chapter]),
    ),
  };

  const effects = groupBy(rowsOf(db, "SELECT * FROM item_effects ORDER BY item_id, id"), "itemId");
  const items: Items = {
    items: rowsOf(db, "SELECT * FROM items ORDER BY name").map((i) => ({
      ...i,
      effects: (effects.get(i.id) ?? []).map((e) => without(e, "id", "itemId")),
      sources: src(`item:${i.id}`),
    })) as never,
  };

  const drops = groupBy(
    rowsOf(db, "SELECT * FROM enemy_drops ORDER BY enemy_id, item_id"),
    "enemyId",
  );
  const appearances = groupBy(
    rowsOf(
      db,
      `SELECT se.enemy_id, se.section_id, se.count, se.star_area FROM section_enemies se
       JOIN sections s ON s.id = se.section_id ORDER BY s.chapter_number, s.position`,
    ),
    "enemyId",
  );
  const enemies: Enemies = {
    enemies: rowsOf(db, "SELECT * FROM enemies ORDER BY name, id").map((e) => ({
      ...e,
      drops: (drops.get(e.id) ?? []).map((d) => without(d, "enemyId")),
      sections: (appearances.get(e.id) ?? []).map((a) => without(a, "enemyId")),
    })) as never,
  };

  const stock = groupBy(rowsOf(db, "SELECT * FROM shop_stock ORDER BY shop_id, id"), "shopId");
  const shops: Shops = {
    shops: rowsOf(db, "SELECT * FROM shops ORDER BY id").map((s) => ({
      ...s,
      stock: (stock.get(s.id) ?? []).map((r) => without(r, "shopId")),
    })) as never,
  };

  const detailOf = (table: string) =>
    new Map(
      rowsOf(db, `SELECT * FROM ${table}`).map((r) => [r.partId, without(r, "partId", "partType")]),
    );
  const partWeapons = detailOf("ridepod_weapons");
  const bodies = detailOf("ridepod_bodies");
  const legs = detailOf("ridepod_legs");
  const packs = detailOf("ridepod_energy_packs");
  const ridepod: Ridepod = {
    parts: rowsOf(db, "SELECT * FROM ridepod_parts ORDER BY type, id").map((p) => ({
      ...p,
      ...(partWeapons.has(p.id) ? { weapon: partWeapons.get(p.id) } : {}),
      ...(bodies.has(p.id) ? { body: bodies.get(p.id) } : {}),
      ...(legs.has(p.id) ? { legs: legs.get(p.id) } : {}),
      ...(packs.has(p.id) ? { energyPack: packs.get(p.id) } : {}),
      sources: src(`part:${p.id}`),
    })) as never,
    cores: rowsOf(db, "SELECT * FROM ridepod_cores ORDER BY position").map((c) => ({
      ...c,
      sources: src(`core:${c.id}`),
    })) as never,
    shieldKitCosts: rowsOf(db, "SELECT * FROM shield_kit_costs ORDER BY purchase") as never,
  };

  const partItems = groupBy(
    rowsOf(db, "SELECT * FROM georama_part_items ORDER BY georama_part_id, item_id"),
    "georamaPartId",
  );
  const georama: Georama = {
    parts: rowsOf(db, "SELECT * FROM georama_parts ORDER BY id").map((p) => ({
      ...p,
      items: (partItems.get(p.id) ?? []).map((i) => without(i, "georamaPartId")),
    })) as never,
    townParts: rowsOf(
      db,
      "SELECT * FROM georama_town_parts ORDER BY town_id, georama_part_id",
    ) as never,
    startingParts: rowsOf(
      db,
      "SELECT * FROM georama_starting_parts ORDER BY town_id, georama_part_id",
    ) as never,
    townRewards: rowsOf(db, "SELECT * FROM georama_town_rewards ORDER BY town_id, id") as never,
    housingRequirements: rowsOf(
      db,
      "SELECT * FROM npc_housing_requirements ORDER BY npc_id, id",
    ) as never,
  };

  const evolutions = groupBy(
    rowsOf(db, "SELECT * FROM monster_evolutions ORDER BY from_id, level, to_id"),
    "fromId",
  );
  const monsters: Monsters = {
    forms: rowsOf(db, "SELECT * FROM monster_forms ORDER BY class_id, attack").map((f) => ({
      ...f,
      evolvesInto: (evolutions.get(f.id) ?? []).map((e) => without(e, "fromId")),
    })) as never,
    unlocks: rowsOf(db, "SELECT * FROM monster_class_unlocks ORDER BY class_id, id") as never,
    levelRewards: rowsOf(
      db,
      "SELECT * FROM monster_class_level_rewards ORDER BY class_id, level",
    ) as never,
  };

  const habitats = groupBy(
    rowsOf(db, "SELECT * FROM fish_habitats ORDER BY fish_id, id"),
    "fishId",
  );
  const tackleFish = groupBy(
    rowsOf(db, "SELECT * FROM fishing_tackle_fish ORDER BY fish_id, item_id"),
    "fishId",
  );
  const classes = groupBy(
    rowsOf(db, "SELECT * FROM fishing_contest_classes ORDER BY contest_id, position"),
    "contestId",
  );
  const prizes = groupBy(
    rowsOf(db, "SELECT * FROM fishing_contest_prizes ORDER BY contest_id, class_id, place, id"),
    "contestId",
  );
  const fishing: Fishing = {
    fish: rowsOf(db, "SELECT * FROM fish ORDER BY name").map((f) => ({
      ...f,
      habitats: (habitats.get(f.id) ?? []).map((h) => without(h, "id", "fishId")),
      tackle: (tackleFish.get(f.id) ?? []).map((t) => t.itemId as string),
    })) as never,
    breeding: rowsOf(
      db,
      "SELECT * FROM fish_breeding ORDER BY parent_a_id, parent_b_id, child_id",
    ) as never,
    tackle: rowsOf(db, "SELECT * FROM fishing_tackle ORDER BY type, item_id") as never,
    feedEffects: rowsOf(db, "SELECT * FROM fish_feed_effects ORDER BY item_id, stat") as never,
    rodStats: rowsOf(db, "SELECT * FROM fishing_rod_stats ORDER BY rowid") as never,
    contests: rowsOf(db, "SELECT * FROM fishing_contests ORDER BY from_chapter_number").map(
      (c) => ({
        ...c,
        classes: (classes.get(c.id) ?? []).map((k) => without(k, "contestId")),
        prizes: (prizes.get(c.id) ?? []).map((p) => without(p, "contestId")),
      }),
    ) as never,
  };

  const trophyWeapons = groupBy(
    rowsOf(db, "SELECT * FROM trophy_weapons ORDER BY weapon_id"),
    "trophyId",
  );
  const skills = groupBy(rowsOf(db, "SELECT * FROM npc_skills ORDER BY npc_id, id"), "npcId");
  const misc: Misc = {
    trophies: rowsOf(db, "SELECT * FROM trophies ORDER BY position").map((t) => {
      const ws = (trophyWeapons.get(t.id) ?? []).map((w) => w.weaponId as string);
      return ws.length ? { ...t, weapons: ws } : t;
    }) as never,
    npcs: rowsOf(db, "SELECT * FROM npcs ORDER BY name").map((n) => ({
      ...n,
      skills: (skills.get(n.id) ?? []).map((s) => without(s, "npcId")),
    })) as never,
  };

  return {
    names,
    core,
    collectables,
    chapterDetails,
    weapons,
    items,
    enemies,
    shops,
    ridepod,
    georama,
    monsters,
    fishing,
    misc,
  };
}

export type GameData = ReturnType<typeof buildGameData>;

/** Writes the files into `outDir`, replacing what was there. Returns the paths written. */
export function writeGameData(data: GameData, outDir: string): string[] {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, "chapter"), { recursive: true });
  const written: string[] = [];
  const write = (file: string, value: unknown) => {
    const path = join(outDir, file);
    writeFileSync(path, JSON.stringify(value));
    written.push(path);
  };
  const { chapterDetails, ...files } = data;
  for (const [name, value] of Object.entries(files)) write(`${name}.json`, value);
  for (const [number, detail] of chapterDetails) write(`chapter/${number}.json`, detail);
  return written;
}

export const DB_PATH = new URL("../../drizzle/game.db", import.meta.url).pathname;
export const OUT_DIR = new URL("../../src/gamedata/", import.meta.url).pathname;

/** Exports `drizzle/game.db` into `src/gamedata/`. */
export function exportGameData(dbPath = DB_PATH, outDir = OUT_DIR): string[] {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return writeGameData(buildGameData(db), outDir);
  } finally {
    db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const written = exportGameData();
  const bytes = written.reduce((n, p) => n + readFileSync(p).length, 0);
  console.log(`game data: ${written.length} files, ${Math.round(bytes / 1024)} KB in ${OUT_DIR}`);
}
