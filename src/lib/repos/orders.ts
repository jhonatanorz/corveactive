import "server-only";
import { createClient } from "@/lib/supabase/server";
import { restoreStock } from "@/domain/stock";
import type { OrderStatus } from "@/domain/types";

export interface PlaceOrderInput {
  name: string;
  whatsapp: string;
  note: string;
  items: { variant_id: string; qty: number }[];
}

/** Place a guest order via the atomic place_order RPC. Returns the new order id. */
export async function placeOrder(input: PlaceOrderInput): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_customer_name: input.name,
    p_customer_whatsapp: input.whatsapp,
    p_delivery_note: input.note,
    p_items: input.items,
  });
  if (error) {
    const reason = error.message.includes("insufficient_stock") ? "insufficient_stock" : "error";
    return { ok: false, reason };
  }
  return { ok: true, id: data as string };
}

export interface OrderRow {
  id: string;
  customer_name: string;
  customer_whatsapp: string;
  delivery_note: string | null;
  status: OrderStatus;
  total: number;
  stock_restored: boolean;
  created_at: string;
}
export interface OrderItemRow {
  id: string; product_name: string; line: string; color: string; size: string;
  unit_price: number; cost: number; qty: number;
}

export async function getOrder(id: string): Promise<{ order: OrderRow; items: OrderItemRow[] } | null> {
  const supabase = await createClient();
  const { data: order, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!order) return null;
  const { data: items, error: iErr } = await supabase
    .from("order_items").select("id,product_name,line,color,size,unit_price,cost,qty").eq("order_id", id);
  if (iErr) throw iErr;
  return { order: order as OrderRow, items: (items ?? []) as OrderItemRow[] };
}

export async function listOrders(): Promise<OrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
}

/**
 * Cancel an order: set status 'cancelado' and restore each item's stock exactly once
 * (guarded by stock_restored), logging a 'cancelacion' movement per variant.
 */
export async function cancelOrder(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders").select("id, stock_restored").eq("id", id).single();
  if (error) throw error;

  if (!(order as { stock_restored: boolean }).stock_restored) {
    const { data: items, error: iErr } = await supabase
      .from("order_items").select("variant_id, qty").eq("order_id", id).not("variant_id", "is", null);
    if (iErr) throw iErr;
    for (const it of (items ?? []) as { variant_id: string; qty: number }[]) {
      const { data: v, error: vErr } = await supabase
        .from("variants").select("stock").eq("id", it.variant_id).single();
      if (vErr) throw vErr;
      const newStock = restoreStock((v as { stock: number }).stock, it.qty);
      const { error: upErr } = await supabase.from("variants").update({ stock: newStock }).eq("id", it.variant_id);
      if (upErr) throw upErr;
      const { error: mvErr } = await supabase.from("stock_movements").insert({
        variant_id: it.variant_id, delta: it.qty, type: "cancelacion", reference: `#${id.slice(0, 8)}`,
      });
      if (mvErr) throw mvErr;
    }
  }
  const { error: stErr } = await supabase
    .from("orders").update({ status: "cancelado", stock_restored: true }).eq("id", id);
  if (stErr) throw stErr;
}
