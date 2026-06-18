// src/lib/repos/catalog.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductRow, VariantRow, ProductImageRow } from "@/lib/db-types";

export interface CatalogProduct extends ProductRow {
  product_images: ProductImageRow[];
  product_lines: { slug: string };
}

export interface CatalogItem {
  id: string;
  name: string;
  price: number; // centavos
  lineSlug: string;
  categorySlug: string;
  categoryName: string;
  images: { url: string; color: string | null }[];
  colors: { color: string; color_hex: string }[];
}

const CATALOG_SELECT =
  "id,name,price,product_lines!inner(slug),product_categories!inner(slug,name),product_images(url,color),variants(color,color_hex)";

type CatalogRaw = {
  id: string;
  name: string;
  price: number;
  product_lines: { slug: string } | { slug: string }[];
  product_categories: { slug: string; name: string } | { slug: string; name: string }[];
  product_images: { url: string; color: string | null }[] | null;
  variants: { color: string; color_hex: string }[] | null;
};

const one = <T,>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v);

function toItem(r: CatalogRaw): CatalogItem {
  const line = one(r.product_lines);
  const cat = one(r.product_categories);
  return {
    id: r.id,
    name: r.name,
    price: r.price,
    lineSlug: line.slug,
    categorySlug: cat.slug,
    categoryName: cat.name,
    images: r.product_images ?? [],
    colors: r.variants ?? [],
  };
}

/** All active products, shaped for client-side browse/filter. */
export async function listActiveCatalog(): Promise<CatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(CATALOG_SELECT)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as CatalogRaw[]).map(toItem);
}

/** Active products for one line (by line id). */
export async function listActiveCatalogByLine(lineId: string): Promise<CatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(CATALOG_SELECT)
    .eq("status", "active")
    .is("deleted_at", null)
    .eq("line_id", lineId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as CatalogRaw[]).map(toItem);
}

export interface ProductDetail {
  product: CatalogProduct;
  variants: VariantRow[];
}

/** A single active product with images + line slug + variants. Null if not active/found. */
export async function getActiveProduct(id: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("*, product_images(*), product_lines(slug)")
    .eq("id", id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!product) return null;
  const { data: variants, error: vErr } = await supabase
    .from("variants").select("*").eq("product_id", id);
  if (vErr) throw vErr;
  const p = product as { product_lines: { slug: string } | { slug: string }[] } & Record<string, unknown>;
  const normalized = { ...p, product_lines: one(p.product_lines) } as unknown as CatalogProduct;
  return { product: normalized, variants: (variants ?? []) as VariantRow[] };
}
