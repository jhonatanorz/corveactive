export type Line = "MOVE" | "HIM";

export type ProductStatus = "draft" | "active" | "hidden";

export type OrderStatus =
  | "nuevo"
  | "confirmado"
  | "pagado"
  | "enviado"
  | "entregado"
  | "cancelado";

/** Statuses that count as a realized sale. */
export const SALE_STATUSES: readonly OrderStatus[] = ["pagado", "enviado", "entregado"];

/**
 * Kinds of stock-ledger movement. Mirrors the SQL `movement_type` enum so the
 * vocabulary is locked in one place: `reabasto` (PO receipt), `pedido` (order
 * decrement), `correccion` (manual adjustment), `cancelacion` (order cancel restore).
 */
export type MovementType = "reabasto" | "pedido" | "correccion" | "cancelacion";
