import { describe, expect, it, test } from "vitest";
import { useTranslations } from "@/i18n";
import { activeChild, crumbsFor, isSectionActive, mainNav } from "./nav";

const t = useTranslations();

describe("crumbsFor", () => {
  it("names the dashboard", () => {
    expect(crumbsFor(t, "/")).toEqual([{ label: "Dashboard" }]);
  });

  it("puts the database before its lists", () => {
    expect(crumbsFor(t, "/db/items")).toEqual([
      { label: "Database", href: "/db" },
      { label: "Items" },
    ]);
  });

  it("shows the full path to a weapon", () => {
    expect(crumbsFor(t, "/db/weapons/poison-wrench/", "Poison Wrench")).toEqual([
      { label: "Database", href: "/db" },
      { label: "Weapons", href: "/db/weapons" },
      { label: "Poison Wrench" },
    ]);
  });

  it("puts a page under its list, with any parents between", () => {
    expect(crumbsFor(t, "/db/floors/to-the-outside-world", "To the Outside World")).toEqual([
      { label: "Database", href: "/db" },
      { label: "Places", href: "/db/places" },
      { label: "To the Outside World" },
    ]);
    const cls = { label: "Aquatic", href: "/db/monsters/aquatic" };
    expect(crumbsFor(t, "/db/monsters/aquatic/geron", "Geron", [cls])).toEqual([
      { label: "Database", href: "/db" },
      { label: "Monsters", href: "/db/monsters" },
      cls,
      { label: "Geron" },
    ]);
  });

  it("links a guide back to the guide list", () => {
    expect(crumbsFor(t, "/guides/view")).toEqual([
      { label: "Guides", href: "/guides" },
      { label: "Guide" },
    ]);
  });

  it("gives top-level pages a single crumb", () => {
    expect(crumbsFor(t, "/db")).toEqual([{ label: "Database" }]);
    expect(crumbsFor(t, "/tools/planner")).toEqual([
      { label: "Tools", href: "/tools" },
      { label: "Planner" },
    ]);
  });
});

describe("mainNav", () => {
  const [today, guides, tools, reference] = mainNav(t);

  it("has the four main sections; planner, shopping list and calculator are tools", () => {
    expect([today, guides, tools, reference].map((i) => i.title)).toEqual([
      "Dashboard",
      "Guides",
      "Tools",
      "Database",
    ]);
    expect(tools.children!.map((c) => c.href)).toEqual([
      "/tools/planner",
      "/tools/shopping",
      "/tools/spheres",
    ]);
    for (const path of ["/tools", "/tools/planner", "/tools/planner/editor", "/tools/spheres"])
      expect(isSectionActive(tools, path)).toBe(true);
  });

  it("marks the database active on its home and every page under it", () => {
    for (const path of [
      "/db",
      "/db/weapons",
      "/db/weapons/poison-wrench",
      "/db/spheda",
      "/db/floors/to-the-outside-world",
      "/db/monsters/aquatic/geron",
    ])
      expect(isSectionActive(reference, path)).toBe(true);
    expect(isSectionActive(reference, "/")).toBe(false);
    expect(isSectionActive(today, "/db/weapons")).toBe(false);
  });
});

describe("activeChild", () => {
  const [, guides, , reference] = mainNav(t);

  test("marks only the most specific sub-item", () => {
    expect(activeChild(guides, "/guides", "")).toBe("/guides");
    expect(activeChild(reference, "/db/weapons/poison-wrench", "")).toBe("/db/weapons");
    expect(activeChild(reference, "/db/towns/palm-brinks", "")).toBe("/db/places");
    expect(activeChild(reference, "/db/photos/clock", "")).toBe("/db/inventions");
  });

  test("a sub-item with a query needs a matching query", () => {
    expect(activeChild(guides, "/guides/view", "?id=main")).toBe("/guides/view?id=main");
    // Another guide: neither "Main walkthrough" nor "My guides" (the section stays active).
    expect(activeChild(guides, "/guides/view", "?id=grade-zero-max-abs")).toBeUndefined();
    expect(isSectionActive(guides, "/guides/view")).toBe(true);
  });
});
