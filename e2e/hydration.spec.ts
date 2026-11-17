import { expect, test } from "@playwright/test";
import { go } from "./helpers";
import { builtinPlan } from "./plans";

const weaponGuide = builtinPlan("grade-zero/balanced").id;

/** A profile with progress, so islands render something different from the server's defaults. */
const profile = (id: string, name: string) => ({
  id,
  name,
  createdAt: 1,
  checks: {
    "photo:brave-little-linda": true,
    "part:cannonball-arm": true,
    "badge:flora": true,
    "weapon:turkey": true,
  },
  view: { hideDone: true, hidePostgame: false, showFacts: false, buyableOnly: true },
  activeGuides: ["main", weaponGuide],
  guides: [],
  dashboard: { view: "chapter", currentChapter: "2" },
  shopping: { goals: [], have: {}, invent: [], group: "stops" },
});

const pages = [
  "/",
  `/guides/view?id=${weaponGuide}`,
  `/guides/view?id=${weaponGuide}&view=map`,
  "/overview",
  "/by-guide",
  "/chapters/3",
  "/chapters/3?cat=medal&q=a",
  "/guides?q=zero",
  "/db/weapons?type=sword&finals=1&sort=abs&q=a",
  "/db/items?kind=found&gives=at&q=a",
  "/db/monsters#flora",
  "/guides",
  "/db",
  "/db/weapons",
  "/db/items",
  "/db/ridepod",
  "/db/monsters",
  "/db/spheda",
  "/db/bestiary?dungeon=underground-channel&sort=hp&dir=desc",
  "/db/inventions?tab=photos&chapter=2",
  "/db/people",
  "/db/places?era=future",
  "/db/weapons/chronicle-sword",
  "/db/photos/clock",
  "/settings",
];

test.describe("saved progress", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem("dcc:state", JSON.stringify(s)), {
      version: 3,
      activeProfile: "p1",
      profiles: { p1: profile("p1", "Alpha"), p2: profile("p2", "Beta") },
    });
  });

  for (const path of pages) {
    test(`${path} hydrates without a mismatch and then shows it`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error" && /hydrat/i.test(m.text())) errors.push(m.text());
      });
      await go(page, path);
      await page.waitForLoadState("networkidle");
      expect(errors).toEqual([]);
    });
  }

  test("the stored state is shown once hydrated", async ({ page }) => {
    await go(page, "/");
    await expect(page.getByLabel("Chapter", { exact: true })).toHaveValue("2");
    await go(page, "/db/spheda");
    await expect(page.getByRole("checkbox", { name: "I own Turkey" })).toBeChecked();
    await go(page, "/settings");
    await expect(
      page.getByRole("button", { name: /^Switch to (?!(light|dark) theme)/ }),
    ).toHaveCount(2);
  });
});
