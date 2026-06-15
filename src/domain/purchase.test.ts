import { describe, it, expect } from "vitest";
import { receivePurchaseOrder, type POLine } from "@/domain/purchase";

const lines: POLine[] = [
  { variantId: "v1", unitCost: 25000, qtyOrdered: 10, qtyReceived: 0 },
  { variantId: "v2", unitCost: 25000, qtyOrdered: 10, qtyReceived: 4 },
  { variantId: "v3", unitCost: 14000, qtyOrdered: 5, qtyReceived: 0 },
];

describe("receivePurchaseOrder", () => {
  it("applies receipts and reports per-variant deltas", () => {
    const result = receivePurchaseOrder(lines, { v1: 10, v2: 6, v3: 0 });
    expect(result.deltas).toEqual([
      { variantId: "v1", delta: 10, unitCost: 25000 },
      { variantId: "v2", delta: 6, unitCost: 25000 },
    ]);
  });

  it("marks the PO fully received when every line is complete", () => {
    const result = receivePurchaseOrder(lines, { v1: 10, v2: 6, v3: 5 });
    expect(result.status).toBe("recibida");
    expect(result.updatedLines.every((l) => l.qtyReceived === l.qtyOrdered)).toBe(true);
  });

  it("marks the PO partial when some quantity is still outstanding", () => {
    const result = receivePurchaseOrder(lines, { v1: 10, v2: 6, v3: 0 });
    expect(result.status).toBe("parcial");
  });

  it("ignores zero receipts (no delta produced)", () => {
    const result = receivePurchaseOrder(lines, { v1: 0, v2: 0, v3: 0 });
    expect(result.deltas).toEqual([]);
    expect(result.status).toBe("parcial");
  });

  it("throws when a receipt exceeds the outstanding quantity", () => {
    // v2 has 10 ordered, 4 already received -> only 6 outstanding; 7 is too many
    expect(() => receivePurchaseOrder(lines, { v2: 7 })).toThrow(/exceeds outstanding/);
  });

  it("throws on a negative receipt", () => {
    expect(() => receivePurchaseOrder(lines, { v1: -1 })).toThrow(/negative/);
  });
});
