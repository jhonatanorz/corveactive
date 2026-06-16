import type { Centavos } from "@/domain/money";

export interface POLineCost {
  qtyOrdered: number;
  unitCost: Centavos;
}

/** Total cost of a purchase order, in centavos. */
export function poTotalCost(lines: POLineCost[]): Centavos {
  return lines.reduce((sum, l) => sum + l.qtyOrdered * l.unitCost, 0);
}
