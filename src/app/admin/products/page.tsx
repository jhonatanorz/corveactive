import Link from "next/link";
import { listProducts } from "@/lib/repos/products";
import { formatMXN } from "@/domain/money";
import { calcMargin } from "@/domain/margin";

export default async function ProductsPage() {
  const products = await listProducts();
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Productos</h1>
        <Link href="/admin/products/new" className="rounded-md bg-[#211d1a] text-white text-sm px-3 py-2">
          + Nuevo producto
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[#9a8b7d] text-xs">
          <tr><th className="py-2">Nombre</th><th>Línea</th><th>Precio</th><th>Margen</th><th>Estado</th></tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const m = calcMargin(p.price, p.cost);
            return (
              <tr key={p.id} className="border-t border-[#eadfd3]">
                <td className="py-2"><Link href={`/admin/products/${p.id}`}>{p.name}</Link></td>
                <td>{p.line}</td>
                <td>{formatMXN(p.price)}</td>
                <td>{formatMXN(m.amount)} · {m.pct}%</td>
                <td>{p.status}</td>
              </tr>
            );
          })}
          {products.length === 0 && (
            <tr><td colSpan={5} className="py-6 text-center text-[#9a8b7d]">Aún no hay productos.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
