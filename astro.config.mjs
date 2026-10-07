// Static build. The award-search + inquiry backends stay as Cloudflare Pages
// Functions in ./functions (Wrangler picks that dir up alongside dist/), so no
// server adapter is needed.
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://myjetset.life",
  output: "static",
  trailingSlash: "never",
  // Emit /search.html (not /search/index.html) so clean URLs work without a
  // trailing slash on Cloudflare Pages.
  build: { format: "file" },
  integrations: [
    sitemap({
      // Pages that are hidden from the nav or are post-submit/error states.
      filter: (page) => !/\/(travel-reports|submitted|404)$/.test(page),
      // Emit clean URLs even though the build writes .html files.
      serialize: (item) => ({ ...item, url: item.url.replace(/\/index\.html$/, "/").replace(/\.html$/, "") }),
    }),
  ],
});
