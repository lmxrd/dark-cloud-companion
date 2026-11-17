import { expect, test } from "@playwright/test";
import { go, targetPicker } from "./helpers";

// The service worker would serve the worker script from its cache; this test needs the network.
test.use({ serviceWorkers: "block" });

test("the planner reports a worker that can't load instead of calculating forever", async ({
  page,
}) => {
  await page.route(/\/_astro\/worker[^/]*\.js/, (route) => route.abort());
  await go(page, "/tools/planner");
  await targetPicker(page).selectOption({ label: "Drill Wrench" });
  await page.getByRole("button", { name: "Generate plan" }).click();
  await expect(page.getByText(/the planner couldn't start/)).toBeVisible({ timeout: 15_000 });
  // The button is usable again.
  await expect(page.getByRole("button", { name: "Generate plan" })).toBeEnabled();
});
