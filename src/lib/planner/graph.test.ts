import { describe, expect, test } from "vitest";
import { ancestorsOf, finalWeaponIds, rootWeaponIds } from "./graph";
import { getWeapon } from "./sources";

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
