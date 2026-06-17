import { parsePesosInput, type Centavos } from "@/domain/money";
import type { Line, ProductStatus } from "@/domain/types";

const LINES: Line[] = ["MOVE", "HIM"];
const STATUSES: ProductStatus[] = ["draft", "active", "hidden"];

export interface ProductPayload {
  name: string;
  line: Line;
  type: string;
  description: string;
  price: Centavos;
  status: ProductStatus;
}

export type ValidationResult =
  | { ok: true; value: ProductPayload }
  | { ok: false; errors: Record<string, string> };

/** Validate + normalize raw product form fields. Money fields are pesos strings. */
export function validateProductInput(raw: Record<string, string>): ValidationResult {
  const errors: Record<string, string> = {};

  const name = (raw.name ?? "").trim();
  if (name === "") errors.name = "El nombre es obligatorio";

  const line = raw.line as Line;
  if (!LINES.includes(line)) errors.line = "Línea inválida";

  const status = raw.status as ProductStatus;
  if (!STATUSES.includes(status)) errors.status = "Estado inválido";

  const type = (raw.type ?? "").trim();
  if (type === "") errors.type = "El tipo es obligatorio";

  const price = parsePesosInput(raw.price ?? "");
  if (price === null) errors.price = "Precio inválido";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      line,
      type,
      description: (raw.description ?? "").trim(),
      price: price as Centavos,
      status,
    },
  };
}
