// Responsive photo variants, generated at build time by scripts/generate-responsive.mjs
// for every /images/*.jpg referenced from src/. Pages render them through
// src/components/Photo.astro; the original JPEG stays as the <img> fallback.
export const RESPONSIVE_WIDTHS = [480, 960, 1440];
export const RESPONSIVE_FORMATS = ["avif", "webp"];
export function responsiveUrl(src, width, format) {
  return `/images/r/${width}/${src.replace(/^\/images\//, "").replace(/\.[^.]+$/, `.${format}`)}`;
}
export function responsiveSrcset(src, format, maxWidth = Infinity) {
  return RESPONSIVE_WIDTHS.filter((w) => w <= maxWidth).map((w) => `${responsiveUrl(src, w, format)} ${w}w`).join(", ");
}
