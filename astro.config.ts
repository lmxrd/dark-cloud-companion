import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import gamedata from "./integrations/gamedata";
import plans from "./integrations/plans";
import pwa from "./integrations/pwa.mjs";

function getSiteInfo(): { site: string | undefined; base: string | undefined } {
  if (!process.env.PUBLIC_SITE_URL) {
    return { site: undefined, base: undefined };
  }

  const url = new URL(process.env.PUBLIC_SITE_URL);

  return { site: url.href, base: url.pathname };
}

const { site, base } = getSiteInfo();

// https://docs.astro.build/en/reference/configuration/
export default defineConfig({
  site: site,
  // The site is served from the repo subpath on GitHub Pages.
  base: base,
  output: "static",
  // The reference pages moved under /db; old links (bookmarks, shared URLs) still work.
  redirects: {
    "/reference": "/db",
    "/weapons": "/db/weapons",
    "/weapons/[id]": "/db/weapons/[id]",
    ...Object.fromEntries(
      ["items", "bestiary", "shops", "fishing", "people", "ridepod", "monsters", "spheda"].map(
        (p) => [`/${p}`, `/db/${p}`],
      ),
    ),
  },
  integrations: [react(), gamedata(), plans(), pwa()],
  vite: {
    plugins: [tailwindcss()],
  },
});
