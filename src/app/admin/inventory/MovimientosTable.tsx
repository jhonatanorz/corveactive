"use client";

import { useState } from "react";
import { Table, THead, Th, Td, Tr } from "@/components/ui";

export type MovRow = { id: string; label: string; sub: string | null; delta: number; date: string };

const dateInput = "block rounded-sm border border-line bg-white p-1.5 text-sm text-ink";

export function MovimientosTable({ movements }: { movements: MovRow[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = movements.filter((m) => {
    const day = m.date.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Movimientos</h2>
        <div className="flex items-end gap-2">
          <label className="text-xs text-ink-2">Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={dateInput} /></label>
          <label className="text-xs text-ink-2">Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={dateInput} /></label>
          {(from || to) && (
            <button type="button" onClick={() => { setFrom(""); setTo(""); }} className="pb-1.5 text-xs text-royal hover:underline">
              Limpiar
            </button>
          )}
        </div>
      </div>
      <Table>
        <THead>
          <Th className="w-32">Fecha</Th>
          <Th>Movimiento</Th>
          <Th className="text-right">Cantidad</Th>
        </THead>
        <tbody>
          {filtered.map((m) => (
            <Tr key={m.id}>
              <Td className="text-ink-2">{m.date.slice(0, 10)}</Td>
              <Td>
                <span className="text-ink">{m.label}</span>
                {m.sub && <span className="text-ink-3"> · {m.sub}</span>}
              </Td>
              <Td className={`text-right font-medium ${m.delta >= 0 ? "text-green-700" : "text-orange-700"}`}>
                {m.delta >= 0 ? "+" : ""}{m.delta}
              </Td>
            </Tr>
          ))}
          {filtered.length === 0 && (
            <Tr>
              <Td colSpan={3} className="py-8 text-center text-ink-3">
                {movements.length === 0 ? "Sin movimientos aún." : "Sin movimientos en el rango."}
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
    </section>
  );
}
