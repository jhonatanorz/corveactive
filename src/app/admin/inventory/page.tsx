import { createClient } from "@/lib/supabase/server";
import { listMovements, totalInventoryValue, allVariantLots } from "@/lib/repos/inventory";
import { imagesByProducts } from "@/lib/repos/products";
import { currentCost } from "@/domain/inventory";
import { pickProductImage } from "@/domain/product-image";
import { formatMXN } from "@/domain/money";
import { KpiCard, PageHeader, Table, THead, Th, Td, Tr } from "@/components/ui";
import type { VariantRow } from "@/lib/db-types";
import { ExistenciasTable, type ExistenciaRow } from "./ExistenciasTable";

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

      <section>
        <h2 className="text-lg font-bold mb-3 text-ink">Movimientos</h2>
        <Table>
          <THead>
            <Th>Movimiento</Th>
            <Th>Cantidad</Th>
            <Th>Fecha</Th>
          </THead>
          <tbody>
            {movements.map((m) => (
              <Tr key={m.id}>
                <Td>
                  <span className="text-ink">{m.type}</span>
                  {(m.reference || m.reason) && (
                    <span className="text-ink-3"> · {m.reference ?? m.reason}</span>
                  )}
                </Td>
                <Td className={m.delta >= 0 ? "font-medium text-green-700" : "font-medium text-orange-700"}>
                  {m.delta >= 0 ? "+" : ""}{m.delta}
                </Td>
                <Td className="text-ink-2">{m.created_at.slice(0, 10)}</Td>
              </Tr>
            ))}
            {movements.length === 0 && (
              <Tr><Td colSpan={3} className="py-8 text-center text-ink-3">Sin movimientos aún.</Td></Tr>
            )}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
