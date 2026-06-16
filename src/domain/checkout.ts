export interface CheckoutInput {
  name: string;
  whatsapp: string;
  itemCount: number;
}

export type CheckoutValidation =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

/** Validate the guest checkout form (name, WhatsApp with >=10 digits, non-empty cart). */
export function validateCheckout(input: CheckoutInput): CheckoutValidation {
  const errors: Record<string, string> = {};
  if (input.name.trim() === "") errors.name = "Tu nombre es obligatorio";
  const digits = input.whatsapp.replace(/\D/g, "");
  if (digits.length < 10) errors.whatsapp = "WhatsApp inválido (incluye lada)";
  if (input.itemCount <= 0) errors.cart = "Tu carrito está vacío";
  return Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };
}
