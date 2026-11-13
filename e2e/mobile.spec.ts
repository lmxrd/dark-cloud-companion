import { expect, test } from "@playwright/test";
import { go } from "./helpers";

const pages = [
  "/",
  "/guides",
  "/planner",
  "/reference",
  "/weapons",
  "/weapons/poison-wrench",
  "/items",
  "/ridepod",
  "/monsters",
  "/spheda",
  "/settings",
  "/about",
];

test.describe("phone layout", () => {
  for (const path of pages) {
    test(`no horizontal overflow on ${path}`, async ({ page }) => {
      await go(page, path);
      await page.waitForLoadState("networkidle");
      const { scroll, inner } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(inner);
    });
  }

  test("the bottom tab bar reaches every main section", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout only");
    await go(page, "/");
    const tabs = page.getByRole("navigation", { name: "Main sections" });
    // Phones navigate with the tab bar; the sidebar trigger is hidden.
    await expect(
      page.locator("header").getByRole("button", { name: "Toggle Sidebar" }),
    ).toBeHidden();
    await expect(tabs.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
    for (const name of ["Guides", "Planner", "Reference"]) {
      await tabs.getByRole("link", { name }).click();
      await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
      await expect(tabs.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    }
    await page.getByRole("link", { name: /^Items/ }).click();
    await expect(page.getByRole("heading", { name: "Items", level: 1 })).toBeVisible();
    // Reference stays the active tab on its sub-pages.
    await expect(tabs.getByRole("link", { name: "Reference" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("the tab bar does not cover the end of the page", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout only");
    await go(page, "/about");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const last = page.locator("main p").last();
    const bar = page.getByRole("navigation", { name: "Main sections" });
    const lastBox = await last.boundingBox();
    const barBox = await bar.boundingBox();
    expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(barBox!.y);
  });

  test("the profile menu opens from the header avatar", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout only");
    await go(page, "/");
    await page.getByRole("button", { name: /^Profile/ }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  });
});
