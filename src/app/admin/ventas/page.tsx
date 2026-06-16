import Link from "next/link";
import { getSalesSummary } from "@/lib/repos/sales";
import { formatMXN } from "@/domain/money";
import type { Line } from "@/domain/types";

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; line?: string }> }) {
  const sp = await searchParams;
  const filter = { from: sp.from, to: sp.to, line: (sp.line as Line | undefined) || undefined };
  const summary = await getSalesSummary(filter);

  const link = (q: Record<string, string>) => "/admin/ventas?" + new URLSearchParams(q).toString();

  return (
    <div className="p-6 max-w-2xl text-sm">
      <h1 className="text-lg font-bold mb-3">Ventas</h1>
      <div className="flex gap-2 mb-4">
        <Link href="/admin/ventas" className={`rounded-full border px-3 py-1 ${!sp.line ? "bg-[#211d1a] text-white" : "border-[#d8cdc0]"}`}>Todo</Link>
        <Link href={link({ line: "MOVE" })} className={`rounded-full border px-3 py-1 ${sp.line === "MOVE" ? "bg-[#211d1a] text-white" : "border-[#d8cdc0]"}`}>MOVE</Link>
        <Link href={link({ line: "HIM" })} className={`rounded-full border px-3 py-1 ${sp.line === "HIM" ? "bg-[#211d1a] text-white" : "border-[#d8cdc0]"}`}>HIM</Link>
      </div>
      <form className="flex gap-2 mb-4 items-end">
        <label className="text-xs">Desde<input name="from" type="date" defaultValue={sp.from} className="block rounded border border-[#d8cdc0] p-1" /></label>
        <label className="text-xs">Hasta<input name="to" type="date" defaultValue={sp.to} className="block rounded border border-[#d8cdc0] p-1" /></label>
        {sp.line && <input type="hidden" name="line" value={sp.line} />}
        <button className="rounded bg-[#211d1a] text-white px-3 py-1">Filtrar</button>
      </form>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#ece5db] p-4"><div className="text-xs uppercase text-[#9a8b7d]">Ingresos</div><div className="text-2xl font-bold">{formatMXN(summary.revenue)}</div></div>
        <div className="rounded-xl border border-[#ece5db] p-4"><div className="text-xs uppercase text-[#9a8b7d]">Unidades</div><div className="text-2xl font-bold">{summary.units}</div></div>
        <div className="rounded-xl border border-[#ece5db] p-4"><div className="text-xs uppercase text-[#9a8b7d]">Ganancia</div><div className="text-2xl font-bold text-[#2f6b3a]">{formatMXN(summary.profit)}</div></div>
      </div>
    </div>
  );
}
