// Static build. The award-search + inquiry backends stay as Cloudflare Pages
// Functions in ./functions (Wrangler picks that dir up alongside dist/), so no
// server adapter is needed.
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://myjetset.life",
  output: "static",
  trailingSlash: "never",
  // Emit /search.html (not /search/index.html) so clean URLs work without a
  // trailing slash on Cloudflare Pages.
  build: { format: "file" },
});
