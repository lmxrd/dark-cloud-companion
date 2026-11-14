import { expect, test } from "@playwright/test";
import { activeProfile, go } from "./helpers";

const making = (page: import("@playwright/test").Page) =>
  page.getByRole("list", { name: "Making" });

/** Pins the dashboard (and so the shopping list) to a chapter, as the chapter view's pin does. */
async function atChapter(page: import("@playwright/test").Page, chapter: string) {
  await page.evaluate((ch) => {
    const state = JSON.parse(localStorage.getItem("dcc:state")!);
    state.profiles[state.activeProfile].dashboard.currentChapter = ch;
    localStorage.setItem("dcc:state", JSON.stringify(state));
  }, chapter);
}

test.describe("shopping list", () => {
  test("adding an invention lists its materials by shop; ticks and counts persist", async ({
    page,
  }) => {
    await go(page, "/tools/shopping");
    await expect(page.getByText("Your list is empty.")).toBeVisible();
    await page.getByLabel("Search items, inventions, Georama parts, builds…").fill("aquarium");
    await page.getByRole("button", { name: "Add Aquarium" }).click();
    // Conda's Goods opens in chapter 2.
    await atChapter(page, "2");
    await page.reload();
    await expect(making(page).getByText("Aquarium")).toBeVisible();
    // Aquarium: 5 Rolling Log, 4 Glass Material, 15 Water Element — all at Conda's Goods.
    await expect(page.getByRole("heading", { name: /Conda's Goods/ })).toBeVisible();
    await expect(page.getByTestId("shopping-0")).toHaveText("1,080 G");
    await expect(page.getByTestId("shopping-1")).toHaveText("3");

    await page.getByRole("checkbox", { name: "Have all Water Element" }).click();
    await expect(page.getByTestId("shopping-1")).toHaveText("2");
    await page.getByRole("button", { name: "More: Have: Rolling Log" }).click();
    await page.reload();
    await expect(page.getByLabel("Have: Rolling Log", { exact: true })).toHaveValue("1");
    const p = await activeProfile(page);
    expect(p.shopping.have).toEqual({ "Water Element": 15, "Rolling Log": 1 });
    expect(p.shopping.goals).toMatchObject([{ kind: "invention", name: "Aquarium", qty: 1 }]);
  });

  test("“Made” uses up the items, ticks the invention, and can be undone", async ({ page }) => {
    await go(page, "/tools/shopping");
    await page.getByLabel("Search items, inventions, Georama parts, builds…").fill("aquarium");
    await page.getByRole("button", { name: "Add Aquarium" }).click();
    await page.getByRole("checkbox", { name: "Have all Glass Material" }).click();
    await making(page).getByRole("button", { name: /Made/ }).click();
    await expect(page.getByRole("status").getByText(/Aquarium made/)).toBeVisible();
    let p = await activeProfile(page);
    expect(p.shopping.goals).toEqual([]);
    expect(p.shopping.have).toEqual({});
    expect(p.checks["invention:aquarium"]).toBe(true);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(making(page).getByText("Aquarium")).toBeVisible();
    p = await activeProfile(page);
    expect(p.shopping.have).toEqual({ "Glass Material": 4 });
    expect(p.checks["invention:aquarium"]).toBeUndefined();
  });

  test("invent instead replaces a component with its recipe", async ({ page }) => {
    await go(page, "/tools/shopping");
    await page.getByRole("button", { name: "Inventions", exact: true }).click();
    await page.getByLabel("Search items, inventions, Georama parts, builds…").fill("grenade");
    await page.getByRole("button", { name: "Add Grenade Launcher", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Have all Bomb" })).toBeVisible();
    await page.getByRole("button", { name: "Invent instead" }).click();
    await expect(page.getByRole("checkbox", { name: "Have all Bomb" })).toHaveCount(0);
    await expect(page.getByText(/via Bomb/).first()).toBeVisible();
    await page.getByRole("button", { name: "buy instead" }).click();
    await expect(page.getByRole("checkbox", { name: "Have all Bomb" })).toBeVisible();
  });

  test("items, Georama lists and guide build steps add to the list", async ({ page }) => {
    await go(page, "/items");
    await page.getByRole("button", { name: "Add Gunpowder to shopping list" }).click();

    // A Georama goal that asks for a number of one part (Sindain: 15 River Parts placed).
    await go(page, "/chapters/2");
    await page.getByRole("button", { name: "Add 15× River to shopping list" }).click();

    await go(page, "/guides/view?id=island-king-42c60d");
    await page.getByRole("button", { name: "Add remaining steps to list" }).click();

    await go(page, "/tools/shopping");
    await expect(making(page).getByText("Gunpowder", { exact: true })).toBeVisible();
    await expect(making(page).getByText("Island King — Story")).toBeVisible();
    const p = await activeProfile(page);
    const kinds = p.shopping.goals.map((g: { kind: string }) => g.kind);
    expect(kinds).toContain("georama");
    expect(kinds).toContain("build");
    // The build's items include what goes into its side weapons' spheres.
    await expect(page.getByRole("heading", { name: /Conda's Goods/ })).toBeVisible();
    // The sidebar shows how many lines are left.
    await expect(
      page.locator('[data-sidebar="menu-badge"]').filter({ hasText: /^\d+$/ }),
    ).toBeVisible();
  });
});
