import { describe, expect, it } from "vitest";
import { useTranslations } from "@/i18n";
import { core, names } from "@/lib/gamedata";
import { monsters } from "@/lib/gamedata/monsters";
import { dbHref, monsterFormHref, productHref, sectionHref } from "./routes";
import { byId, floorDetail, floors, killRequiredBy, sphedaPrizesOf } from "./data";
import { enemyRows, firstChapter, itemRows, personRows, placeRows } from "./lists";

const t = useTranslations();

describe("database paths", () => {
  it("gives every kind a page under /db and forms one under their class", () => {
    expect(dbHref("item", "treasure-chest-key")).toBe("/db/items/treasure-chest-key");
    expect(dbHref("floor", "frightening-forest")).toBe("/db/floors/frightening-forest");
    expect(monsterFormHref("aquatic", "geron")).toBe("/db/monsters/aquatic/geron");
    expect(productHref({ weaponId: "island-king" })).toBe("/db/weapons/island-king");
  });

  it("sends floors and boss fights to their page, story beats to their chapter", () => {
    const floor = core.sections.find((s) => s.type === "dungeon")!;
    const story = core.sections.find((s) => s.type === "story")!;
    expect(sectionHref(floor)).toBe(`/db/floors/${floor.id}`);
    expect(sectionHref(story)).toBe(`/chapters/${story.chapterNumber}`);
  });

  it("has a page for every floor with detail, and every form's class exists", () => {
    for (const f of floors) expect(floorDetail[f.id], f.id).toBeDefined();
    for (const f of monsters.forms) expect(byId.monsterClass.has(f.classId), f.id).toBe(true);
  });
});

describe("reverse lookups", () => {
  it("knows which build-ups need an enemy killed", () => {
    expect(killRequiredBy.get("arthur")?.map((w) => w.name)).toContain("Chronicle Sword");
  });

  it("collects every Spheda prize per thing", () => {
    const key = sphedaPrizesOf.get("treasure-chest-key") ?? [];
    expect(key.length).toBeGreaterThan(5);
    expect(key.every((p) => ["first", "second", "repeat"].includes(p.tier))).toBe(true);
  });
});

describe("list rows", () => {
  it("lists every item with a tab and the earliest chapter it can be had", () => {
    const rows = itemRows(t);
    expect(rows).toHaveLength(Object.keys(names.items).length);
    const key = rows.find((r) => r.id === "treasure-chest-key")!;
    expect(key.chapter).toBe(1);
    expect(key.price).toBe(500);
    expect(key.sources).toEqual(expect.arrayContaining(["shop", "invention", "spheda"]));
    expect(rows.find((r) => r.id === "fruit-of-eden")!.tab).toBe("usable");
  });

  it("counts an enemy's drops in an item's first chapter", () => {
    // Only dropped: its chapter is the first chapter one of its enemies appears.
    expect(firstChapter({ drops: [{ enemyId: "arthur" }] })).toBe(6);
    expect(firstChapter({})).toBeUndefined();
  });

  it("puts every enemy in its dungeons", () => {
    const arthur = enemyRows().find((e) => e.id === "arthur")!;
    expect(arthur.dungeons).toHaveLength(1);
    expect(arthur.chapter).toBe(6);
  });

  it("gives people their recruit chapter and towns their dungeons", () => {
    expect(personRows().find((p) => p.id === "rufio")!.chapter).toBe(2);
    const palm = placeRows().find((p) => p.id === "palm-brinks")!;
    expect(palm.dungeons.map((d) => d.id)).toContain("underground-channel");
  });
});

describe("tiers", () => {
  it("puts every weapon in a chart column, and never builds up into a lower one", async () => {
    const { weapons } = await import("@/lib/gamedata/weapons");
    const tier = new Map(weapons.weapons.map((w) => [w.id, w.tier]));
    for (const w of weapons.weapons) {
      expect(w.tier, w.id).toBeGreaterThanOrEqual(1);
      expect(w.tier, w.id).toBeLessThanOrEqual(9);
      for (const next of w.buildsInto)
        expect(tier.get(next)!, `${w.id} → ${next}`).toBeGreaterThanOrEqual(w.tier);
    }
    expect(tier.get("holy-daedalus-blade")).toBe(5);
    expect(tier.get("island-king")).toBe(9);
  });

  it("sorts weapons by tier, keeping a line together", async () => {
    const { weaponData } = await import("@/lib/planner/sources");
    const { byTier } = await import("@/lib/weapons/info");
    const swords = weaponData.weapons.filter((w) => w.type === "sword").sort(byTier);
    expect(swords[0].tier).toBe(2);
    expect(swords.at(-1)!.name).toBe("Island King");
    const tiers = swords.map((w) => w.tier!);
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
  });

  it("orders monster forms by evolution stage", async () => {
    const { formsInOrder, stageOf } = await import("@/components/db/pages/MonsterPages");
    expect(formsInOrder("aquatic").map((f) => f.name)).toEqual([
      "Froggy",
      "Geron",
      "Gamal",
      "Moon Goyone",
      "Putos",
      "Mariner",
    ]);
    expect(stageOf("geron")).toEqual({ stage: 2, level: 26 });
  });
});

describe("plan views data", () => {
  it("gives each work step its stats and durability at the start and the end", async () => {
    const { builtinGuideById } = await import("@/lib/guide/builtin");
    const { deriveBuild } = await import("@/lib/guide/derive");
    // Any built-in weapon guide will do.
    const g = [...builtinGuideById.values()].find((x) => x.steps.some((s) => s.build));
    if (!g) throw new Error("no built-in weapon guide");
    const d = deriveBuild(g);
    const work = g.steps.filter((s) => s.build).map((s) => d.steps.get(s.id)!);
    expect(work[0].start).toMatchObject({ level: 0, du: 0 });
    for (const s of work) {
      expect(s.start).toBeDefined();
      expect(s.du).toBeGreaterThanOrEqual(s.start!.du);
      for (const sp of s.spheres) expect(sp.du).toBeGreaterThanOrEqual(0);
    }
  });
});
