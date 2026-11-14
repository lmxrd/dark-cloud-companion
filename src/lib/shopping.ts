// Shopping list: derived from the profile's goals (inventions, Georama parts, weapon-build steps, plain items).
// Nothing here is stored; `shoppingList()` recomputes the lines from `profile.shopping` every time.
import { z } from "zod";
import inventionsJson from "@/data/inventions.json";
import georamaJson from "@/data/georama.json";
import itemsJson from "@/data/items.json";
import { checklist } from "@/lib/data";
import type { Guide } from "@/lib/guide/types";
import { stepTickId } from "@/lib/guide/types";
import { georamaPart, invention } from "@/lib/schemas";
import { synthSources } from "@/lib/planner/sources";
import type { Shopping, ShoppingGoal } from "@/lib/profiles";

export { addGoal, type GoalInput } from "./shopping-goals";

export const inventions = z.array(invention).parse(inventionsJson);
export const georamaParts = z
  .object({ parts: z.array(georamaPart) })
  .parse(georamaJson)
  .parts.filter((p) => p.components.length > 0);

const shopItem = z.object({
  name: z.string(),
  price: z.number().int(),
  fromChapter: z.number().int(),
  shops: z.array(z.string()),
});
const shopItems = new Map(
  z
    .array(shopItem)
    .parse(itemsJson)
    .map((i) => [i.name, i]),
);

/** Names differ in spelling between sources ("Super-Alloy Body" / "Super Alloy Body"): compare loosely. */
export const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const inventionByKey = new Map(inventions.map((i) => [nameKey(i.name), i]));
export const findInvention = (name: string) => inventionByKey.get(nameKey(name));
export const georamaPartByName = new Map(georamaParts.map((p) => [p.name, p]));

/** Every item name the list can contain: sold items, synth items and recipe components. */
export const itemNames: string[] = [
  ...new Set([
    ...shopItems.keys(),
    ...synthSources.map((s) => s.name),
    ...inventions.flatMap((i) => i.components.map((c) => c.name)),
    ...georamaParts.flatMap((p) => p.components.map((c) => c.name)),
  ]),
].sort((a, b) => a.localeCompare(b));

export type ItemInfo =
  | { kind: "buyable"; price: number; fromChapter: number; shops: string[] }
  | { kind: "found" };

export function itemInfo(name: string): ItemInfo {
  const s = shopItems.get(name);
  return s
    ? { kind: "buyable", price: s.price, fromChapter: s.fromChapter, shops: s.shops }
    : { kind: "found" };
}

export interface Ingredient {
  name: string;
  qty: number;
}

type FindGuide = (id: string) => Guide | undefined;

/** The build steps a build goal still points at (deleted steps drop out). */
export function goalSteps(goal: Extract<ShoppingGoal, { kind: "build" }>, findGuide: FindGuide) {
  const guide = findGuide(goal.guideId);
  if (!guide) return { guide: undefined, steps: [] };
  const wanted = new Set(goal.stepIds);
  return { guide, steps: guide.steps.filter((s) => wanted.has(s.id) && s.build) };
}

/** What one goal needs, before "invent instead" expansion. `null` when the goal no longer resolves. */
export function goalRecipe(goal: ShoppingGoal, findGuide: FindGuide): Ingredient[] | null {
  if (goal.kind !== "build") {
    if (goal.kind === "item") return [{ name: goal.name, qty: goal.qty }];
    const src =
      goal.kind === "invention" ? findInvention(goal.name) : georamaPartByName.get(goal.name);
    return src ? src.components.map((c) => ({ name: c.name, qty: c.qty * goal.qty })) : null;
  }
  const { steps } = goalSteps(goal, findGuide);
  if (!steps.length) return null;
  const out = new Map<string, number>();
  for (const s of steps)
    for (const x of s.build!.synths)
      if (x.kind === "item") out.set(x.name, (out.get(x.name) ?? 0) + x.count);
  return [...out].map(([name, qty]) => ({ name, qty }));
}

export interface LineSource {
  goalId: string;
  /** Set when the item is needed to invent a component ("via Bomb"). */
  via?: string;
}

/** Expands a recipe into the items to obtain, inventing components listed in `invent`. */
function expand(
  recipe: Ingredient[],
  invent: Set<string>,
  emit: (name: string, qty: number, via?: string) => void,
  via?: string,
  seen: Set<string> = new Set(),
) {
  for (const { name, qty } of recipe) {
    const inv = findInvention(name);
    if (inv && invent.has(inv.name) && !seen.has(name)) {
      const next = new Set(seen).add(name);
      expand(
        inv.components.map((c) => ({ name: c.name, qty: c.qty * qty })),
        invent,
        emit,
        name,
        next,
      );
    } else emit(name, qty, via);
  }
}

export interface ShoppingLine {
  name: string;
  need: number;
  have: number;
  buy: number;
  sources: LineSource[];
  info: ItemInfo;
  /** Sold, but not until a later chapter than the profile's current one. */
  later: boolean;
  /** The item is an invention itself, so it can be invented instead of bought. */
  inventable: boolean;
}

export interface ShopStop {
  shop: string;
  lines: ShoppingLine[];
  /** Gilda still to spend in this shop. */
  gilda: number;
  /** False when everything here is already carried (kept so ticked lines stay visible). */
  open: boolean;
}

