import type { Centavos } from "@/domain/money";

export interface POLine {
  variantId: string;
  unitCost: Centavos;
  qtyOrdered: number;
  qtyReceived: number;
}

export type POStatus = "borrador" | "pedida" | "parcial" | "recibida" | "cancelada";

export interface StockDelta {
  variantId: string;
  delta: number;
  unitCost: Centavos;
}

export interface ReceiveResult {
  updatedLines: POLine[];
  deltas: StockDelta[];
  status: Extract<POStatus, "parcial" | "recibida">;
}

/**
 * Apply a batch of newly-received quantities (keyed by variantId) to a PO's lines.
 * Returns updated line receipts, the per-variant stock deltas to apply and log,
 * and the resulting PO status. Throws on invalid receipts.
 */
export function receivePurchaseOrder(
  lines: POLine[],
  received: Record<string, number>,
): ReceiveResult {
  const deltas: StockDelta[] = [];

  const updatedLines = lines.map((line) => {
    const add = received[line.variantId] ?? 0;
    if (add < 0) {
      throw new Error(`Receipt for ${line.variantId} is negative`);
    }
    const outstanding = line.qtyOrdered - line.qtyReceived;
    if (add > outstanding) {
      throw new Error(
        `Receipt for ${line.variantId} (${add}) exceeds outstanding (${outstanding})`,
      );
    }
    if (add > 0) {
      deltas.push({ variantId: line.variantId, delta: add, unitCost: line.unitCost });
    }
    return { ...line, qtyReceived: line.qtyReceived + add };
  });

  const complete = updatedLines.every((l) => l.qtyReceived >= l.qtyOrdered);
  return { updatedLines, deltas, status: complete ? "recibida" : "parcial" };
}
