import { describe, it, expect } from "vitest";
import { currentCost, inventoryValue, type Lot } from "@/domain/inventory";

const lots: Lot[] = [
  { qty_remaining: 2, unit_cost: 10000 },
  { qty_remaining: 3, unit_cost: 20000 },
];

describe("currentCost", () => {
  it("weighted-averages the remaining lots", () => {
    expect(currentCost(lots)).toBe(16000); // (2*10000 + 3*20000)/5
  });
  it("rounds to the nearest centavo", () => {
    expect(currentCost([{ qty_remaining: 3, unit_cost: 100 }, { qty_remaining: 0, unit_cost: 999 }])).toBe(100);
  });
  it("returns null when nothing is on hand", () => {
    expect(currentCost([{ qty_remaining: 0, unit_cost: 100 }])).toBeNull();
    expect(currentCost([])).toBeNull();
  });
});

describe("inventoryValue", () => {
  it("sums qty_remaining × unit_cost", () => {
    expect(inventoryValue(lots)).toBe(80000);
  });
  it("is 0 for no lots", () => {
    expect(inventoryValue([])).toBe(0);
  });
});
