import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { PLACES, markerType } from "../src/data/places.js";
import { THUMBNAIL_WIDTHS, thumbnailUrl } from "../src/lib/thumbnails.js";

const dist = new URL("../dist/", import.meta.url);
const read = (name) => readFile(new URL(name, dist), "utf8");
const search = await read("search.html");
const redirect = search.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
assert.ok(redirect, "Search must redirect after success");
assert.match(redirect[1], /^\/submitted(?:\.html)?$/);
const submitted = await read("submitted.html");
assert.match(submitted, /Check your inbox/);
assert.doesNotMatch(submitted, /we.ll keep watching/);
const globe = await read("globe.html");
let count = 0;
for (const place of PLACES.filter((p) => markerType(p) !== "visit" && p.photos?.length)) {
  for (const width of THUMBNAIL_WIDTHS) {
    const url = thumbnailUrl(place.photos[0].src, width);
    assert.ok(globe.includes(url), `Missing thumbnail markup: ${url}`);
    const info = await stat(new URL(`.${url}`, dist));
    assert.ok(info.size > 0 && info.size < 60000, `Unexpected thumbnail size: ${url}`);
    count++;
  }
}
console.log(`Build checks passed: confirmation route and ${count} responsive thumbnails.`);
