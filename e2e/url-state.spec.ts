import { expect, test } from "@playwright/test";
import { basePath, go } from "./helpers";

/** Views live in the URL: a reload, Back or a shared link lands on the same view. */
test.describe("navigation state in the URL", () => {
  test("dashboard tabs and chapters are paths", async ({ page }) => {
    await go(page, "/");
    await page.getByRole("tab", { name: "Overview" }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await page.reload();
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.getByRole("tab", { name: "By guide" }).click();
    await expect(page).toHaveURL(/\/by-guide$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.getByRole("tablist", { name: "Dashboard view" }).getByRole("tab").first().click();
    await expect(page).toHaveURL(/\/dark-cloud-companion\/?$/);
    await page.getByLabel("Chapter", { exact: true }).selectOption("3");
    await expect(page).toHaveURL(/\/chapters\/3$/);
    await page.reload();
    await expect(page.getByLabel("Chapter", { exact: true })).toHaveValue("3");
  });

  test("old ?chapter= links move to the chapter's path", async ({ page }) => {
    await go(page, "/?chapter=c4");
    await expect(page).toHaveURL(/\/chapters\/4$/);
    await expect(page.getByLabel("Chapter", { exact: true })).toHaveValue("4");
  });

  test("weapon filters survive a reload", async ({ page }) => {
    await go(page, "/db/weapons");
    const type = page.getByRole("group", { name: "Type" });
    const sort = page.getByRole("group", { name: "Sort" });
    await type.getByRole("button", { name: "Swords" }).click();
    await page.getByRole("button", { name: "Finals", exact: true }).click();
    await sort.getByRole("button", { name: "ABS", exact: true }).click();
    await sort.getByRole("button", { name: "Lowest first" }).click();
    await page.getByLabel("Search weapons").fill("blade");
    await expect(page).toHaveURL(/q=blade/);
    expect(new URL(page.url()).searchParams.get("type")).toBe("sword");
    await page.reload();
    await expect(type.getByRole("button", { name: "Swords" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: "Finals", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(sort.getByRole("button", { name: "ABS", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(sort.getByRole("button", { name: "Highest first" })).toBeVisible();
    await expect(page.getByLabel("Search weapons")).toHaveValue("blade");
  });

  test("the planner's editor tab is a path", async ({ page }) => {
    await go(page, "/tools/planner");
    await page.getByRole("tab", { name: /Create/ }).click();
    await expect(page).toHaveURL(/\/tools\/planner\/editor$/);
    await page.reload();
    await expect(page.getByRole("tab", { name: /Create/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await go(page, "/tools/planner?new");
    await expect(page).toHaveURL(/\/tools\/planner\/editor\?new$/);
  });

  test("a weapon page's plan link picks the target, then leaves the URL clean", async ({
    page,
  }) => {
    await go(page, "/tools/planner?target=chronicle-2");
    await expect(page.getByLabel("Choose the end weapon")).toHaveValue("chronicle-2");
    await expect(page).toHaveURL(/\/tools\/planner$/);
  });

  test("a tracker jump is kept in the hash", async ({ page }) => {
    await go(page, "/db/spheda");
    const nav = page.getByRole("navigation", { name: "Jump to a group" });
    const chip = nav.getByRole("button").last();
    await chip.click();
    const hash = new URL(page.url()).hash;
    expect(hash).not.toBe("");
    await page.reload();
    const group = page.locator(`[id="group-${decodeURIComponent(hash.slice(1))}"]`);
    await expect(group.getByRole("button").first()).toHaveAttribute("aria-expanded", "true");
  });

  test("gated views stay hidden until their state is applied, with a fallback", async ({
    page,
  }) => {
    // Without scripts the island never applies the query; the CSS fallback shows it after 1.5s.
    await page.route(/\/_astro\/.*\.js$/, (r) => r.abort());
    await page.goto(`${basePath}/db/weapons?type=sword`);
    const gate = page.locator("[data-gate]").first();
    await expect(gate).toBeHidden({ timeout: 1000 });
    await expect(gate).toBeVisible({ timeout: 5000 });
  });
});
