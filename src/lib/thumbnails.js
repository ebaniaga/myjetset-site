// The list renders at 80 CSS px; generate 1x, 2x and 3x variants at build time.
export const THUMBNAIL_WIDTHS = [80, 160, 240];
export function thumbnailUrl(src, width) {
  return `/images/thumbnails/${width}/${src.replace(/^\/images\//, "").replace(/\.[^.]+$/, ".webp")}`;
}
