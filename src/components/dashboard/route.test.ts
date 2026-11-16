import { describe, expect, it } from "vitest";
import { dashboardPath, parseDashboardPath } from "./route";

const isChapter = (id: string) => ["1", "3"].includes(id);

describe("dashboard routes", () => {
  it("reads views and chapters from the path", () => {
    expect(parseDashboardPath("/", isChapter)).toEqual({ view: "chapter", chapter: null });
    expect(parseDashboardPath("/overview", isChapter)).toEqual({
      view: "overview",
      chapter: null,
    });
    expect(parseDashboardPath("/by-guide/", isChapter).view).toBe("byGuide");
    expect(parseDashboardPath("/chapters/3", isChapter)).toEqual({
      view: "chapter",
      chapter: "3",
    });
  });

  it("ignores unknown chapters", () => {
    expect(parseDashboardPath("/chapters/9", isChapter).chapter).toBeNull();
  });

  it("round-trips", () => {
    for (const r of [
      { view: "chapter", chapter: null },
      { view: "chapter", chapter: "3" },
      { view: "overview", chapter: null },
      { view: "byGuide", chapter: null },
    ] as const)
      expect(parseDashboardPath(dashboardPath(r), isChapter)).toEqual(r);
  });
});
