import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, listImages } from "@/lib/repos/products";
import { saveProduct, addVariant, editVariant, uploadImage, deleteImage } from "./actions";
import ProductForm from "./ProductForm";
import { Button, Card, Eyebrow, ImageUploader } from "@/components/ui";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const sizeRank = (s: string) => {
  const i = SIZE_ORDER.indexOf(s.trim().toUpperCase());
  return i === -1 ? 999 : i;
};

const fieldClass =
  "rounded-sm border border-line bg-white p-1 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40";

export default async function ProductEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const existing = id === "new" ? null : await getProduct(id);
  if (id !== "new" && !existing) notFound();
  const images = id === "new" ? [] : await listImages(id);
  const variants = existing?.variants ?? [];
  const colors = [...new Set(variants.map((v) => v.color))];
  const sortedVariants = [...variants].sort(
    (a, b) => a.color.localeCompare(b.color) || sizeRank(a.size) - sizeRank(b.size) || a.size.localeCompare(b.size),
  );

  return (
    <div className="p-6">
      <div className="grid max-w-5xl gap-8 lg:grid-cols-2">
        <div>
          <ProductForm product={existing?.product ?? null} action={saveProduct.bind(null, id)} />
        </div>

        {id !== "new" && (
          <div className="space-y-6 text-sm">
            {/* Imágenes */}
            <Card className="space-y-3 p-4">
              <Eyebrow>Imágenes</Eyebrow>
              {images.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {images.map((img) => (
                    <div key={img.id} className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" className="h-20 w-16 rounded object-cover" />
                      <div className="text-[10px] text-ink-2">{img.color ?? "Default"}</div>
                      <form action={deleteImage.bind(null, id)}>
                        <input type="hidden" name="imageId" value={img.id} />
                        <button className="text-[10px] text-red-600">eliminar</button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
              <ImageUploader action={uploadImage.bind(null, id)} colors={colors} />
            </Card>

            {/* Variantes */}
            <Card className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <Eyebrow>Variantes (color × talla)</Eyebrow>
                <Link href="/admin/inventory" className="text-xs text-royal hover:underline">
                  Ajustar existencias →
                </Link>
              </div>
              <ul className="space-y-1">
                {sortedVariants.map((v) => (
                  <li key={v.id} className="border-b border-line/60 py-1 last:border-0">
                    <form action={editVariant.bind(null, id)} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="variantId" value={v.id} />
                      <input name="color" defaultValue={v.color} placeholder="Color" aria-label="Color" className={`w-24 ${fieldClass}`} />
                      <input name="color_hex" type="color" defaultValue={v.color_hex} aria-label="Color" className="h-8 w-9" />
                      <input name="size" defaultValue={v.size} placeholder="Talla" aria-label="Talla" className={`w-16 ${fieldClass}`} />
                      <Button type="submit" variant="ghost" size="sm">Guardar</Button>
                      <span className="ml-auto text-ink-2">stock {v.stock}</span>
                    </form>
                  </li>
                ))}
                {variants.length === 0 && <li className="text-ink-3">Sin variantes aún.</li>}
              </ul>

              {/* Add variant — separated from the editable list; stock starts at 0 (set on Inventario) */}
              <div className="mt-3 border-t border-line pt-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Nueva variante</div>
                <form action={addVariant.bind(null, id)} className="flex flex-wrap items-end gap-2">
                  <input name="color" placeholder="Color" className={`w-24 ${fieldClass}`} />
                  <input name="color_hex" type="color" defaultValue="#000000" className="h-8 w-10" />
                  <input name="size" placeholder="Talla" className={`w-16 ${fieldClass}`} />
                  <Button type="submit" variant="ghost" size="sm">+ Variante</Button>
                </form>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
