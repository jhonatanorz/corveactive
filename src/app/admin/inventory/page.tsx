import { createClient } from "@/lib/supabase/server";
import { listMovements, totalInventoryValue, allVariantLots } from "@/lib/repos/inventory";
import { imagesByProducts } from "@/lib/repos/products";
import { currentCost } from "@/domain/inventory";
import { pickProductImage } from "@/domain/product-image";
import { formatMXN } from "@/domain/money";
import { KpiCard, PageHeader } from "@/components/ui";
import type { VariantRow } from "@/lib/db-types";
import { ExistenciasTable, type ExistenciaRow } from "./ExistenciasTable";
import { MovimientosTable, type MovRow } from "./MovimientosTable";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: variants, error } = await supabase
    .from("variants").select("*, products(name)").order("stock", { ascending: true });
  if (error) throw error;
  const rows = (variants ?? []) as (VariantRow & { products: { name: string } | null })[];
  const [movements, invValue, lotsByVariant, imgByProduct] = await Promise.all([
    listMovements(50),
    totalInventoryValue(),
    allVariantLots(),
    imagesByProducts(rows.map((r) => r.product_id)),
  ]);

  const existencias: ExistenciaRow[] = rows.map((v) => ({
    variantId: v.id,
    productId: v.product_id,
    name: v.products?.name ?? "—",
    color: v.color,
    size: v.size,
    stock: v.stock,
    cost: currentCost(lotsByVariant[v.id] ?? []),
    imageUrl: pickProductImage(imgByProduct[v.product_id] ?? [], v.color),
  }));

  const movRows: MovRow[] = movements.map((m) => ({
    id: m.id,
    label: m.type,
    sub: m.reference ?? m.reason ?? null,
    delta: m.delta,
    date: m.created_at,
  }));

  return (
    <div className="p-6 space-y-8 text-sm">
      <PageHeader title="Inventario" />

      <KpiCard
        label="Valor de inventario"
        value={formatMXN(invValue)}
        className="max-w-xs"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        }
      />

      <ExistenciasTable rows={existencias} />

      <MovimientosTable movements={movRows} />
    </div>
  );
}
