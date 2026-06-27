export interface ImageChoice {
  url: string;
  color: string | null;
  sortOrder: number;
}

const byOrder = (xs: ImageChoice[]): ImageChoice[] =>
  [...xs].sort((a, b) => a.sortOrder - b.sortOrder);

/**
 * Ordered images to show for a selected color (the storefront gallery):
 *  - the color's own images, sorted by sortOrder ascending;
 *  - else the Default images (color === null), sorted ascending;
 *  - else [] (caller shows the gradient placeholder).
 * Pass null to get the Default group directly.
 */
export function imagesForColor(images: ImageChoice[], color: string | null): ImageChoice[] {
  if (color !== null) {
    const own = images.filter((i) => i.color === color);
    if (own.length > 0) return byOrder(own);
  }
  return byOrder(images.filter((i) => i.color === null));
}

/**
 * The primary image URL for a color = the first of imagesForColor(images, color),
 * or null when there are none. Used by the grid tile, the cart line image, and the
 * detail hero default.
 */
export function pickProductImage(images: ImageChoice[], color: string | null): string | null {
  const list = imagesForColor(images, color);
  return list.length > 0 ? list[0].url : null;
}
