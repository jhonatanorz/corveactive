"use server";

import { revalidatePath } from "next/cache";
import { adjustStockToTarget } from "@/lib/repos/inventory";
import { parsePesosInput } from "@/domain/money";
import { withFlash } from "@/lib/flash";

/** Correct a variant's stock to an absolute target. An increase optionally takes a
 *  unit cost (centavos) for the new lot; a decrease consumes lots FIFO. */
export async function correctVariant(formData: FormData): Promise<void> {
  const variantId = String(formData.get("variantId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const target = Number(formData.get("target") ?? NaN);
  if (!variantId || !Number.isInteger(target) || target < 0) return;
  const reason = String(formData.get("reason") ?? "").trim() || "Corrección manual";
  const costRaw = String(formData.get("cost") ?? "").trim();
  const unitCost = costRaw === "" ? null : parsePesosInput(costRaw);
  await withFlash("Existencia actualizada", () =>
    adjustStockToTarget(variantId, target, reason, unitCost),
  );
  revalidatePath("/admin/inventory");
  if (productId) revalidatePath(`/admin/products/${productId}`);
}
