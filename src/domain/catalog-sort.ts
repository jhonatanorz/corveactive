export type SortKey = "default" | "price_asc" | "price_desc";

/** Parse a raw URL value into a SortKey; anything unrecognized → "default". */
export function parseSortKey(v: string | null): SortKey {
  return v === "price_asc" || v === "price_desc" ? v : "default";
}

/** Sort by price (stable); "default" returns a copy in the original order. Never mutates input. */
export function sortItems<T extends { price: number }>(items: T[], sort: SortKey): T[] {
  if (sort === "default") return items.slice();
  const dir = sort === "price_asc" ? 1 : -1;
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.price - b.item.price) * dir || a.index - b.index)
    .map((x) => x.item);
}
