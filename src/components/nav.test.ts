import { describe, expect, it } from "vitest";
import { useTranslations } from "@/i18n";
import { crumbsFor, isSectionActive, mainNav } from "./nav";

const t = useTranslations();

describe("crumbsFor", () => {
  it("names the dashboard Today", () => {
    expect(crumbsFor(t, "/")).toEqual([{ label: "Today" }]);
  });

  it("puts Reference before its sub-pages", () => {
    expect(crumbsFor(t, "/items")).toEqual([
      { label: "Reference", href: "/reference" },
      { label: "Items" },
    ]);
  });

  it("shows the full path to a weapon", () => {
    expect(crumbsFor(t, "/weapons/poison-wrench/", "Poison Wrench")).toEqual([
      { label: "Reference", href: "/reference" },
      { label: "Weapons", href: "/weapons" },
      { label: "Poison Wrench" },
    ]);
  });

  it("links a guide back to the guide list", () => {
    expect(crumbsFor(t, "/guides/view")).toEqual([
      { label: "Guides", href: "/guides" },
      { label: "Guide" },
    ]);
  });

  it("gives top-level pages a single crumb", () => {
    expect(crumbsFor(t, "/reference")).toEqual([{ label: "Reference" }]);
    expect(crumbsFor(t, "/planner")).toEqual([{ label: "Planner" }]);
  });
});

describe("mainNav", () => {
  const [today, guides, planner, reference] = mainNav(t);

  it("has the four main sections", () => {
    expect([today, guides, planner, reference].map((i) => i.title)).toEqual([
      "Today",
      "Guides",
      "Planner",
      "Reference",
    ]);
  });

  it("marks Reference active on the hub and every sub-page", () => {
    for (const path of ["/reference", "/weapons", "/weapons/poison-wrench", "/spheda"])
      expect(isSectionActive(reference, path)).toBe(true);
    expect(isSectionActive(reference, "/")).toBe(false);
    expect(isSectionActive(today, "/weapons")).toBe(false);
  });
});
