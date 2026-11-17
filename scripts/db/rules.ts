/**
 * Checks on the game-data database that its tables can't enforce themselves: broken links, and rules
 * that span several rows. Used by `pnpm db:check` (and the build) and by the tests.
 */
import type { DatabaseSync } from "node:sqlite";

/** A rule: a query that returns one row per problem, and how to describe a problem row. */
interface Rule {
  name: string;
  sql: string;
  describe: (row: Record<string, unknown>) => string;
}

const RULES: Rule[] = [
  {
    name: "variant of a variant",
    sql: `SELECT v.id FROM enemies v JOIN enemies m ON m.id = v.variant_of_id WHERE m.variant_of_id IS NOT NULL`,
    describe: (r) => `enemy ${r.id} is a variant of another variant`,
  },
  {
    name: "invention without a main recipe",
    sql: `SELECT i.id FROM inventions i WHERE NOT EXISTS (
            SELECT 1 FROM invention_ideas x WHERE x.invention_id = i.id AND x.recipe = 1)`,
    describe: (r) => `invention ${r.id} has no recipe 1`,
  },
  {
    name: "georama tasks don't add up to 100%",
    sql: `SELECT town_id, SUM(percent) AS total FROM georama_tasks GROUP BY town_id HAVING total <> 100`,
    describe: (r) => `georama tasks of ${r.town_id} add up to ${r.total}%`,
  },
  {
    name: "one-sided opposite abilities",
    sql: `SELECT a.id, a.opposite_id FROM abilities a JOIN abilities b ON b.id = a.opposite_id
          WHERE b.opposite_id IS NOT a.id`,
    describe: (r) => `ability ${r.id} cancels ${r.opposite_id}, but not the other way round`,
  },
  {
    name: "Ridepod part without its details",
    sql: `SELECT p.id, p.type FROM ridepod_parts p WHERE NOT EXISTS (
            SELECT 1 FROM ridepod_weapons w WHERE w.part_id = p.id UNION ALL
            SELECT 1 FROM ridepod_bodies b WHERE b.part_id = p.id UNION ALL
            SELECT 1 FROM ridepod_legs l WHERE l.part_id = p.id UNION ALL
            SELECT 1 FROM ridepod_energy_packs e WHERE e.part_id = p.id)`,
    describe: (r) => `Ridepod part ${r.id} (${r.type}) has no ${r.type} details`,
  },
  {
    name: "evolution across classes",
    sql: `SELECT e.from_id, e.to_id FROM monster_evolutions e
          JOIN monster_forms f ON f.id = e.from_id JOIN monster_forms t ON t.id = e.to_id
          WHERE f.class_id <> t.class_id`,
    describe: (r) => `${r.from_id} evolves into ${r.to_id} of another class`,
  },
  {
    name: "contest prize class from another contest",
    sql: `SELECT p.id FROM fishing_contest_prizes p JOIN fishing_contest_classes c ON c.id = p.class_id
          WHERE c.contest_id <> p.contest_id`,
    describe: (r) => `contest prize ${r.id} names a class of another contest`,
  },
  {
    name: "future area of a future area",
    sql: `SELECT f.id FROM towns f JOIN towns p ON p.id = f.present_town_id WHERE p.era <> 'present'`,
    describe: (r) => `town ${r.id} is the future of a town that isn't in the present`,
  },
  {
    name: "weapon tier",
    sql: `SELECT id, tier FROM weapons WHERE tier NOT BETWEEN 1 AND 9`,
    describe: (r) =>
      `weapon ${r.id} has tier ${r.tier}; tiers run 1 to 9 (the build-up charts' columns)`,
  },
  {
    name: "build-up into a lower tier",
    sql: `SELECT a.id AS fromId, b.id AS toId FROM weapon_build_ups u
          JOIN weapons a ON a.id = u.weapon_id JOIN weapons b ON b.id = u.target_id
          WHERE b.tier < a.tier`,
    describe: (r) => `${r.fromId} builds up into ${r.toId}, which is in a lower tier`,
  },
];

/** Every problem in the database, as readable lines; empty when all is well. */
export function checkDatabase(db: DatabaseSync): string[] {
  const problems: string[] = [];
  const integrity = db.prepare("PRAGMA integrity_check").all() as { integrity_check: string }[];
  for (const row of integrity)
    if (row.integrity_check !== "ok") problems.push(`integrity: ${row.integrity_check}`);
  const links = db.prepare("PRAGMA foreign_key_check").all() as Record<string, unknown>[];
  for (const row of links)
    problems.push(`broken link: ${row.table} row ${row.rowid} → ${row.parent}`);
  for (const rule of RULES)
    for (const row of db.prepare(rule.sql).all() as Record<string, unknown>[])
      problems.push(`${rule.name}: ${rule.describe(row)}`);
  return problems;
}
