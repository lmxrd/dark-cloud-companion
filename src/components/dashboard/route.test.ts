import { describe, expect, it } from "vitest";
import { dashboardPath, parseDashboardPath } from "./route";

const isChapter = (id: string) => ["c1", "c3"].includes(id);

describe("dashboard routes", () => {
  it("reads views and chapters from the path", () => {
    expect(parseDashboardPath("/", "", isChapter)).toEqual({ view: "chapter", chapter: null });
    expect(parseDashboardPath("/overview", "", isChapter)).toEqual({
      view: "overview",
      chapter: null,
    });
    expect(parseDashboardPath("/by-guide/", "", isChapter).view).toBe("byGuide");
    expect(parseDashboardPath("/chapters/c3", "", isChapter)).toEqual({
      view: "chapter",
      chapter: "c3",
    });
  });

  it("accepts the old ?chapter= links and ignores unknown chapters", () => {
    expect(parseDashboardPath("/", "?chapter=c1", isChapter).chapter).toBe("c1");
    expect(parseDashboardPath("/chapters/c9", "", isChapter).chapter).toBeNull();
  });

  it("round-trips", () => {
    for (const r of [
      { view: "chapter", chapter: null },
      { view: "chapter", chapter: "c3" },
      { view: "overview", chapter: null },
      { view: "byGuide", chapter: null },
    ] as const)
      expect(parseDashboardPath(dashboardPath(r), "", isChapter)).toEqual(r);
  });
});
