import { expect, test } from "@playwright/test";
import { go } from "./helpers";

/** A profile with progress, so islands render something different from the server's defaults. */
const profile = (id: string, name: string) => ({
  id,
  name,
  createdAt: 1,
  checks: {
    "c1-scoop-brave-little-linda": true,
    "ridepod:cannonball-arm": true,
    "monster:flora:badge": true,
    "club:turkey": true,
  },
  view: { hideDone: true, hidePostgame: false, showFacts: false, buyableOnly: true },
  activeGuides: ["main", "grade-zero-max-abs"],
  guides: [],
  dashboard: { view: "chapter", currentChapter: "c2" },
});

const pages = [
  "/",
  "/overview",
  "/by-guide",
  "/chapters/3",
  "/?chapter=c3&cat=medal&q=a",
  "/guides?q=zero",
  "/weapons?type=sword&finals=1&sort=abs&q=a",
  "/items?kind=found&gives=at&q=a",
  "/monsters#flora",
  "/guides",
  "/reference",
  "/weapons",
  "/items",
  "/ridepod",
  "/monsters",
  "/spheda",
  "/settings",
];

test.describe("saved progress", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem("dcc:state", JSON.stringify(s)), {
      version: 2,
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
    await go(page, "/spheda");
    await expect(page.getByRole("checkbox", { name: "I own Turkey" })).toBeChecked();
    await go(page, "/settings");
    await expect(page.getByRole("button", { name: /^Switch to / })).toHaveCount(2);
  });
});
