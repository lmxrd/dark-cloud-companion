import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { buildGameData, DB_PATH } from "./export.ts";

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const data = buildGameData(db);
const count = (table: string) =>
  (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

/** Every [path, value] pair in a JSON-like value. */
function* walk(value: unknown, path = "$"): Generator<[string, unknown]> {
  yield [path, value];
  if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* walk(v, `${path}[${i}]`);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) yield* walk(v, `${path}.${k}`);
}

/** Which names map an id field points into. */
const REFS: Record<string, keyof typeof data.names> = {
  itemId: "items",
  requiredItemId: "items",
  rewardItemId: "items",
  weaponId: "weapons",
  ridepodPartId: "ridepodParts",
  ridepodCoreId: "ridepodCores",
  enemyId: "enemies",
  variantOfId: "enemies",
  photoId: "photos",
  npcId: "npcs",
  afterRecruitNpcId: "npcs",
  untilRecruitNpcId: "npcs",
  sectionId: "sections",
  afterSectionId: "sections",
  untilSectionId: "sections",
  closedAfterSectionId: "sections",
  toSectionId: "sections",
  townId: "towns",
  presentTownId: "towns",
  homeTownId: "towns",
  dungeonId: "dungeons",
  georamaPartId: "georamaParts",
  relatedGeoramaPartId: "georamaParts",
  requiresGeoramaPartId: "georamaParts",
  fishId: "fish",
  shopId: "shops",
  abilityId: "abilities",
  classId: "monsterClasses",
};

describe("game-data export", () => {
  const { chapterDetails, names, ...files } = data;
  const all = { ...files, chapters: Object.fromEntries(chapterDetails) };

  it("leaves out empty values instead of writing null", () => {
    const nulls = [...walk(all)].filter(([, v]) => v === null).map(([p]) => p);
    expect(nulls).toEqual([]);
  });

  it("exports every row of the main tables", () => {
    expect(data.core.sections).toHaveLength(count("sections"));
    expect(data.collectables.photos).toHaveLength(count("photos"));
    expect(data.collectables.inventions).toHaveLength(count("inventions"));
    expect(data.collectables.pickups).toHaveLength(count("pickups"));
    expect(data.collectables.recruits).toHaveLength(count("recruits"));
    expect(data.items.items).toHaveLength(count("items"));
    expect(data.weapons.weapons).toHaveLength(count("weapons"));
    expect(data.enemies.enemies).toHaveLength(count("enemies"));
    expect(data.ridepod.parts).toHaveLength(count("ridepod_parts"));
    expect(Object.values(Object.fromEntries(chapterDetails)).flatMap(Object.keys)).toHaveLength(
      count("sections"),
    );
  });

  it("only references ids that exist", () => {
    const broken: string[] = [];
    for (const [path, value] of walk(all)) {
      const field = path.slice(path.lastIndexOf(".") + 1);
      const map = REFS[field];
      // `classId` is a contest class (a number) in fishing prizes; only string ids are names.
      if (!map || typeof value !== "string") continue;
      if (!(value in names[map])) broken.push(`${path} = ${value}`);
    }
    expect(broken).toEqual([]);
  });

  it("derives floor totals from the floor's enemies", () => {
    const rats = data.chapterDetails.get(1)!["battle-with-rats"]!;
    const expected = (
      db
        .prepare(
          `SELECT sum(se.count * e.abs) AS abs FROM section_enemies se JOIN enemies e ON e.id = se.enemy_id
           WHERE se.section_id = 'battle-with-rats' AND se.star_area = 0`,
        )
        .get() as { abs: number }
    ).abs;
    expect(rats.totals.abs).toBe(expected);
  });

  it("collects every way to get a weapon", () => {
    const weapon = (id: string) => data.weapons.weapons.find((w) => w.id === id)!;
    expect(weapon("battle-wrench").sources.startingEquipment).toEqual(["max"]);
    expect(weapon("swan").sources.sectionRewards).toEqual([
      { sectionId: "bargas-valley-introducing-spheda", character: "max", quantity: 1 },
    ]);
    expect(weapon("garayan-sword").sources.buildUpFrom).toContain("mardan-sword");
  });
});
