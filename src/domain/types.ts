export type Line = "MOVE" | "HIM";

export type OrderStatus =
  | "nuevo"
  | "confirmado"
  | "pagado"
  | "enviado"
  | "entregado"
  | "cancelado";

/** Statuses that count as a realized sale. */
export const SALE_STATUSES: OrderStatus[] = ["pagado", "enviado", "entregado"];
