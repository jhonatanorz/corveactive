import { describe, it, expect } from "vitest";
import { summarizeSales, type SaleOrder } from "@/domain/sales";

const orders: SaleOrder[] = [
  {
    status: "pagado",
    createdAt: "2026-06-01T10:00:00Z",
    items: [
      { line: "MOVE", unitPrice: 69000, cost: 25000, qty: 1 }, // profit 44000
      { line: "MOVE", unitPrice: 35000, cost: 14000, qty: 2 }, // profit 42000
    ],
  },
  {
    status: "entregado",
    createdAt: "2026-06-05T10:00:00Z",
    items: [{ line: "HIM", unitPrice: 78000, cost: 40000, qty: 1 }], // profit 38000
  },
  {
    status: "nuevo", // not a sale
    createdAt: "2026-06-06T10:00:00Z",
    items: [{ line: "MOVE", unitPrice: 69000, cost: 25000, qty: 1 }],
  },
  {
    status: "cancelado", // not a sale
    createdAt: "2026-06-06T10:00:00Z",
    items: [{ line: "MOVE", unitPrice: 69000, cost: 25000, qty: 1 }],
  },
];

describe("summarizeSales", () => {
  it("totals revenue, units, and profit for paid+ orders only", () => {
    expect(summarizeSales(orders, {})).toEqual({
      revenue: 217000, // 69000 + 70000 + 78000
      units: 4,
      profit: 124000, // 44000 + 42000 + 38000
    });
  });

  it("filters by line", () => {
    expect(summarizeSales(orders, { line: "HIM" })).toEqual({
      revenue: 78000,
      units: 1,
      profit: 38000,
    });
  });

  it("filters by inclusive date range", () => {
    expect(
      summarizeSales(orders, { from: "2026-06-02", to: "2026-06-30" }),
    ).toEqual({ revenue: 78000, units: 1, profit: 38000 });
  });

  it("returns zeroes when nothing matches", () => {
    expect(summarizeSales([], {})).toEqual({ revenue: 0, units: 0, profit: 0 });
  });
});
