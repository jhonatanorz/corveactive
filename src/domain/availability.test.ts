import { describe, it, expect } from "vitest";
import { availableByColor, type AvailVariant } from "@/domain/availability";

const variants: AvailVariant[] = [
  { color: "Negro", size: "M", stock: 3 },
  { color: "Negro", size: "S", stock: 0 },
  { color: "Negro", size: "XS", stock: 5 },
  { color: "Arena", size: "M", stock: 2 },
];

describe("availableByColor", () => {
  it("groups by color with sizes in canonical order and an inStock flag", () => {
    expect(availableByColor(variants)).toEqual([
      { color: "Negro", sizes: [
        { size: "XS", inStock: true },
        { size: "S", inStock: false },
        { size: "M", inStock: true },
      ] },
      { color: "Arena", sizes: [
        { size: "M", inStock: true },
      ] },
    ]);
  });
  it("handles no variants", () => {
    expect(availableByColor([])).toEqual([]);
  });
});
