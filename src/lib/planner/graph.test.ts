import { describe, expect, test } from "vitest";
import { ancestorsOf, finalWeaponIds, rootWeaponIds } from "./graph";
import { findChains, rankChains, startOptions } from "./plan";
import { getWeapon } from "./sources";
import { freshState } from "@/lib/weapons/mechanics";

describe("finalWeaponIds", () => {
  test("the final weapons sit at the top SP tier at the end of a full build-up line", () => {
    for (const id of finalWeaponIds) {
      const w = getWeapon(id);
      // Flamingo, the best Spheda club, is starred though it sits mid-line.
      if (id !== "flamingo") expect(w.spPerLevel, id).toBe(6);
      // Not every final is a leaf: Griffon Fork builds up into Island King, yet the FAQ lists
      // both as endgame targets. What holds is that a whole line leads into each of them.
      expect(
        [...ancestorsOf(id)].some((a) => rootWeaponIds.has(a)),
        id,
      ).toBe(true);
    }
  });

  test("every type has a starred weapon", () => {
    const types = new Set(finalWeaponIds.map((id) => getWeapon(id).type));
    expect([...types].sort()).toEqual(["armband", "club", "gun", "sword", "wrench"]);
  });

  test("covers the weapon FAQ's endgame targets", () => {
    const names = finalWeaponIds.map((id) => getWeapon(id).name).sort();
    expect(names).toEqual(
      [
        "Island King",
        "Love",
        "Grade Zero",
        "LEGEND",
        "Supernova",
        "Last Resort",
        "Sigma Bazooka",
        "Dark Cloud",
        "Griffon Fork",
        "Five-Star Armlet",
        "Flamingo",
      ].sort(),
    );
  });
});

describe("rankChains", () => {
  const starts = startOptions("island-king", 8).map((o) => ({
    state: freshState(getWeapon(o.weaponId)),
  }));

  test("each start's chains go longest first, and the starts take turns", () => {
    const pairs = rankChains(starts, "island-king", 8, true);
    expect(pairs.length).toBeLessThanOrEqual(48);
    const firstRound = pairs.slice(0, starts.length).map((p) => p.candidate);
    expect(new Set(firstRound).size).toBe(Math.min(starts.length, pairs.length));
    for (const s of starts) {
      const own = pairs.filter((p) => p.candidate === s).map((p) => p.chain.length);
      expect(own).toEqual([...own].sort((a, b) => b - a));
      const longest = Math.max(
        ...findChains(s.state.weaponId, "island-king", 8).map((c) => c.length),
      );
      if (own.length) expect(own[0]).toBe(longest);
    }
  });

  test("a single start keeps all its chains, longest first", () => {
    const one = starts.slice(0, 1);
    const pairs = rankChains(one, "island-king", 8, false);
    expect(pairs).toHaveLength(findChains(one[0].state.weaponId, "island-king", 8).length);
    const lengths = pairs.map((p) => p.chain.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => b - a));
  });
});
