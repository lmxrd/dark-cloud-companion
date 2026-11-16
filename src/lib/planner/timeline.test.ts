import { describe, expect, it } from "vitest";
import { core } from "@/lib/gamedata";
import { placeStages, storyGilda } from "./timeline";

const index = (id: string) => core.sections.findIndex((s) => s.id === id);
const absThrough = (id: string) =>
  core.sections.slice(0, index(id) + 1).reduce((n, s) => n + (s.abs ?? 0), 0);

describe("placing plan stages on the story", () => {
  it("story flow waits until the floors have paid for a stage", () => {
    const need = absThrough("ghost-in-the-channel");
    const [placed] = placeStages([{ abs: need, gilda: 0 }], [0], undefined, "story");
    expect(placed.sectionId).toBe("ghost-in-the-channel");
    expect(placed.grindAbs).toBe(0);
  });

  it("earliest flow does a stage as soon as it is unlocked and grinds the rest", () => {
    const [placed] = placeStages([{ abs: 1000, gilda: 0 }], [0], undefined, "earliest");
    expect(placed.sectionId).toBe(core.sections[0].id);
    expect(placed.grindAbs).toBe(1000 - (core.sections[0].abs ?? 0));
  });

  it("a later stage never comes before an earlier one, and waits for its unlock", () => {
    const unlock = index("battle-with-rats");
    const placed = placeStages(
      [
        { abs: 0, gilda: 0 },
        { abs: 0, gilda: 0 },
      ],
      [unlock, 0],
      undefined,
      "story",
    );
    expect(placed.map((p) => p.sectionId)).toEqual(["battle-with-rats", "battle-with-rats"]);
  });

  it("a stage with the solver's chapter is done in that chapter: not before, and not after", () => {
    const free = { abs: 0, gilda: 0 };
    const [early] = placeStages([free], [0], undefined, "story", [5]);
    expect(core.sections[index(early.sectionId)].chapterNumber).toBe(5);
    // Too costly for the story by then: still that chapter, the rest is ground.
    const [late] = placeStages([{ abs: 1e9, gilda: 0 }], [0], undefined, "story", [3]);
    expect(late.chapter).toBe(3);
    expect(late.grindAbs).toBeGreaterThan(0);
  });

  it("gilda the story hasn't paid yet has to be farmed in the earliest flow", () => {
    const [placed] = placeStages([{ abs: 0, gilda: 1_000_000 }], [0], undefined, "earliest");
    expect(placed.grindGilda).toBe(1_000_000 - (core.sections[0].gilda ?? 0));
    expect(storyGilda(8)).toBeGreaterThan(storyGilda(1));
  });
});

describe("kill requirements on the story", () => {
  it("an enemy met again later (two entries with one name) counts from its first meeting", async () => {
    const { getWeapon } = await import("./sources");
    const { stageUnlockIndex } = await import("./timeline");
    // Griffon Fork needs Miss Gourgon, met in chapter 7 and again in chapter 8.
    const at = stageUnlockIndex(
      { weaponId: "dark-excalibur", levelTo: 0, synths: [] },
      { weaponId: "griffon-fork", levelTo: 0, synths: [] },
      (w) => getWeapon(w).requiresKills,
    );
    expect(core.sections[at].chapterNumber).toBe(7);
  });
});
