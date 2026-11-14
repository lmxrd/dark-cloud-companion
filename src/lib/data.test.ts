import { expect, test } from "vitest";
import {
  allMedals,
  chapterProgress,
  chapters,
  checklist,
  inventionReady,
  medalItems,
  sections,
} from "./data";

test("eight chapters; chapter 8 is the postgame", () => {
  expect(chapters.map((c) => c.id)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  expect(chapters.filter((c) => c.phase === "postgame").map((c) => c.id)).toEqual(["8"]);
});

test("tick ids are unique", () => {
  const ids = [...checklist.map((i) => i.id), ...allMedals.map((m) => m.id)];
  expect(new Set(ids).size).toBe(ids.length);
});

test("medal items come from section data", () => {
  const s = sections.find((x) => x.id === "battle-with-rats")!;
  expect(medalItems(s).map((m) => m.kind)).toEqual(["time-attack", "clear-goal", "spheda"]);
  expect(medalItems(s).find((m) => m.kind === "spheda")!.value).toBe("Diamond");
});

test("invention readiness follows photo ticks", () => {
  const inv = checklist.find((i) => i.category === "invention" && i.chapterId === "1")!;
  expect(inventionReady(inv, {})).toBe(false);
  const all: Record<string, true> = Object.fromEntries(checklist.map((i) => [i.id, true as const]));
  expect(inventionReady(inv, all)).toBe(true);
});

test("chapter progress counts checked ids", () => {
  const first = checklist.find((i) => i.chapterId === "1")!;
  expect(chapterProgress("1", { [first.id]: true }).done).toBe(1);
  expect(chapterProgress("1", {}).total).toBeGreaterThan(80);
});
