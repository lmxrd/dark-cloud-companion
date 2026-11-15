// Minimal offline support: after the build, write a service worker that precaches every output file
// except the pages of single database things (`/db/<kind>/<id>`, about 1,500 of them): those are
// cached when first opened, or all at once from Settings ("Save all for offline").
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** @returns {import("astro").AstroIntegration} */
export default function pwa() {
  /** The deployment base path ("" when served from the root). */
  let base = "";
  /** Astro's trailingSlash setting: with "never", pages are served without one (`/guides`). */
  let trailingSlash = "ignore";
  return {
    name: "dcc-pwa",
    hooks: {
      "astro:config:setup": ({ config }) => {
        base = config.base.replace(/\/+$/, "");
        trailingSlash = config.trailingSlash;
      },
      "astro:build:done": ({ dir }) => {
        const root = fileURLToPath(dir);
        const all = walk(root)
          .map((f) => relative(root, f).split(sep).join("/"))
          .filter((f) => f !== "sw.js" && !f.endsWith(".map"));
        // Detail pages of the database, and the redirects from the old weapon pages.
        const lazy = (f) =>
          /^db\/[^/]+\/.+\/index\.html$/.test(f) || /^weapons\/.+\/index\.html$/.test(f);
        const files = all.filter((f) => !lazy(f));
        const pages = all.filter((f) => f.startsWith("db/") && lazy(f));
        // Pages are precached under the URL the server answers for them: `/guides/` normally,
        // `/guides` with trailingSlash "never" (the home page is always the base with a slash).
        const pageUrl = (dir) =>
          trailingSlash === "never" && dir ? `${base}/${dir.replace(/\/$/, "")}` : `${base}/${dir}`;
        const urls = files.map((f) =>
          f.endsWith("index.html") ? pageUrl(f.slice(0, -"index.html".length)) : `${base}/${f}`,
        );
        const pageUrls = pages.map((f) => pageUrl(f.slice(0, -"index.html".length)));
        const pagesBytes = pages.reduce((n, f) => n + statSync(join(root, f)).size, 0);
        const hash = createHash("sha1");
        for (const f of all) hash.update(f).update(readFileSync(join(root, f)));
        const version = hash.digest("hex").slice(0, 12);
        const sw = readFileSync(new URL("./sw-template.js", import.meta.url), "utf8")
          .replace("__VERSION__", version)
          .replace("__URLS__", JSON.stringify(urls))
          .replace("__PAGES__", JSON.stringify(pageUrls))
          .replace("__PAGES_BYTES__", String(pagesBytes))
          .replace("__BASE__", base);
        writeFileSync(join(root, "sw.js"), sw);
      },
    },
  };
}
