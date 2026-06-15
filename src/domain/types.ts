export type Line = "MOVE" | "HIM";

export type OrderStatus =
  | "nuevo"
  | "confirmado"
  | "pagado"
  | "enviado"
  | "entregado"
  | "cancelado";

/** Statuses that count as a realized sale. */
export const SALE_STATUSES: readonly OrderStatus[] = ["pagado", "enviado", "entregado"];
