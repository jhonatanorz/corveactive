import { notFound } from "next/navigation";
import { getActiveProduct } from "@/lib/repos/catalog";
import { formatMXN } from "@/domain/money";
import AddToCart from "./AddToCart";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getActiveProduct(id);
  if (!detail) notFound();
  const { product, variants } = detail;

  return (
    <main>
      <div className="h-72 bg-gradient-to-br from-[#d8c1ad] to-[#9a7a61]" />
      <div className="p-4">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <div className="opacity-70 mb-2">{formatMXN(product.price)} · CORVE {product.line}</div>
        {product.description && <p className="italic text-sm opacity-80">{product.description}</p>}
      </div>
      <AddToCart
        productId={product.id}
        productName={product.name}
        price={product.price}
        variants={variants.map((v) => ({ id: v.id, color: v.color, size: v.size, stock: v.stock }))}
      />
    </main>
  );
}
