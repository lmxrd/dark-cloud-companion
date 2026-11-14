import { STAT_KEYS } from "@/lib/schemas";
import { synthSources, type SynthSource } from "./sources";

/**
 * Which bought items may be synthed: `cheap` = the everyday items worth +2 to a stat (as the weapon
 * guide's recipes use), `crystals` = those plus the crystals, `all` = anything sold, gems included.
 */
export type ItemPool = "cheap" | "crystals" | "all";
/** The everyday +2 items: Conda's Goods (Scrap of Metal, the 20-gilda goods) and Antidote Drink for Scale, as in the weapon guide. */
const CHEAP_PRICE = 40;

export interface ItemFilter {
  /** Only items sold by this chapter (shop-sold items only unless `allowFound`). */
  maxChapter: number;
  /** Also allow items that are never sold (dungeon drops etc.). Treated as free. */
  allowFound?: boolean;
  /** Default `all`. */
  pool?: ItemPool;
}

const statGains = (s: SynthSource) => STAT_KEYS.map((k) => s.gains[k] ?? 0);
const hasStatGain = (s: SynthSource) => statGains(s).some((g) => g > 0);
const inPool = (s: SynthSource, pool: ItemPool) =>
  pool === "all" ||
  (Math.max(...statGains(s)) <= 2 && (s.price ?? 0) <= CHEAP_PRICE) ||
  (pool === "crystals" && s.name.endsWith("Crystal"));

/** Items that can be synthed at this point, with dominated ones removed (never worse in any stat, never cheaper). */
export function itemCandidates(filter: ItemFilter): SynthSource[] {
  const kind = filter.pool ?? "all";
  const pool = synthSources.filter((s) => {
    if (!hasStatGain(s)) return false;
    if (!inPool(s, kind)) return false;
    if (s.price !== undefined) return (s.fromChapter ?? 1) <= filter.maxChapter;
    return !!filter.allowFound && !/^(Moon|Sun) Stone$/.test(s.name);
  });
  const price = (s: SynthSource) => s.price ?? 0;
  return pool.filter((a, i) => {
    const ga = statGains(a);
    return !pool.some((b, j) => {
      if (i === j) return false;
      const gb = statGains(b);
      const geq = gb.every((g, n) => g >= ga[n]);
      const strictlyBetter = gb.some((g, n) => g > ga[n]) || price(b) < price(a);
      return geq && price(b) <= price(a) && (strictlyBetter || j < i);
    });
  });
}
