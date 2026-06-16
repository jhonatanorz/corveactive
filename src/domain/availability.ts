export interface AvailVariant {
  color: string;
  size: string;
  stock: number;
}

export interface ColorAvailability {
  color: string;
  sizes: { size: string; inStock: boolean }[];
}

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];

function orderSizes(sizes: string[]): string[] {
  const known = SIZE_ORDER.filter((s) => sizes.includes(s));
  const unknown = sizes.filter((s) => !SIZE_ORDER.includes(s));
  return [...known, ...unknown];
}

/** Group variants by color (first-seen order); list each color's sizes in canonical order with an inStock flag. */
export function availableByColor(variants: AvailVariant[]): ColorAvailability[] {
  const byColor = new Map<string, Map<string, number>>();
  const colorOrder: string[] = [];
  for (const v of variants) {
    if (!byColor.has(v.color)) {
      byColor.set(v.color, new Map());
      colorOrder.push(v.color);
    }
    byColor.get(v.color)!.set(v.size, v.stock);
  }
  return colorOrder.map((color) => {
    const sizeMap = byColor.get(color)!;
    const sizes = orderSizes([...sizeMap.keys()]).map((size) => ({
      size,
      inStock: (sizeMap.get(size) ?? 0) > 0,
    }));
    return { color, sizes };
  });
}