export interface ShoppingList {
  lines: ShoppingLine[];
  /** Shops in visiting order: each covers the most remaining items (greedy set cover). */
  stops: ShopStop[];
  later: ShoppingLine[];
  found: ShoppingLine[];
  /** Gilda for everything that can be bought now. */
  total: number;
  /** Lines that still need buying or finding. */
  left: number;
  /** Goals whose invention/part/guide/steps no longer exist. */
  missing: string[];
}

/** Per goal, the leaf items it needs (after "invent instead" expansion). */
function goalNeeds(goal: ShoppingGoal, invent: Set<string>, findGuide: FindGuide) {
  const recipe = goalRecipe(goal, findGuide);
  if (!recipe) return null;
  const out: { name: string; qty: number; via?: string }[] = [];
  expand(recipe, invent, (name, qty, via) => out.push({ name, qty, via }));
  return out;
}

export function shoppingList(
  shopping: Shopping,
  opts: { chapter: number; findGuide: FindGuide },
): ShoppingList {
  const invent = new Set(shopping.invent);
  const need = new Map<string, { qty: number; sources: LineSource[] }>();
  const missing: string[] = [];
  for (const goal of shopping.goals) {
    const needs = goalNeeds(goal, invent, opts.findGuide);
    if (!needs) {
      missing.push(goal.id);
      continue;
    }
    for (const { name, qty, via } of needs) {
      const e = need.get(name) ?? { qty: 0, sources: [] };
      e.qty += qty;
      if (!e.sources.some((s) => s.goalId === goal.id && s.via === via))
        e.sources.push({ goalId: goal.id, via });
      need.set(name, e);
    }
  }

  const lines: ShoppingLine[] = [...need]
    .map(([name, e]) => {
      const info = itemInfo(name);
      const have = Math.min(shopping.have[name] ?? 0, e.qty);
      return {
        name,
        need: e.qty,
        have,
        buy: e.qty - have,
        sources: e.sources,
        info,
        later: info.kind === "buyable" && info.fromChapter > opts.chapter,
        inventable: !!findInvention(name),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const now = lines.filter((l) => l.info.kind === "buyable" && !l.later);
  const shopsOf = (l: ShoppingLine) => (l.info.kind === "buyable" ? l.info.shops : []);

  // Greedy cover over what still needs buying: fewest shops to visit.
  const assigned = new Map<string, string>();
  const order: string[] = [];
  let rest = now.filter((l) => l.buy > 0);
  while (rest.length) {
    const count = new Map<string, number>();
    for (const l of rest) for (const s of shopsOf(l)) count.set(s, (count.get(s) ?? 0) + 1);
    const [best] = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    order.push(best);
    for (const l of rest) if (shopsOf(l).includes(best)) assigned.set(l.name, best);
    rest = rest.filter((l) => !assigned.has(l.name));
  }
  // Lines already carried stay under a shop on the route if possible, otherwise their first shop.
  const done: string[] = [];
  for (const l of now) {
    if (assigned.has(l.name)) continue;
    const s = shopsOf(l).find((x) => order.includes(x)) ?? shopsOf(l)[0];
    assigned.set(l.name, s);
    if (!order.includes(s) && !done.includes(s)) done.push(s);
  }

  const stops: ShopStop[] = [...order, ...done.sort((a, b) => a.localeCompare(b))].map((shop) => {
    const ls = now.filter((l) => assigned.get(l.name) === shop);
    const gilda = ls.reduce(
      (n, l) => n + l.buy * (l.info.kind === "buyable" ? l.info.price : 0),
      0,
    );
    return { shop, lines: ls, gilda, open: order.includes(shop) };
  });

  return {
    lines,
    stops,
    later: lines.filter((l) => l.later),
    found: lines.filter((l) => l.info.kind === "found"),
    total: stops.reduce((n, s) => n + s.gilda, 0),
    left: lines.filter((l) => l.buy > 0).length,
    missing,
  };
}

/** Checklist ids of an invention (to tick it on the dashboard when it is made). */
export const inventionTickIds = (name: string) =>
  checklist
    .filter((i) => i.category === "invention" && nameKey(i.name) === nameKey(name))
    .map((i) => i.id);

/**
 * Marks a goal as made: removes it, uses up the items it needed from the "have" counts, and returns the ticks to
 * set (the invention's checklist id, or the build steps' own ticks).
 */
export function completeGoal(
  s: Shopping,
  goalId: string,
  findGuide: FindGuide,
): { shopping: Shopping; ticks: string[] } {
  const goal = s.goals.find((g) => g.id === goalId);
  if (!goal) return { shopping: s, ticks: [] };
  const have = { ...s.have };
  for (const { name, qty } of goalNeeds(goal, new Set(s.invent), findGuide) ?? []) {
    const left = (have[name] ?? 0) - qty;
    if (left > 0) have[name] = left;
    else delete have[name];
  }
  const ticks =
    goal.kind === "invention"
      ? inventionTickIds(goal.name)
      : goal.kind === "build"
        ? goalSteps(goal, findGuide).steps.map((st) => stepTickId(goal.guideId, st.id))
        : [];
  return { shopping: { ...s, have, goals: s.goals.filter((g) => g.id !== goalId) }, ticks };
}
