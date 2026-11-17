/**
 * Layout of a build-up map: weapons in columns by tier, arrows for build-ups. A layered layout:
 * each column starts in line order (depth first along the build-up lines), a few sweeps reorder
 * every column by the average row of its neighbours (parents going right, children going left), and
 * rows are then placed as near their parents' rows as the column allows, so lines run straight where
 * they can. Pure, so the server and the islands draw the same map.
 */

export interface MapWeapon {
  id: string;
  tier: number;
  /** Weapons it builds up into (others outside the map are ignored). */
  buildsInto: string[];
}

export interface MapLayout {
  /** Column (0 = the lowest tier on the map) and row of each weapon. */
  pos: Map<string, { col: number; row: number }>;
  cols: number;
  rows: number;
  /** The tier of column 0. */
  minTier: number;
  /** Build-ups between weapons on the map. */
  edges: { from: string; to: string }[];
}

export function layoutMap(weapons: MapWeapon[]): MapLayout {
  if (!weapons.length) return { pos: new Map(), cols: 0, rows: 0, minTier: 0, edges: [] };
  const byId = new Map(weapons.map((w) => [w.id, w]));
  const kids = new Map(weapons.map((w) => [w.id, w.buildsInto.filter((c) => byId.has(c))]));
  const parents = new Map<string, string[]>(weapons.map((w) => [w.id, []]));
  for (const w of weapons) for (const c of kids.get(w.id)!) parents.get(c)!.push(w.id);
  const minTier = Math.min(...weapons.map((w) => w.tier));
  const cols = Math.max(...weapons.map((w) => w.tier)) - minTier + 1;
  const colOf = (id: string) => byId.get(id)!.tier - minTier;

  // Line order: from each weapon that starts a line (lowest tier first), depth first.
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    order.push(id);
    kids.get(id)!.forEach(visit);
  };
  [...weapons]
    .filter((w) => !parents.get(w.id)!.length)
    .sort((a, b) => a.tier - b.tier)
    .forEach((w) => visit(w.id));
  weapons.forEach((w) => visit(w.id));

  const columns = Array.from({ length: cols }, (_, c) => order.filter((id) => colOf(id) === c));
  const y = new Map<string, number>();
  const index = () => columns.forEach((col) => col.forEach((id, i) => y.set(id, i)));
  const bary = (id: string, nb: Map<string, string[]>) => {
    const ys = nb.get(id)!.map((x) => y.get(x)!);
    return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : undefined;
  };
  index();
  for (let pass = 0; pass < 8; pass++) {
    const nb = pass % 2 === 0 ? parents : kids;
    const seq = columns.map((_, i) => (pass % 2 === 0 ? i : cols - 1 - i));
    for (const c of seq) {
      const key = new Map(columns[c].map((id) => [id, bary(id, nb) ?? y.get(id)!]));
      columns[c].sort((a, b) => key.get(a)! - key.get(b)!);
      columns[c].forEach((id, i) => y.set(id, i));
    }
  }
  // Rows: left to right, each weapon as near its parents' rows as its column allows.
  index();
  for (const col of columns) {
    let prev = -1;
    for (const id of col) {
      const want = bary(id, parents);
      const row = Math.max(prev + 1, Math.round(want ?? prev + 1));
      y.set(id, row);
      prev = row;
    }
  }
  // Drop rows nothing sits in.
  const used = [...new Set(y.values())].sort((a, b) => a - b);
  const pack = new Map(used.map((r, i) => [r, i]));
  const pos = new Map(
    weapons.map((w) => [w.id, { col: colOf(w.id), row: pack.get(y.get(w.id)!)! }]),
  );
  return {
    pos,
    cols,
    rows: used.length,
    minTier,
    edges: weapons.flatMap((w) => kids.get(w.id)!.map((to) => ({ from: w.id, to }))),
  };
}

/** A weapon and everything it can be built from or into, on the given weapons. */
export function familyOf(id: string, weapons: MapWeapon[]): Set<string> {
  const into = new Map(weapons.map((w) => [w.id, w.buildsInto]));
  const from = new Map<string, string[]>();
  for (const w of weapons)
    for (const c of w.buildsInto) from.set(c, [...(from.get(c) ?? []), w.id]);
  const out = new Set([id]);
  const walk = (x: string, g: Map<string, string[]>) => {
    for (const n of g.get(x) ?? [])
      if (!out.has(n)) {
        out.add(n);
        walk(n, g);
      }
  };
  walk(id, into);
  walk(id, from);
  return out;
}
