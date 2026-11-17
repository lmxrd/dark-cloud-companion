import { stageItems, stageNeedsItems } from "@/lib/guide/buildItems";
import { describe, expect, test } from "vitest";
import { builtinGuideById, weaponGuides } from "@/lib/guide/builtin";
import type { Guide } from "@/lib/guide/types";
import { emptyShopping, type Shopping } from "@/lib/profiles";
import {
  addGoal,
  completeGoal,
  georamaParts,
  inventionTickIds,
  inventions,
  itemInfo,
  shoppingList,
  type ShoppingLine,
} from "./shopping";

const findGuide = (id: string): Guide | undefined => builtinGuideById.get(id);
const list = (s: Shopping, chapter = 8) => shoppingList(s, { chapter, findGuide });
const line = (lines: ShoppingLine[], name: string) => lines.find((l) => l.name === name);

describe("shopping data", () => {
  test("loads every invention and Georama part with components", () => {
    expect(inventions.length).toBe(128);
    expect(georamaParts.length).toBeGreaterThan(70);
    expect(georamaParts.every((p) => p.components.length > 0)).toBe(true);
  });

  test("every invention can be ticked on the dashboard (spellings compared loosely)", () => {
    const missing = inventions.filter((i) => inventionTickIds(i.name).length === 0);
    expect(missing.map((i) => i.name)).toEqual([]);
    expect(inventionTickIds("Super-Alloy Body")).toEqual(inventionTickIds("Super Alloy Body"));
  });
});

describe("shoppingList", () => {
  test("sums the same item across goals and subtracts what you have", () => {
    let s = addGoal(emptyShopping(), { kind: "georama", name: "River", qty: 15 });
    s = addGoal(s, { kind: "georama", name: "Grass", qty: 2 });
    s = { ...s, have: { "Water Element": 4 } };
    const l = list(s);
    // River: 1 Water Element each; Grass: 1 Earth + 1 Water each.
    expect(line(l.lines, "Water Element")).toMatchObject({ need: 17, have: 4, buy: 13 });
    expect(line(l.lines, "Earth Element")).toMatchObject({ need: 2, have: 0, buy: 2 });
    expect(line(l.lines, "Water Element")!.sources).toHaveLength(2);
  });

  test("adding the same thing again raises its quantity instead of a second goal", () => {
    let s = addGoal(emptyShopping(), { kind: "invention", name: "Aquarium" });
    s = addGoal(s, { kind: "invention", name: "Aquarium", qty: 2 });
    expect(s.goals).toHaveLength(1);
    expect(s.goals[0]).toMatchObject({ qty: 3 });
  });

  test("groups by the fewest shops and totals the gilda", () => {
    const s = addGoal(emptyShopping(), { kind: "invention", name: "Grenade Launcher" });
    const l = list(s);
    // Gunpowder, Bomb, Rolling Log: Conda's has Gunpowder + Logs (ties with Morton's, wins by name),
    // then Morton's for the Bomb. Two stops instead of three.
    expect(l.stops.map((x) => x.shop)).toEqual(["Conda's Goods", "Morton's Sundries"]);
    expect(l.stops[1].lines.map((x) => x.name)).toEqual(["Bomb"]);
    const expected = l.lines.reduce(
      (n, x) => n + x.buy * (x.info.kind === "buyable" ? x.info.price : 0),
      0,
    );
    expect(l.total).toBe(expected);
    expect(l.left).toBe(3);
  });

  test("a carried line stays visible and costs nothing", () => {
    let s = addGoal(emptyShopping(), { kind: "georama", name: "Log" });
    s = { ...s, have: { "Rolling Log": 99 } };
    const l = list(s);
    expect(l.total).toBe(0);
    expect(l.left).toBe(0);
    expect(l.stops).toHaveLength(1);
    expect(l.stops[0].open).toBe(false);
    expect(l.stops[0].lines[0]).toMatchObject({ need: 8, have: 8, buy: 0 });
  });

  test("invent instead swaps a component for its own recipe", () => {
    let s = addGoal(emptyShopping(), { kind: "invention", name: "Grenade Launcher" });
    const bomb = line(list(s).lines, "Bomb")!;
    expect(bomb.inventable).toBe(true);
    s = { ...s, invent: ["Bomb"] };
    const l = list(s);
    expect(line(l.lines, "Bomb")).toBeUndefined();
    const bombRecipe = inventions.find((i) => i.name === "Bomb")!.components;
    for (const c of bombRecipe) {
      const x = line(l.lines, c.name)!;
      expect(x.sources.some((src) => src.via === "Bomb")).toBe(true);
    }
  });

  test("flags items sold in later chapters and found-only items", () => {
    let s = addGoal(emptyShopping(), { kind: "item", name: "Bandit Coin" });
    s = addGoal(s, { kind: "item", name: "Holy Stone" });
    const early = list(s, 3);
    expect(early.later.map((x) => x.name)).toEqual(["Bandit Coin"]);
    expect(early.found.map((x) => x.name)).toEqual(["Holy Stone"]);
    expect(early.stops).toHaveLength(0);
    expect(early.total).toBe(0);
    expect(list(s, 8).later).toEqual([]);
    expect(itemInfo("Holy Stone").kind).toBe("found");
  });

  test("build goals follow the guide and drop missing steps", () => {
    const g = weaponGuides.find((x) => x.steps.some((st) => st.build?.synths.length))!;
    // Items on the step itself or inside its spheres (the side weapons are made too).
    const step = g.steps.find((st) => stageNeedsItems(st.build))!;
    const s = addGoal(emptyShopping(), {
      kind: "build",
      guideId: g.id,
      stepIds: [step.id, "gone"],
    });
    const l = list(s);
    for (const [name, count] of stageItems(step.build!))
      expect(line(l.lines, name)!.need).toBeGreaterThanOrEqual(count);
    expect(l.missing).toEqual([]);
    const lost = list(
      addGoal(emptyShopping(), { kind: "build", guideId: "nope", stepIds: ["s1"] }),
    );
    expect(lost.missing).toHaveLength(1);
    expect(lost.lines).toEqual([]);
    // The same guide merges its steps into one goal.
    const merged = addGoal(s, { kind: "build", guideId: g.id, stepIds: ["other"] });
    expect(merged.goals).toHaveLength(1);
  });
});

describe("completeGoal", () => {
  test("uses up the items, removes the goal and ticks the invention", () => {
    let s = addGoal(emptyShopping(), { kind: "invention", name: "Aquarium" });
    s = { ...s, have: { "Rolling Log": 7, "Glass Material": 4, "Water Element": 2 } };
    const { shopping, ticks } = completeGoal(s, s.goals[0].id, findGuide);
    expect(shopping.goals).toEqual([]);
    // Aquarium: 5 Rolling Log, 4 Glass Material, 15 Water Element.
    expect(shopping.have).toEqual({ "Rolling Log": 2 });
    expect(ticks).toEqual(inventionTickIds("Aquarium"));
    expect(ticks.length).toBeGreaterThan(0);
  });

  test("ticks the steps of a build goal", () => {
    const g = weaponGuides[0];
    const step = g.steps.find((st) => st.build)!;
    const s = addGoal(emptyShopping(), { kind: "build", guideId: g.id, stepIds: [step.id] });
    expect(completeGoal(s, s.goals[0].id, findGuide).ticks).toEqual([`g:${g.id}:${step.id}`]);
  });
});
