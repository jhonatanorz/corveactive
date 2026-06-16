import { describe, it, expect } from "vitest";
import { poTotalCost, type POLineCost } from "@/domain/po-total";

const lines: POLineCost[] = [
  { qtyOrdered: 10, unitCost: 25000 },
  { qtyOrdered: 5, unitCost: 14000 },
];

describe("poTotalCost", () => {
  it("sums qtyOrdered * unitCost in centavos", () => {
    expect(poTotalCost(lines)).toBe(320000); // 250000 + 70000
  });
  it("is 0 for no lines", () => {
    expect(poTotalCost([])).toBe(0);
  });
});
