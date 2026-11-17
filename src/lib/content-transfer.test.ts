import { describe, expect, test } from "vitest";
import { buildContentExport, mergeGuides } from "./content-file";
import { parseContentImport } from "./content-transfer";
import { deriveBuild } from "@/lib/guide/derive";
import { planResultToGuide } from "@/lib/guide/fromPlan";
import type { Guide } from "@/lib/guide/types";
import { planPath } from "@/lib/planner/plan";
import { getWeapon } from "@/lib/planner/sources";
import { freshState } from "@/lib/weapons/mechanics";

async function sampleBuildGuide(): Promise<Guide> {
  const start = freshState(getWeapon("battle-wrench"));
  const result = await planPath({
    start,
    targetId: "drill-wrench",
    objective: "abs",
    goal: { kind: "reach" },
    maxChapter: 2,
    spBonus: 1,
  });
  return planResultToGuide({ id: "custom-a", title: "Mine", result, start, spBonus: 1 });
}

function sampleTextGuide(): Guide {
  return {
    id: "route",
    title: "My route",
    kind: "custom",
    steps: [
      {
        id: "s1",
        title: "Photos",
        notes: "Take a picture of the clock.",
        chapterId: "1",
        entries: [
          { kind: "text", id: "i1", text: "Clock" },
          { kind: "item", ref: "photo:night-stalker" },
          { kind: "section", ref: "battle-with-rats" },
        ],
      },
      { id: "s2", title: "Anytime thing", notes: "", entries: [] },
    ],
    createdAt: 1,
    updatedAt: 1,
  };
}

const makeId = (old: string) => `${old}-copy`;

describe("content export/import", () => {
  test("round-trips build guides and text guides", async () => {
    const guide = await sampleBuildGuide();
    expect(deriveBuild(guide).errors).toEqual([]);
    const file = buildContentExport([guide, sampleTextGuide()]);
    const parsed = parseContentImport(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.file.guides.map((g) => g.id)).toEqual(["custom-a", "route"]);
  }, 60000);

  test("only custom guides are exported", () => {
    const file = buildContentExport([
      sampleTextGuide(),
      { ...sampleTextGuide(), id: "b", kind: "builtin" },
    ]);
    expect(file.guides.map((g) => g.id)).toEqual(["route"]);
  });

  test("rejects invalid JSON, wrong files and profile exports", () => {
    expect(parseContentImport("nope")).toMatchObject({ ok: false });
    expect(parseContentImport("{}")).toMatchObject({ ok: false });
    const r = parseContentImport(
      JSON.stringify({ app: "dark-chronicles-companion", version: 2, profiles: [] }),
    );
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toMatch(/profile export/i);
  });

  test("rejects steps pointing at unknown chapters, sections or data items", () => {
    const bad = (mutate: (g: Guide) => void) => {
      const g = sampleTextGuide();
      mutate(g);
      return parseContentImport(JSON.stringify(buildContentExport([g])));
    };
    expect(bad((g) => (g.steps[0].chapterId = "99"))).toMatchObject({ ok: false });
    expect(bad((g) => (g.steps[0].sectionId = "battle-with-rats"))).toMatchObject({ ok: true });
    expect(
      bad((g) => ((g.steps[0].chapterId = "2"), (g.steps[0].sectionId = "battle-with-rats"))),
    ).toMatchObject({ ok: false });
    expect(bad((g) => g.steps[0].entries.push({ kind: "item", ref: "nope" }))).toMatchObject({
      ok: false,
    });
    expect(bad((g) => g.steps[0].entries.push({ kind: "section", ref: "nope" }))).toMatchObject({
      ok: false,
    });
    expect(bad((g) => g.steps.push({ ...g.steps[0] }))).toMatchObject({ ok: false }); // duplicate step id
  });

  test("rejects build guides with unknown weapons or items, or without a start", async () => {
    const guide = await sampleBuildGuide();
    const run = (g: Guide) => parseContentImport(JSON.stringify(buildContentExport([g])));
    const a = structuredClone(guide);
    a.steps[0].build!.weaponId = "not-a-weapon";
    expect(run(a)).toMatchObject({ ok: false });
    const b = structuredClone(guide);
    b.steps[0].build!.synths.push({ kind: "item", name: "Nonexistent Thing", count: 1 });
    expect(run(b)).toMatchObject({ ok: false });
    const { build: _drop, ...noStart } = structuredClone(guide);
    expect(run(noStart as Guide)).toMatchObject({ ok: false });
  }, 60000);
});

describe("mergeGuides", () => {
  test("a guide with a built-in guide's id gets a fresh one", () => {
    const g = { ...sampleTextGuide(), id: "main" };
    const merged = mergeGuides([], [g], makeId, (id) => id === "main");
    expect(merged.guides.map((x) => x.id)).toEqual(["main-copy"]);
  });

  test("a copy's title stays within the limit", () => {
    const g = sampleTextGuide();
    const long = { ...g, title: "x".repeat(200) };
    const merged = mergeGuides([g], [long], makeId);
    expect(merged.guides[1].title).toHaveLength(200);
    expect(merged.guides[1].title).toMatch(/\(imported\)$/);
  });

  test("adds new, skips identical, copies changed guides with the same id", () => {
    const g = sampleTextGuide();
    const first = mergeGuides([], [g], makeId);
    expect(first.summary).toEqual({ added: 1, copied: 0, skipped: 0 });
    const again = mergeGuides(first.guides, [g], makeId);
    expect(again.summary).toEqual({ added: 0, copied: 0, skipped: 1 });
    const clash = mergeGuides(first.guides, [{ ...g, title: "Edited elsewhere" }], makeId);
    expect(clash.summary).toEqual({ added: 0, copied: 1, skipped: 0 });
    expect(clash.guides.map((x) => x.id)).toEqual(["route", "route-copy"]);
    expect(clash.guides[1].title).toMatch(/\(imported\)$/);
  });

  test("duplicate ids inside one file never produce two guides with the same id", () => {
    const g = sampleTextGuide();
    const merged = mergeGuides([], [g, g, { ...g, title: "Other" }], makeId);
    expect(merged.summary).toEqual({ added: 1, copied: 1, skipped: 1 });
    const ids = merged.guides.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("timestamps alone don't make two copies differ", () => {
    const g = sampleTextGuide();
    expect(mergeGuides([g], [{ ...g, updatedAt: 99 }], makeId).summary.skipped).toBe(1);
  });
});
