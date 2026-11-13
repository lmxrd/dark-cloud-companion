import { describe, expect, it } from "vitest";
import {
  itemCounts,
  monsterCheckIds,
  monsterClasses,
  monsterProgress,
  ridepod,
  ridepodPartCheckId,
  ridepodProgress,
  sphedaMedals,
  sphedaProgress,
} from "./reference";
import { synthSources } from "./planner/sources";

describe("reference hub counts", () => {
  it("counts every Ridepod part and core", () => {
    const empty = ridepodProgress({});
    expect(empty.done).toBe(0);
    expect(empty.total).toBe(ridepod.parts.length + ridepod.cores.length);
    expect(ridepodProgress({ [ridepodPartCheckId(ridepod.parts[0])]: true }).done).toBe(1);
  });

  it("counts a badge and a mastery per monster class", () => {
    const [badge, mastered] = monsterCheckIds(monsterClasses[0].id);
    expect(monsterProgress({}).total).toBe(monsterClasses.length * 2);
    expect(monsterProgress({ [badge]: true, [mastered]: true }).done).toBe(2);
  });

  it("counts the Spheda medals", () => {
    expect(sphedaMedals.length).toBeGreaterThan(0);
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
