import { describe, expect, it } from "vitest";
import { collectables, names } from "@/lib/gamedata";
import { tick } from "@/lib/gamedata/ticks";
import {
  itemCounts,
  monsterProgress,
  ridepodProgress,
  sphedaMedals,
  sphedaProgress,
} from "./reference";
import { synthSources } from "./planner/sources";

describe("reference hub counts", () => {
  it("counts every Ridepod part and core", () => {
    const parts = Object.keys(names.ridepodParts);
    const empty = ridepodProgress({});
    expect(empty.done).toBe(0);
    expect(empty.total).toBe(parts.length + Object.keys(names.ridepodCores).length);
    expect(ridepodProgress({ [tick.ridepodPart(parts[0])]: true }).done).toBe(1);
  });

  it("counts a badge and a mastery per monster class", () => {
    const classes = collectables.monsterClasses;
    expect(monsterProgress({}).total).toBe(classes.length * 2);
    expect(
      monsterProgress({ [tick.badge(classes[0].id)]: true, [tick.mastered(classes[0].id)]: true })
        .done,
    ).toBe(2);
  });

  it("counts the Spheda medals, chapter 8 included", () => {
    expect(sphedaMedals.length).toBe(119);
    expect(sphedaProgress({ [sphedaMedals[0].id]: true })).toEqual({
      done: 1,
      total: sphedaMedals.length,
    });
  });

  it("splits the synth items into buyable and found-only", () => {
    expect(itemCounts.buyable + itemCounts.found).toBe(synthSources.length);
    expect(itemCounts.found).toBeGreaterThan(0);
  });
});
