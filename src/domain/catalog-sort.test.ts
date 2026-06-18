import { describe, it, expect } from "vitest";
import { sortItems, parseSortKey } from "@/domain/catalog-sort";

const items = [
  { id: "a", price: 300 },
  { id: "b", price: 100 },
  { id: "c", price: 200 },
  { id: "d", price: 100 },
];

describe("parseSortKey", () => {
  it("accepts the two price keys", () => {
    expect(parseSortKey("price_asc")).toBe("price_asc");
    expect(parseSortKey("price_desc")).toBe("price_desc");
  });
  it("falls back to default for unknown/null/default", () => {
    expect(parseSortKey(null)).toBe("default");
    expect(parseSortKey("whatever")).toBe("default");
    expect(parseSortKey("default")).toBe("default");
  });
});

describe("sortItems", () => {
  it("default returns original order, as a copy", () => {
    const r = sortItems(items, "default");
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
    expect(r).not.toBe(items);
  });
  it("price_asc sorts ascending, stable on ties", () => {
    expect(sortItems(items, "price_asc").map((x) => x.id)).toEqual(["b", "d", "c", "a"]);
  });
  it("price_desc sorts descending, stable on ties", () => {
    expect(sortItems(items, "price_desc").map((x) => x.id)).toEqual(["a", "c", "b", "d"]);
  });
  it("does not mutate the input", () => {
    const copy = items.slice();
    sortItems(items, "price_asc");
    expect(items).toEqual(copy);
  });
  it("handles empty input", () => {
    expect(sortItems([], "price_asc")).toEqual([]);
  });
});
