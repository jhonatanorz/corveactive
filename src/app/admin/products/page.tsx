import Link from "next/link";
import { listProducts } from "@/lib/repos/products";
import { formatMXN } from "@/domain/money";
import { buttonClass, Eyebrow } from "@/components/ui";

export default async function ProductsPage() {
  const products = await listProducts();
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-ink">Productos</h1>
        <Link href="/admin/products/new" className={buttonClass("primary", "sm")}>
          + Nuevo producto
        </Link>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs">
          <tr>
            <th className="py-2"><Eyebrow>Nombre</Eyebrow></th>
            <th><Eyebrow>Línea</Eyebrow></th>
            <th><Eyebrow>Precio</Eyebrow></th>
            <th><Eyebrow>Estado</Eyebrow></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-t border-line">
              <td className="py-2 text-ink"><Link href={`/admin/products/${p.id}`}>{p.name}</Link></td>
              <td className="text-ink-2">{p.line}</td>
              <td className="text-ink">{formatMXN(p.price)}</td>
              <td className="text-ink-2">{p.status}</td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr><td colSpan={4} className="py-6 text-center text-ink-3">Aún no hay productos.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
