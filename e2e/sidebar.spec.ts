import { expect, test } from "@playwright/test";
import { go } from "./helpers";

test.describe("sidebar shell", () => {
  test("section sub-items link to their pages", async ({ page }) => {
    await go(page, "/");
    await page.getByRole("link", { name: "Spheda" }).click();
    await expect(page).toHaveURL(/\/spheda/);
    await expect(page.getByRole("heading", { name: "Spheda", level: 1 })).toBeVisible();
  });

  test("the collapsed rail opens sub-pages through the section dropdown", async ({ page }) => {
    await go(page, "/");
    // The header trigger (not the identically-labelled drag rail) toggles the sidebar.
    await page.locator("header").getByRole("button", { name: "Toggle Sidebar" }).click();
    await page.getByRole("button", { name: "Reference" }).click();
    await page.getByRole("menuitem", { name: "Spheda" }).click();
    await expect(page).toHaveURL(/\/spheda/);
    await expect(page.getByRole("heading", { name: "Spheda", level: 1 })).toBeVisible();
  });

  test("the active sub-item is marked", async ({ page }) => {
    await go(page, "/items");
    // Scoped to the sidebar: the breadcrumb names the current page too.
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar.getByRole("link", { name: "Items" })).toHaveAttribute("data-active", "");
  });

  test("the profile menu opens and switches profiles", async ({ page }) => {
    const profile = (id: string, name: string, createdAt: number) => ({
      id,
      name,
      createdAt,
      checks: {},
      view: { hideDone: false, hidePostgame: false, showFacts: true, buyableOnly: true },
      activeGuides: ["main"],
      guides: [],
      dashboard: { view: "chapter", currentChapter: null },
    });
    await page.addInitScript(
      (s) => {
        if (!localStorage.getItem("dcc:state"))
          localStorage.setItem("dcc:state", JSON.stringify(s));
      },
      {
        version: 2,
        activeProfile: "p1",
        profiles: { p1: profile("p1", "Alpha", 1), p2: profile("p2", "Beta", 2) },
      },
    );
    await go(page, "/");
    const trigger = page.locator('[data-slot="sidebar-footer"] button');
    await expect(trigger).toContainText("Alpha");
    await trigger.click();
    await page.getByRole("menuitem", { name: "Beta" }).click();
    await expect(trigger).toContainText("Beta");
  });

  test("the breadcrumb shows the full Reference path and leads to the hub", async ({ page }) => {
    await go(page, "/weapons/poison-wrench");
    const crumbs = page.getByRole("navigation", { name: "breadcrumb" });
    await expect(crumbs).toContainText("Reference");
    await expect(crumbs).toContainText("Poison Wrench");
    await crumbs.getByRole("link", { name: "Weapons" }).click();
    await expect(page.getByRole("heading", { name: "Weapons", level: 1 })).toBeVisible();
    await crumbs.getByRole("link", { name: "Reference" }).click();
    await expect(page.getByRole("heading", { name: "Reference", level: 1 })).toBeVisible();
    // The hub's tracker tiles show progress; the phone tab bar stays hidden on desktop.
    await expect(page.getByRole("progressbar", { name: "Spheda" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main sections" })).toBeHidden();
  });
});
