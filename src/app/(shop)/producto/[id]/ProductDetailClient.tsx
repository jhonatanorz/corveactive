"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { availableByColor, type AvailVariant } from "@/domain/availability";
import { pickProductImage, imagesForColor, type ImageChoice } from "@/domain/product-image";
import type { ColorOption } from "@/domain/product-colors";
import { formatMXN } from "@/domain/money";
import { Button, Eyebrow, FadeImage, FloatingBar } from "@/components/ui";

interface VariantLite extends AvailVariant { id: string }

type Props = {
  productId: string;
  productName: string;
  price: number;
  line: string;
  description: string;
  variants: VariantLite[];
  images: ImageChoice[];
  colors: ColorOption[];
};

export default function ProductDetailClient({ productId, productName, price, line, description, variants, images, colors }: Props) {
  const router = useRouter();
  const { add } = useCart();
  const byColor = availableByColor(variants);
  const [color, setColor] = useState(colors[0]?.color ?? "");
  const [size, setSize] = useState("");
  const [activeUrl, setActiveUrl] = useState<string | null>(() => pickProductImage(images, colors[0]?.color ?? null));
  const [added, setAdded] = useState(false);

  const sizes = byColor.find((c) => c.color === color)?.sizes ?? [];
  const chosen = variants.find((v) => v.color === color && v.size === size);
  const gallery = imagesForColor(images, color);

  useEffect(() => {
    if (!added) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAdded(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [added]);

  function selectColor(c: string) {
    setColor(c);
    setSize("");
    setActiveUrl(pickProductImage(images, c));
  }
  function selectThumb(img: ImageChoice) {
    setActiveUrl(img.url);
  }

  return (
    <main className="md:flex md:gap-6 md:max-w-4xl md:mx-auto md:p-6 pb-28">
      {/* gallery */}
      <div className="md:w-1/2 md:flex md:gap-3">
        <div className="order-1 md:order-2 relative aspect-[3/4] md:flex-1 md:self-start bg-mist overflow-hidden">
          <FadeImage src={activeUrl} alt={productName} sizes="(min-width:768px) 40vw, 100vw" />
        </div>
        {gallery.length > 1 && (
          <div className="order-2 md:order-1 flex md:flex-col gap-2 p-3 md:p-0 overflow-x-auto md:overflow-visible">
            {gallery.map((img) => (
              <button
                key={img.url}
                type="button"
                aria-label="Ver imagen"
                onClick={() => selectThumb(img)}
                className={`relative w-16 h-20 shrink-0 rounded-md overflow-hidden bg-mist border transition ${activeUrl === img.url ? "ring-2 ring-royal border-transparent" : "border-line"}`}
              >
                <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* info */}
      <div className="md:w-1/2">
        <div className="p-4">
          <h1 className="text-2xl font-semibold text-ink">{productName}</h1>
          <div className="text-ink-2 mb-2">{formatMXN(price)} · CORVE {line}</div>
          {description && <p className="italic text-sm text-ink-2">{description}</p>}
        </div>
        <div className="p-4 space-y-3">
          <Eyebrow>Color</Eyebrow>
          <div className="flex gap-2">
            {colors.map((c) => (
              <button
                key={c.color}
                type="button"
                aria-label={c.color}
                onClick={() => selectColor(c.color)}
                className={`w-7 h-7 rounded-pill border border-line transition ${color === c.color ? "ring-2 ring-royal ring-offset-1" : ""}`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <Eyebrow>Talla</Eyebrow>
          <div className="flex gap-2">
            {sizes.map((s) => (
              <button key={s.size} disabled={!s.inStock} onClick={() => setSize(s.size)}
                className={`px-3 py-1 rounded-pill border text-sm transition ${s.size === size ? "bg-periwinkle-2 text-royal border-transparent" : "border-line-strong text-ink"} ${!s.inStock ? "opacity-30 line-through" : ""}`}>
                {s.size}
              </button>
            ))}
          </div>
        </div>
      </div>
      <FloatingBar>
        <Button variant="primary" disabled={!chosen} className="w-full"
          onClick={() => {
            if (!chosen) return;
            add({ variantId: chosen.id, productId, productName, color, size, unitPrice: price, qty: 1, image: pickProductImage(images, color) });
            setAdded(true);
          }}>
          Agregar · {formatMXN(price)}
        </Button>
      </FloatingBar>

      {added && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Producto agregado al carrito"
          onClick={() => setAdded(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-pill bg-lime">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-ink">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-ink">Agregado al carrito</h2>

            <div className="mt-3 flex items-center justify-center gap-3">
              {pickProductImage(images, color) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pickProductImage(images, color)!} alt="" className="h-14 w-12 rounded-md object-cover" />
              )}
              <div className="text-left text-sm">
                <div className="font-medium text-ink">{productName}</div>
                <div className="text-ink-3">{color} · {size}</div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <Button variant="primary" className="w-full" onClick={() => router.push("/carrito")}>
                Ir al carrito
              </Button>
              <Button variant="soft" className="w-full" onClick={() => router.push("/")}>
                Explorar más productos
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
