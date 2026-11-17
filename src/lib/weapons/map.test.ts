import { describe, expect, it } from "vitest";
import { weaponData } from "@/lib/planner/sources";
import { familyOf, layoutMap } from "./map";

const forType = (type: string) =>
  weaponData.weapons
    .filter((w) => w.type === type)
    .map((w) => ({ id: w.id, tier: w.tier!, buildsInto: w.buildsUpTo }));

describe("build-up map layout", () => {
  for (const type of ["sword", "armband", "wrench", "gun", "club"])
    it(`places every ${type} once, by tier, with no two in one spot`, () => {
      const ws = forType(type);
      const { pos, cols, rows, minTier, edges } = layoutMap(ws);
      expect(pos.size).toBe(ws.length);
      const spots = new Set<string>();
      for (const w of ws) {
        const p = pos.get(w.id)!;
        expect(p.col).toBe(w.tier - minTier);
        expect(p.row).toBeLessThan(rows);
        expect(p.col).toBeLessThan(cols);
        spots.add(`${p.col}:${p.row}`);
      }
      expect(spots.size).toBe(ws.length);
      // Every build-up between two of these weapons gets an arrow.
      const ids = new Set(ws.map((w) => w.id));
      expect(edges.length).toBe(ws.flatMap((w) => w.buildsInto.filter((c) => ids.has(c))).length);
    });

  it("runs a line straight across where the column is free", () => {
    const { pos } = layoutMap(forType("sword"));
    // Mardan Sword → Garayan Sword is a line of its own.
    expect(pos.get("garayan-sword")!.row).toBe(pos.get("mardan-sword")!.row);
  });

  it("finds everything a weapon is built from and into", () => {
    const f = familyOf("chronicle-sword", forType("sword"));
    expect(f.has("chronicle-2")).toBe(true);
    expect(f.has("rulers-sword")).toBe(true);
    expect(f.has("baselard")).toBe(true);
    expect(f.has("island-king")).toBe(false);
  });
});
