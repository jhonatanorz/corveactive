import { describe, it, expect } from "vitest";
import { validateCheckout } from "@/domain/checkout";

describe("validateCheckout", () => {
  const ok = { name: "Ana", whatsapp: "5215512345678", itemCount: 2 };
  it("accepts valid checkout", () => {
    expect(validateCheckout(ok)).toEqual({ ok: true });
  });
  it("requires a name", () => {
    const r = validateCheckout({ ...ok, name: "  " });
    expect(r).toEqual({ ok: false, errors: { name: "Tu nombre es obligatorio" } });
  });
  it("requires a whatsapp with at least 10 digits", () => {
    const r = validateCheckout({ ...ok, whatsapp: "55-1234" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.whatsapp).toBeDefined();
  });
  it("rejects an empty cart", () => {
    const r = validateCheckout({ ...ok, itemCount: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.cart).toBeDefined();
  });
});
