import { createClient } from "@/lib/supabase/server";
import { listMovements } from "@/lib/repos/inventory";
import type { VariantRow } from "@/lib/db-types";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: variants, error } = await supabase
    .from("variants").select("*, products(name)").order("stock", { ascending: true });
  if (error) throw error;
  const movements = await listMovements(50);
  const rows = (variants ?? []) as (VariantRow & { products: { name: string } | null })[];

  return (
    <div className="p-6 grid grid-cols-2 gap-8 text-sm">
      <div>
        <h1 className="text-lg font-bold mb-3">Inventario</h1>
        <table className="w-full">
          <thead className="text-left text-xs text-[#9a8b7d]"><tr><th>Variante</th><th>Stock</th></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-t border-[#f3efe9]">
                <td className="py-1">{v.products?.name ?? "—"} · {v.color} · {v.size}</td>
                <td className={v.stock <= 1 ? "text-[#a85a23]" : ""}>{v.stock}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={2} className="py-4 text-[#9a8b7d]">Sin variantes.</td></tr>}
          </tbody>
        </table>
      </div>
      <div>
        <h2 className="text-lg font-bold mb-3">Movimientos</h2>
        <ul className="space-y-1">
          {movements.map((m) => (
            <li key={m.id} className="flex justify-between border-b border-[#f3efe9] py-1">
              <span>{m.type}{m.reference ? ` · ${m.reference}` : ""}{m.reason ? ` · ${m.reason}` : ""}</span>
              <span className={m.delta >= 0 ? "text-[#2f6b3a]" : "text-[#9a5a1c]"}>
                {m.delta >= 0 ? "+" : ""}{m.delta}
              </span>
            </li>
          ))}
          {movements.length === 0 && <li className="text-[#9a8b7d]">Sin movimientos aún.</li>}
        </ul>
      </div>
    </div>
  );
}
