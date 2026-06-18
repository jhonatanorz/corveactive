"use server";

import { revalidatePath } from "next/cache";
import { setOrderStatus, cancelOrder } from "@/lib/repos/orders";
import { withFlash } from "@/lib/flash";
import type { OrderStatus } from "@/domain/types";

export async function changeStatus(id: string, formData: FormData): Promise<void> {
  const status = String(formData.get("status") ?? "") as OrderStatus;
  await withFlash("Estado del pedido actualizado", () => setOrderStatus(id, status));
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
}

export async function cancel(id: string): Promise<void> {
  await withFlash("Pedido cancelado", () => cancelOrder(id));
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/inventory");
}
