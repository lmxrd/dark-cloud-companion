import { expect, test } from "@playwright/test";
import { activeProfile, go } from "./helpers";

test.describe("dashboard and progress", () => {
  test("a tick persists across reloads, and a finished step starts folded", async ({ page }) => {
    await go(page, "/");
    const linda = page.getByRole("checkbox", { name: /Brave Little Linda/ }).first();
    await expect(linda).not.toBeChecked();
    await linda.click();
    await expect(linda).toBeChecked();
    expect((await activeProfile(page)).checks["photo:brave-little-linda"]).toBe(true);
    // Ticking the last open item does not fold the step under the user.
    await expect(page.getByRole("button", { name: "Hide step" }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: /Brave Little Linda/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Show step" }).first().click();
    await expect(page.getByRole("checkbox", { name: /Brave Little Linda/ }).first()).toBeChecked();
  });

  test("progress is shown only for switched-on guides", async ({ page }) => {
    await go(page, "/guides");
    await page.getByRole("switch", { name: "Show on dashboard: Main walkthrough" }).click();
    await go(page, "/");
    await expect(page.getByText("No guides are switched on")).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveCount(0);

    // Overview still lists every chapter.
    await page.getByRole("tab", { name: "Overview" }).click();
    await expect(page.getByRole("button", { name: /To the Outside World/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Palace of Flowers/ })).toBeVisible();

    await go(page, "/guides");
    await page.getByRole("switch", { name: "Show on dashboard: Main walkthrough" }).click();
    await go(page, "/");
    await page.getByRole("tab", { name: "Overview" }).click();
    await expect(page.getByRole("progressbar", { name: "Main walkthrough" })).toBeVisible();
  });

  test("the chapter view follows the picker and shows missable items", async ({ page }) => {
    await go(page, "/");
    await expect(page.getByText("Missable items still open")).toBeVisible();
    await page
      .getByLabel("Chapter", { exact: true })
      .selectOption({ label: "2. Resurrection of the Great Elder" });
    await expect(
      page.getByRole("heading", { name: /Resurrection of the Great Elder/ }),
    ).toBeVisible();
    await expect(page.getByText("King Mardan").first()).toBeVisible();
  });

  test("overview shows a chapter strip and opens a chapter from it", async ({ page }) => {
    await go(page, "/");
    await page.getByRole("tab", { name: "Overview" }).click();
    const strip = page.getByRole("region", { name: "Chapters" });
    await strip.getByRole("button", { name: /Palace of Flowers/ }).click();
    await strip.getByRole("button", { name: /Open chapter/ }).click();
    await expect(page.getByLabel("Chapter", { exact: true })).toHaveValue(/.+/);
    await expect(page.getByRole("heading", { name: /Palace of Flowers/ })).toBeAttached();
  });

  test("by guide filters by chapter chip and folds a guide", async ({ page }) => {
    await go(page, "/");
    await page.getByRole("tab", { name: "By guide" }).click();
    const linda = page.getByRole("checkbox", { name: /Brave Little Linda/ });
    await expect(linda.first()).toBeVisible();

    await page.getByRole("button", { name: "Hide guide" }).click();
    await expect(linda).toHaveCount(0);
    await page.getByRole("button", { name: "Show guide" }).click();
    await expect(linda.first()).toBeVisible();

    const chip = page.getByRole("button", { name: "2. Resurrection of the Great Elder" });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(linda).toHaveCount(0);
  });

  test("a category chip in the chapter hero filters the list", async ({ page }) => {
    await go(page, "/");
    const linda = page.getByRole("checkbox", { name: /Brave Little Linda/ });
    await expect(linda.first()).toBeVisible();
    const chips = page.getByRole("group", { name: "Show" });
    const medals = chips.getByRole("button", { name: /^Medals/ });
    await medals.click();
    await expect(medals).toHaveAttribute("aria-pressed", "true");
    await expect(linda).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /^Time:/ }).first()).toBeVisible();
    await chips.getByRole("button", { name: /^Scoops/ }).click();
    await expect(linda.first()).toBeVisible();
    await chips.getByRole("button", { name: "All" }).click();
    await expect(chips.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("a medal tile ticks the medal and counts toward the chip", async ({ page }) => {
    await go(page, "/");
    const medals = page
      .getByRole("group", { name: "Show" })
      .getByRole("button", { name: /^Medals/ });
    await expect(medals).toContainText(/ 0\//);
    const tile = page.getByRole("checkbox", { name: /^Time:/ }).first();
    await tile.click();
    await expect(tile).toHaveAttribute("aria-checked", "true");
    await expect(medals).toContainText(/ 1\//);
  });

  test("the next chapter button and set-as-current work from the hero", async ({ page }) => {
    await go(page, "/");
    await page.getByRole("button", { name: "Next chapter" }).click();
    const picker = page.getByLabel("Chapter", { exact: true });
    await expect(picker).toHaveValue("2");
    await page.getByRole("button", { name: "Set as current chapter" }).click();
    await expect(page.getByRole("button", { name: "Set as current chapter" })).toHaveCount(0);
    expect((await activeProfile(page)).dashboard.currentChapter).toBe("2");
  });

  test("the collectable matrix shows progress per chapter and opens a chapter", async ({
    page,
  }) => {
    await go(page, "/");
    await page
      .getByRole("checkbox", { name: /Brave Little Linda/ })
      .first()
      .click();
    await page.getByRole("tab", { name: "Overview" }).click();
    const matrix = page.getByRole("table");
    await expect(matrix.getByRole("columnheader", { name: "Scp" })).toBeVisible();
    // Chapter 1 has one scoop ticked.
    const row = matrix.getByRole("row").nth(1);
    await expect(row).toContainText(/1 \/ \d+/);
    await row.getByRole("button").click();
    await expect(page.getByLabel("Chapter", { exact: true })).toHaveValue("1");
  });
});
