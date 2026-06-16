import { describe, it, expect } from "vitest";
import { validateProductInput } from "@/lib/admin/product-input";

const valid = {
  name: "Legging Aurora",
  line: "MOVE",
  type: "legging",
  description: "Te abraza sin apretar.",
  price: "690",
  cost: "250",
  status: "active",
};

describe("validateProductInput", () => {
  it("accepts valid input and converts money to centavos", () => {
    const r = validateProductInput(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({
        name: "Legging Aurora",
        line: "MOVE",
        type: "legging",
        description: "Te abraza sin apretar.",
        price: 69000,
        cost: 25000,
        status: "active",
      });
    }
  });

  it("trims the name and rejects when empty", () => {
    const r = validateProductInput({ ...valid, name: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toBeDefined();
  });

  it("rejects an invalid line", () => {
    const r = validateProductInput({ ...valid, line: "FLOW" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.line).toBeDefined();
  });

  it("rejects an invalid status", () => {
    const r = validateProductInput({ ...valid, status: "live" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.status).toBeDefined();
  });

  it("rejects an unparseable price", () => {
    const r = validateProductInput({ ...valid, price: "abc" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.price).toBeDefined();
  });

  it("defaults cost to 0 when blank", () => {
    const r = validateProductInput({ ...valid, cost: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.cost).toBe(0);
  });
});
