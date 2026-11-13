import { expect, test } from "@playwright/test";
import { go, targetPicker } from "./helpers";

test.describe("reference pages", () => {
  test("items can be filtered by buyable / found-only", async ({ page }) => {
    await go(page, "/items");
    const filter = page.getByRole("radiogroup", { name: "Items" });
    await filter.getByRole("radio", { name: /^Found/ }).click();
    await expect(page.getByText("Moon Stone", { exact: true })).toBeVisible();
    await expect(page.getByText("Gunpowder", { exact: true })).toHaveCount(0);
    await filter.getByRole("radio", { name: /^Buyable/ }).click();
    await expect(page.getByText("Gunpowder", { exact: true })).toBeVisible();
    await expect(page.getByText("Moon Stone", { exact: true })).toHaveCount(0);
  });

  test("weapon pages show build-up links and a planner deep link", async ({ page }) => {
    await go(page, "/weapons/poison-wrench");
    await expect(page.getByRole("heading", { name: "Poison Wrench" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sigma Breaker" })).toBeVisible();
    await page.getByRole("link", { name: "Plan this weapon" }).click();
    await expect(targetPicker(page)).toHaveValue("poison-wrench");
  });

  test("Ridepod parts can be ticked", async ({ page }) => {
    await go(page, "/ridepod");
    // The close-range arms section starts open.
    const box = page.getByRole("checkbox", { name: /^Cannonball Arm/ }).first();
    await box.click();
    await expect(box).toBeChecked();
  });

  test("old chapter URLs redirect to the dashboard", async ({ page }) => {
    await go(page, "/chapters/c3");
    await expect(page).toHaveURL(/\/\?chapter=c3$/);
    await expect(page.getByRole("heading", { name: /The Sage of the Stars/ })).toBeVisible();
  });
});

test("the weapons list has one tab per weapon type", async ({ page }) => {
  await go(page, "/weapons");
  await expect(page.getByRole("tab")).toHaveCount(6); // All + 5 types
  await page.getByRole("tab", { name: "Armbands" }).click();
  await expect(page.getByRole("link", { name: /Five-Star Armlet/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Grade Zero/ })).toHaveCount(0);
});

test("the Gives filter lists items that add a stat, largest first", async ({ page }) => {
  await go(page, "/items");
  await page
    .getByRole("group", { name: "Gives" })
    .getByRole("button", { name: "Lightning" })
    .click();
  const section = page.getByRole("heading", { name: "Items that add Lightning" });
  await expect(section).toBeVisible();
  // Every row carries a Lightning chip, and the list is sorted by it.
  const values = await page
    .locator("li")
    .filter({ hasText: /Lght \+\d+/ })
    .evaluateAll((rows) =>
      rows.map((r) => Number(/Lght \+(\d+)/.exec(r.textContent ?? "")?.[1] ?? 0)),
    );
  expect(values.length).toBeGreaterThan(3);
  expect([...values].sort((a, b) => b - a)).toEqual(values);
});

test("the weapons list groups by owner and can show finals only", async ({ page }) => {
  await go(page, "/weapons");
  await expect(page.getByRole("heading", { name: "Max · Wrenches & hammers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monica · Swords" })).toBeVisible();
  await page.getByRole("button", { name: "Finals" }).click();
  await expect(page.getByRole("link", { name: /Grade Zero/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Battle Wrench/ })).toHaveCount(0);
});
