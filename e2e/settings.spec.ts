import { expect, test } from "@playwright/test";
import { go, readState } from "./helpers";

test.describe("settings", () => {
  test("create, switch, rename and delete profiles from the cards", async ({ page }) => {
    await go(page, "/settings");
    await page.getByRole("button", { name: "New profile" }).click();
    await page.getByLabel("Profile name").fill("New Game+");
    await page.getByRole("button", { name: "Create" }).click();

    const card = page.getByRole("button", { name: "Switch to New Game+" });
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^Switch to (?!New Game\+)/ }).click();
    await expect(card).toHaveAttribute("aria-pressed", "false");

    await page.getByRole("button", { name: "Actions for New Game+" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByLabel("Profile name").fill("NG+");
    await page.getByRole("button", { name: "Rename" }).click();
    await expect(page.getByRole("button", { name: "Switch to NG+" })).toBeVisible();

    await page.getByRole("button", { name: "Actions for NG+" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete for good" }).click();
    await expect(page.getByRole("button", { name: "Switch to NG+" })).toHaveCount(0);
    expect(Object.keys((await readState(page)).profiles)).toHaveLength(1);
  });

  test("the only profile can't be deleted from the danger zone", async ({ page }) => {
    await go(page, "/settings");
    const danger = page.getByRole("region", { name: "Danger zone" });
    await expect(danger.getByRole("button", { name: "Delete this profile" })).toHaveCount(0);
  });

  test("appearance switches between light, dark and system", async ({ page }) => {
    await go(page, "/settings");
    const appearance = page.getByRole("radiogroup", { name: "Appearance" });
    await appearance.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");
    await appearance.getByRole("radio", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await appearance.getByRole("radio", { name: "System" }).click();
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
    await page.reload();
    await expect(appearance.getByRole("radio", { name: "System" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("the dashboard toggles here are the same settings as on the dashboard", async ({ page }) => {
    await go(page, "/settings");
    await page.getByRole("switch", { name: "Hide completed" }).click();
    await go(page, "/");
    await page.getByRole("button", { name: "View" }).click();
    await expect(page.getByRole("switch", { name: "Hide completed" })).toBeChecked();
  });

  test("an import that would replace a profile asks first", async ({ page }) => {
    await go(page, "/settings");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export all profiles" }).click(),
    ]);
    const path = await download.path();

    await page.locator('input[type="file"]').setInputFiles(path);
    const confirm = page.getByRole("alertdialog", { name: "Replace profiles?" });
    await expect(confirm).toContainText("Playthrough 1");
    await confirm.getByRole("button", { name: "Import as copies" }).click();
    await expect(
      page.getByRole("button", { name: "Switch to Playthrough 1 (imported)" }),
    ).toBeVisible();
    expect(Object.keys((await readState(page)).profiles)).toHaveLength(2);

    await page.locator('input[type="file"]').setInputFiles(path);
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toHaveCount(0);
    expect(Object.keys((await readState(page)).profiles)).toHaveLength(2);
  });
});
