import { describe, expect, it } from "vitest";
import { checklist } from "@/lib/data";
import { chapterCategoryProgress, chapterProgressOfGuides } from "./dashboard";
import { mainWalkthrough } from "./main";

describe("chapterCategoryProgress", () => {
  const guides = [mainWalkthrough];

  it("splits a chapter's collectables and medals by category", () => {
    const cats = chapterCategoryProgress(guides, "c1", {});
    expect(cats.length).toBeGreaterThan(1);
    expect(cats.every((c) => c.done === 0 && c.total > 0)).toBe(true);
    expect(cats.map((c) => c.category)).toContain("scoop");
    expect(cats.map((c) => c.category)).toContain("medal");
    // Every tick of the main walkthrough is a collectable or a medal.
    const total = cats.reduce((n, c) => n + c.total, 0);
    expect(total).toBe(chapterProgressOfGuides(guides, "c1", {}).total);
  });

  it("counts ticked items in their category", () => {
    const scoop = checklist.find((i) => i.chapterId === "c1" && i.category === "scoop")!;
    const cats = chapterCategoryProgress(guides, "c1", { [scoop.id]: true });
    expect(cats.find((c) => c.category === "scoop")!.done).toBe(1);
  });

  it("is empty without switched-on guides", () => {
    expect(chapterCategoryProgress([], "c1", {})).toEqual([]);
  });
});
