import { describe, it, expect } from "vitest";
import { decrementStock, restoreStock } from "@/domain/stock";

describe("decrementStock", () => {
  it("reduces stock when enough is available", () => {
    expect(decrementStock(5, 2)).toEqual({ ok: true, stock: 3 });
  });

  it("allows reducing to exactly zero", () => {
    expect(decrementStock(2, 2)).toEqual({ ok: true, stock: 0 });
  });

  it("refuses to oversell", () => {
    expect(decrementStock(1, 2)).toEqual({
      ok: false,
      reason: "insufficient_stock",
      available: 1,
    });
  });

  it("rejects a non-positive quantity", () => {
    expect(decrementStock(5, 0)).toEqual({
      ok: false,
      reason: "invalid_qty",
      available: 5,
    });
  });
});

describe("restoreStock", () => {
  it("adds quantity back to stock", () => {
    expect(restoreStock(3, 2)).toBe(5);
  });

  it("is a no-op for zero", () => {
    expect(restoreStock(3, 0)).toBe(3);
  });
});
