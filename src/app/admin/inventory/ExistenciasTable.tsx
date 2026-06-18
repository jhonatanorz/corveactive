"use client";

import { useState } from "react";
import { Table, THead, Th, Td, Tr, Button, Thumb } from "@/components/ui";
import { formatMXN } from "@/domain/money";
import { correctVariant } from "./actions";

export type ExistenciaRow = {
  variantId: string;
  productId: string;
  name: string;
  color: string;
  size: string;
  stock: number;
  cost: number | null;
  imageUrl: string | null;
};

const REASONS = ["ajuste", "compra", "merma", "devolución", "dañado", "conteo"];

const fieldClass =
  "rounded-sm border border-line bg-white p-1 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40";

export function ExistenciasTable({ rows }: { rows: ExistenciaRow[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle ? rows.filter((r) => r.name.toLowerCase().includes(needle)) : rows;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Existencias</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto…"
          aria-label="Buscar producto"
          className={`w-56 ${fieldClass} p-2`}
        />
      </div>
      <Table>
        <THead>
          <Th>Variante</Th>
          <Th>Costo</Th>
          <Th>Stock</Th>
          <Th>Corregir existencia</Th>
        </THead>
        <tbody>
          {filtered.map((r) => (
            <Tr key={r.variantId}>
              <Td>
                <div className="flex items-center gap-2">
                  <Thumb src={r.imageUrl} className="h-9 w-7" />
                  <span>
                    <span className="text-ink">{r.name}</span>
                    <span className="text-ink-3"> · {r.color} · {r.size}</span>
                  </span>
                </div>
              </Td>
              <Td className="text-ink-2">{r.cost === null ? "—" : formatMXN(r.cost)}</Td>
              <Td className={r.stock <= 1 ? "font-semibold text-red-600" : "text-ink"}>{r.stock}</Td>
              <Td>
                <form action={correctVariant} className="flex flex-wrap items-center gap-1">
                  <input type="hidden" name="variantId" value={r.variantId} />
                  <input type="hidden" name="productId" value={r.productId} />
                  <input name="target" type="number" min="0" defaultValue={r.stock} aria-label="Nueva existencia" className={`w-16 ${fieldClass}`} />
                  <select name="reason" defaultValue="ajuste" aria-label="Motivo" className={`w-28 capitalize ${fieldClass}`}>
                    {REASONS.map((rs) => (
                      <option key={rs} value={rs}>{rs}</option>
                    ))}
                  </select>
                  <input name="cost" type="text" inputMode="decimal" placeholder="costo (si sube)" aria-label="Costo si sube" className={`w-24 ${fieldClass}`} />
                  <Button type="submit" variant="ghost" size="sm">Corregir</Button>
                </form>
              </Td>
            </Tr>
          ))}
          {filtered.length === 0 && (
            <Tr>
              <Td colSpan={4} className="py-8 text-center text-ink-3">
                {rows.length === 0 ? "Sin variantes." : "Sin resultados."}
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
    </section>
  );
}
