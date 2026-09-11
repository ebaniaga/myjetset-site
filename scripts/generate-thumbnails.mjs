import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PLACES, markerType } from "../src/data/places.js";
import { THUMBNAIL_WIDTHS, thumbnailUrl } from "../src/lib/thumbnails.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const sources = [...new Set(PLACES.filter((p) => markerType(p) !== "visit" && p.photos?.length).map((p) => p.photos[0].src))];
const jobs = sources.flatMap((src) => THUMBNAIL_WIDTHS.map((width) => ({ src, width })));
let bytes = 0;
// Bounded batches keep peak memory predictable when processing the photo library.
for (let i = 0; i < jobs.length; i += 8) {
  await Promise.all(jobs.slice(i, i + 8).map(async ({ src, width }) => {
    const output = resolve(root, "public", `.${thumbnailUrl(src, width)}`);
    await mkdir(dirname(output), { recursive: true });
    const info = await sharp(resolve(root, "public", `.${src}`))
      .rotate().resize(width, Math.round(width * 54 / 80), { fit: "cover" })
      .webp({ quality: 75 }).toFile(output);
    bytes += info.size;
  }));
}
console.log(`Generated ${jobs.length} thumbnails (${(bytes / 1e6).toFixed(2)} MB total).`);
