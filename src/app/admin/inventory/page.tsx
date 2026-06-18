import { createClient } from "@/lib/supabase/server";
import { listMovements, totalInventoryValue, allVariantLots } from "@/lib/repos/inventory";
import { currentCost } from "@/domain/inventory";
import { formatMXN } from "@/domain/money";
import { Button, Card, KpiCard, PageHeader, Table, THead, Th, Td, Tr } from "@/components/ui";
import type { VariantRow } from "@/lib/db-types";
import { correctVariant } from "./actions";

const fieldClass =
  "rounded-sm border border-line bg-white p-1 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: variants, error } = await supabase
    .from("variants").select("*, products(name)").order("stock", { ascending: true });
  if (error) throw error;
  const [movements, invValue, lotsByVariant] = await Promise.all([
    listMovements(50),
    totalInventoryValue(),
    allVariantLots(),
  ]);
  const rows = (variants ?? []) as (VariantRow & { products: { name: string } | null })[];

  return (
    <div className="p-6 space-y-6 text-sm">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h1 className="text-lg font-bold mb-3 text-ink">Existencias</h1>
          <Table>
            <THead>
              <Th>Variante</Th>
              <Th>Costo</Th>
              <Th>Stock</Th>
              <Th>Corregir existencia</Th>
            </THead>
            <tbody>
              {rows.map((v) => {
                const cc = currentCost(lotsByVariant[v.id] ?? []);
                return (
                  <Tr key={v.id}>
                    <Td>
                      <span className="text-ink">{v.products?.name ?? "—"}</span>
                      <span className="text-ink-3"> · {v.color} · {v.size}</span>
                    </Td>
                    <Td className="text-ink-2">{cc === null ? "—" : formatMXN(cc)}</Td>
                    <Td className={v.stock <= 1 ? "font-semibold text-red-600" : "text-ink"}>{v.stock}</Td>
                    <Td>
                      <form action={correctVariant} className="flex flex-wrap items-center gap-1">
                        <input type="hidden" name="variantId" value={v.id} />
                        <input type="hidden" name="productId" value={v.product_id} />
                        <input name="target" type="number" min="0" defaultValue={v.stock} aria-label="Nueva existencia"
                          className={`w-16 ${fieldClass}`} />
                        <input name="reason" placeholder="motivo" aria-label="Motivo" className={`w-24 ${fieldClass}`} />
                        <input name="cost" type="text" inputMode="decimal" placeholder="costo (si sube)" aria-label="Costo si sube"
                          className={`w-24 ${fieldClass}`} />
                        <Button type="submit" variant="ghost" size="sm">Corregir</Button>
                      </form>
                    </Td>
                  </Tr>
                );
              })}
              {rows.length === 0 && (
                <Tr><Td colSpan={4} className="py-8 text-center text-ink-3">Sin variantes.</Td></Tr>
              )}
            </tbody>
          </Table>
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3 text-ink">Movimientos</h2>
          <Card className="p-3">
            <ul className="space-y-1">
              {movements.map((m) => (
                <li key={m.id} className="flex justify-between border-b border-line/70 py-1 last:border-0 text-ink">
                  <span>{m.type}{m.reference ? ` · ${m.reference}` : ""}{m.reason ? ` · ${m.reason}` : ""}</span>
                  <span className={m.delta >= 0 ? "text-green-700" : "text-orange-700"}>
                    {m.delta >= 0 ? "+" : ""}{m.delta}
                  </span>
                </li>
              ))}
              {movements.length === 0 && <li className="text-ink-3">Sin movimientos aún.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
