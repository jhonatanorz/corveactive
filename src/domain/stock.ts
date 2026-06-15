export type DecrementResult =
  | { ok: true; stock: number }
  | { ok: false; reason: "insufficient_stock" | "invalid_qty"; available: number };

/** Attempt to remove `qty` units from `current` stock without going negative. */
export function decrementStock(current: number, qty: number): DecrementResult {
  if (qty <= 0) {
    return { ok: false, reason: "invalid_qty", available: current };
  }
  if (qty > current) {
    return { ok: false, reason: "insufficient_stock", available: current };
  }
  return { ok: true, stock: current - qty };
}

/** Add `qty` units back to stock (used by cancellations and corrections). */
export function restoreStock(current: number, qty: number): number {
  return current + Math.max(0, qty);
}
