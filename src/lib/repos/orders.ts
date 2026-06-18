import "server-only";
import { createClient } from "@/lib/supabase/server";
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
  unit_price: number; cost: number; qty: number; product_id: string | null;
}

export async function getOrder(id: string): Promise<{ order: OrderRow; items: OrderItemRow[] } | null> {
  const supabase = await createClient();
  const { data: order, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!order) return null;
  const { data: items, error: iErr } = await supabase
    .from("order_items")
    .select("id,product_name,line,color,size,unit_price,cost,qty,variants(product_id)")
    .eq("order_id", id);
  if (iErr) throw iErr;
  type RawItem = Omit<OrderItemRow, "product_id"> & {
    variants: { product_id: string } | { product_id: string }[] | null;
  };
  const mapped: OrderItemRow[] = ((items ?? []) as RawItem[]).map((it) => {
    const v = it.variants;
    const product_id = Array.isArray(v) ? (v[0]?.product_id ?? null) : (v?.product_id ?? null);
    return {
      id: it.id, product_name: it.product_name, line: it.line, color: it.color, size: it.size,
      unit_price: it.unit_price, cost: it.cost, qty: it.qty, product_id,
    };
  });
  return { order: order as OrderRow, items: mapped };
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
 * Cancel an order via the atomic cancel_order RPC: in one transaction it restores
 * each item's stock exactly once (guarded by stock_restored), logs a 'cancelacion'
 * movement per variant, and sets status 'cancelado'. Idempotent — a retry is a no-op.
 */
export async function cancelOrder(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order_id: id });
  if (error) throw error;
}
