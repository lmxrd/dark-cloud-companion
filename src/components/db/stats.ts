import { STAT_KEYS, type StatKey } from "@/lib/schemas";

/** The database column suffix of each stat (`baseFlame`, `synthFlame`, `maxFlame`). */
export const STAT_COLUMN: Record<StatKey, string> = {
  at: "Attack",
  fl: "Flame",
  ch: "Chill",
  li: "Lightning",
  cy: "Cyclone",
  sm: "Smash",
  ex: "Exorcism",
  be: "Beast",
  sc: "Scale",
};

/** A row's stats with a column prefix (`base`, `max`, `synth`). */
export const statsOf = (row: object, prefix: string): Record<StatKey, number> =>
  Object.fromEntries(
    STAT_KEYS.map((k) => [k, (row as Record<string, number>)[`${prefix}${STAT_COLUMN[k]}`] ?? 0]),
  ) as Record<StatKey, number>;

/** The stats a row adds (non-zero only), in stat order. */
export const statGains = (row: object, prefix: string) => {
  const s = statsOf(row, prefix);
  return STAT_KEYS.filter((k) => s[k]).map((key) => ({ key, value: s[key] }));
};
