import "server-only";
import { cookies } from "next/headers";

const KEY = "admin_flash";

export type FlashTone = "ok" | "error";

/** Queue a one-shot message, shown as a toast on the next render. Call from a
 *  server action right after a successful mutation (before any redirect). */
export async function setFlash(message: string, tone: FlashTone = "ok"): Promise<void> {
  const store = await cookies();
  store.set(KEY, JSON.stringify({ m: message, id: Date.now(), t: tone }), {
    path: "/",
    maxAge: 15,
    httpOnly: false,
    sameSite: "lax",
  });
}

/** Read the raw flash cookie value (consumed/cleared client-side by the Toaster). */
export async function readFlash(): Promise<string | null> {
  const store = await cookies();
  return store.get(KEY)?.value ?? null;
}

/** Map a thrown error (often a Postgres/RPC error) to a friendly Spanish message. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/insufficient_lots|insufficient_stock/.test(msg)) return "Existencia insuficiente";
  if (/exceeds_outstanding/.test(msg)) return "Cantidad mayor a la pendiente por recibir";
  if (/duplicate key|23505|product_id_color_size/.test(msg)) return "Ya existe una variante con ese color y talla";
  return "No se pudo completar la acción";
}

/** Run a mutation and queue a success toast, or a friendly error toast if it throws.
 *  The caller should revalidate afterwards so the toast renders either way. */
export async function withFlash(success: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    await setFlash(success);
  } catch (e) {
    await setFlash(friendlyError(e), "error");
  }
}
