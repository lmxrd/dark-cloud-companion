import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { go } from "./helpers";

/** The built service worker that `astro preview` serves; a new deploy replaces it. */
const SW_FILE = "dist/sw.js";

/** Waits until the service worker controls the page and has precached the build. */
const installed = (page: Page) =>
  page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i++)
      await new Promise((r) => setTimeout(r, 100));
    for (let i = 0; i < 100; i++) {
      const keys = await caches.keys();
      if (keys.length && (await (await caches.open(keys[0])).keys()).length > 100) return keys;
      await new Promise((r) => setTimeout(r, 200));
    }
    return caches.keys();
  });

test("a new version waits for the user, then the tab moves to it", async ({ page }) => {
  await go(page, "/");
  const [oldCache] = await installed(page);

  // Deploy a "new build": the same worker under another version, so it installs a new cache.
  const original = readFileSync(SW_FILE, "utf8");
  try {
    writeFileSync(
      SW_FILE,
      original.replace(/const VERSION = "[^"]+";/, 'const VERSION = "e2e-next";'),
    );
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());

    // It installs but does not take over on its own, so the old files stay available.
    const prompt = page.getByRole("status").filter({ hasText: "new version" });
    await expect(prompt).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => caches.keys())).toContain(oldCache);

    await Promise.all([
      page.waitForEvent("load"),
      prompt.getByRole("button", { name: "Reload" }).click(),
    ]);
    await expect
      .poll(() => page.evaluate(() => caches.keys()), { timeout: 15_000 })
      .toEqual(["dcc-e2e-next"]);
    await expect(prompt).toHaveCount(0);
  } finally {
    writeFileSync(SW_FILE, original);
  }
});
