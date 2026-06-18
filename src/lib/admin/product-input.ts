import { parsePesosInput, type Centavos } from "@/domain/money";
import type { ProductStatus } from "@/domain/types";

const STATUSES: ProductStatus[] = ["draft", "active", "hidden"];

export interface ProductPayload {
  name: string;
  line_id: string;
  category_id: string;
  description: string;
  price: Centavos;
  status: ProductStatus;
}

export type ValidationResult =
  | { ok: true; value: ProductPayload }
  | { ok: false; errors: Record<string, string> };

/** Validate + normalize raw product form fields. Money fields are pesos strings.
 *  line_id / category_id are required UUIDs from the form dropdowns (FK enforces validity). */
export function validateProductInput(raw: Record<string, string>): ValidationResult {
  const errors: Record<string, string> = {};

  const name = (raw.name ?? "").trim();
  if (name === "") errors.name = "El nombre es obligatorio";

  const line_id = (raw.line_id ?? "").trim();
  if (line_id === "") errors.line_id = "La línea es obligatoria";

  const category_id = (raw.category_id ?? "").trim();
  if (category_id === "") errors.category_id = "La categoría es obligatoria";

  const status = raw.status as ProductStatus;
  if (!STATUSES.includes(status)) errors.status = "Estado inválido";

  const price = parsePesosInput(raw.price ?? "");
  if (price === null) errors.price = "Precio inválido";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      line_id,
      category_id,
      description: (raw.description ?? "").trim(),
      price: price as Centavos,
      status,
    },
  };
}
