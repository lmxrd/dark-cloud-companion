import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { checkDatabase } from "./rules.ts";

const drizzleDir = new URL("../../drizzle/", import.meta.url);

/** A fresh in-memory database built from the migrations in drizzle/. */
function migrated(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files)
    for (const statement of readFileSync(new URL(file, drizzleDir), "utf8").split(
      "--> statement-breakpoint",
    ))
      if (statement.trim()) db.exec(statement);
  return db;
}

/** Table and index definitions, to compare two databases' structure. */
const structure = (db: DatabaseSync) =>
  (
    db
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE '__drizzle%' ORDER BY name",
      )
      .all() as { name: string; sql: string }[]
  ).map((r) => `${r.name}: ${r.sql}`);

describe("game-data database", () => {
  it("builds from the migrations without problems", () => {
    expect(checkDatabase(migrated())).toEqual([]);
  });

  it("the committed game.db is migrated to the latest schema", () => {
    const committed = new DatabaseSync(new URL("game.db", drizzleDir).pathname, { readOnly: true });
    expect(structure(committed)).toEqual(structure(migrated()));
    expect(checkDatabase(committed)).toEqual([]);
  });

  it("rejects typos and broken links", () => {
    const db = migrated();
    db.exec("INSERT INTO chapters VALUES (1, 'To the Outside World')");
    // A value outside its fixed list.
    expect(() =>
      db.exec(
        "INSERT INTO sections (id, chapter_number, position, title, type) VALUES ('a', 1, 1, 'A', 'dungeon-floor')",
      ),
    ).toThrow(/CHECK constraint failed: sections_type/);
    // An id that isn't lowercase-with-dashes.
    expect(() =>
      db.exec(
        "INSERT INTO sections (id, chapter_number, position, title, type) VALUES ('Floor 1', 1, 1, 'A', 'story')",
      ),
    ).toThrow(/CHECK constraint failed: sections_id/);
    // A link to a chapter that doesn't exist.
    expect(() =>
      db.exec(
        "INSERT INTO sections (id, chapter_number, position, title, type) VALUES ('a', 7, 1, 'A', 'story')",
      ),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it("only accepts Ridepod details of the part's own type", () => {
    const db = migrated();
    db.exec(
      "INSERT INTO ridepod_parts (id, name, type, capacity) VALUES ('iron-leg', 'Iron Leg', 'legs', 10)",
    );
    db.exec(
      "INSERT INTO ridepod_legs (part_id, sub_type, speed) VALUES ('iron-leg', 'legs', 'slow')",
    );
    expect(() =>
      db.exec(
        "INSERT INTO ridepod_weapons (part_id, sub_type, tier, weapon_hp, attack) VALUES ('iron-leg', 'drill-arm', 1, 10, 10)",
      ),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it("reports rules that span rows", () => {
    const db = migrated();
    db.exec("INSERT INTO enemies (id, name) VALUES ('mimic', 'Mimic')");
    db.exec(
      "INSERT INTO enemies (id, name, variant_of_id, variant_label) VALUES ('mimic-a', 'Mimic', 'mimic', 'A')",
    );
    db.exec(
      "INSERT INTO enemies (id, name, variant_of_id, variant_label) VALUES ('mimic-b', 'Mimic', 'mimic-a', 'B')",
    );
    db.exec(
      "INSERT INTO ridepod_parts (id, name, type, capacity) VALUES ('drum-can-body', 'Drum Can Body', 'body', 10)",
    );
    expect(checkDatabase(db)).toEqual([
      "variant of a variant: enemy mimic-b is a variant of another variant",
      "Ridepod part without its details: Ridepod part drum-can-body (body) has no body details",
    ]);
  });
});
