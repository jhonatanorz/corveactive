export interface Lot {
  qty_remaining: number;
  unit_cost: number; // centavos
}

/** Weighted-average cost of the remaining on-hand lots (centavos), or null if nothing on hand. */
export function currentCost(lots: Lot[]): number | null {
  const onHand = lots.reduce((s, l) => s + l.qty_remaining, 0);
  if (onHand <= 0) return null;
  const value = lots.reduce((s, l) => s + l.qty_remaining * l.unit_cost, 0);
  return Math.round(value / onHand);
}

/** Total value of on-hand inventory (centavos). */
export function inventoryValue(lots: Lot[]): number {
  return lots.reduce((s, l) => s + l.qty_remaining * l.unit_cost, 0);
}
