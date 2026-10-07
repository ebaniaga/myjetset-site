// Emits AVIF + WebP variants of every /images/*.jpg referenced from src/ into
// public/images/r/<width>/. Skips outputs newer than their source, so repeat
// runs are cheap. Runs before `astro dev` and `astro build` (see package.json).
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { RESPONSIVE_FORMATS, RESPONSIVE_WIDTHS, responsiveUrl } from "../src/lib/responsive.js";

const root = fileURLToPath(new URL("../", import.meta.url));

async function* walk(dir) {
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) yield* walk(p);
    else if (/\.(astro|js|ts)$/.test(d.name)) yield p;
  }
}
const refs = new Set();
// Only pages, components and lib: src/data (the globe's 500+ photos) is served through thumbnails instead.
for (const dir of ["pages", "components", "lib"]) for await (const file of walk(resolve(root, "src", dir))) {
  for (const m of (await readFile(file, "utf8")).matchAll(/["'`](\/images\/[^"'`\s]+\.jpe?g)["'`]/g)) refs.add(m[1]);
}
const mtime = async (p) => (await stat(p).catch(() => null))?.mtimeMs ?? 0;
const jobs = [];
for (const src of refs) {
  const input = resolve(root, "public", `.${src}`);
  const srcTime = await mtime(input);
  if (!srcTime) { console.warn(`responsive: missing ${src}`); continue; }
  for (const width of RESPONSIVE_WIDTHS) for (const format of RESPONSIVE_FORMATS) {
    const output = resolve(root, "public", `.${responsiveUrl(src, width, format)}`);
    if ((await mtime(output)) > srcTime) continue;
    jobs.push({ input, output, width, format });
  }
}
let bytes = 0;
for (let i = 0; i < jobs.length; i += 6) {
  await Promise.all(jobs.slice(i, i + 6).map(async ({ input, output, width, format }) => {
    await mkdir(dirname(output), { recursive: true });
    const pipeline = sharp(input).rotate().resize(width, null, { withoutEnlargement: true });
    const info = await (format === "avif" ? pipeline.avif({ quality: 55, effort: 4 }) : pipeline.webp({ quality: 78 })).toFile(output);
    bytes += info.size;
  }));
}
console.log(`Generated ${jobs.length} responsive variants for ${refs.size} photos (${(bytes / 1e6).toFixed(2)} MB).`);
