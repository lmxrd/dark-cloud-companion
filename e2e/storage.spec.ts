import { expect, test, type Page } from "@playwright/test";
import { go } from "./helpers";

const KEY = "dcc:state";

/** Store `value` once (not again on later navigations, which would hide what the app wrote). */
const seed = (page: Page, value: string) =>
  page.addInitScript(
    ([key, v]) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(key, v);
    },
    [KEY, value],
  );

const tickSomething = (page: Page) =>
  page
    .getByRole("checkbox", { name: /Brave Little Linda/ })
    .first()
    .click();

test.describe("stored data problems", () => {
  test("unreadable data is kept as a backup and explained", async ({ page }) => {
    await seed(page, "{ not json");
    await go(page, "/");
    await expect(page.getByRole("alert")).toContainText("couldn't be read");
    const backups = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("dcc:state:backup-")),
    );
    expect(backups).toHaveLength(1);
    expect(await page.evaluate((k) => localStorage.getItem(k), backups[0])).toBe("{ not json");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download the backup" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("dcc-unreadable-backup.json");
  });

  test("data from a newer version is never written over", async ({ page }) => {
    const newer = JSON.stringify({ version: 99, something: "new" });
    await seed(page, newer);
    await go(page, "/");
    await expect(page.getByRole("alert")).toContainText("newer version");
    await tickSomething(page);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(newer);
  });

  test("a newer version written by another tab stops this tab from saving", async ({ page }) => {
    await go(page, "/");
    const newer = JSON.stringify({ version: 99 });
    await page.evaluate(
      ([key, v]) => {
        localStorage.setItem(key, v);
        window.dispatchEvent(new StorageEvent("storage", { key, newValue: v }));
      },
      [KEY, newer],
    );
    await expect(page.getByRole("alert")).toContainText("newer version");
    await tickSomething(page);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(newer);
  });

  test("a failed save is reported", async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("full", "QuotaExceededError");
      };
    });
    await go(page, "/");
    await tickSomething(page);
    await expect(page.getByRole("alert")).toContainText("can't be saved");
  });

  test("a missing active profile is repaired, keeping the profiles", async ({ page }) => {
    const p = {
      id: "p1",
      name: "Kept",
      createdAt: 1,
      checks: {},
      view: { hideDone: false, hidePostgame: false, showFacts: true, buyableOnly: true },
      activeGuides: ["main"],
      guides: [],
      dashboard: { view: "chapter", currentChapter: null },
    };
    await seed(page, JSON.stringify({ version: 2, activeProfile: "gone", profiles: { p1: p } }));
    await go(page, "/settings");
    await expect(page.getByRole("button", { name: "Switch to Kept" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
