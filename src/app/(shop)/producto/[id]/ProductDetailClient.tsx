"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { availableByColor, type AvailVariant } from "@/domain/availability";
import { pickProductImage, type ImageChoice } from "@/domain/product-image";
import { formatMXN } from "@/domain/money";

interface VariantLite extends AvailVariant { id: string }

type Props = {
  productId: string;
  productName: string;
  price: number;
  line: string;
  description: string;
  variants: VariantLite[];
  images: ImageChoice[];
};

export default function ProductDetailClient({ productId, productName, price, line, description, variants, images }: Props) {
  const router = useRouter();
  const { add } = useCart();
  const colors = availableByColor(variants);
  const [color, setColor] = useState(colors[0]?.color ?? "");
  const [size, setSize] = useState("");

  const sizes = colors.find((c) => c.color === color)?.sizes ?? [];
  const chosen = variants.find((v) => v.color === color && v.size === size);
  const heroUrl = pickProductImage(images, color || null);

  return (
    <main>
      <div className="relative h-72 bg-gradient-to-br from-[#d8c1ad] to-[#9a7a61]">
        {heroUrl && <Image src={heroUrl} alt={productName} fill sizes="100vw" className="object-cover" />}
      </div>
      <div className="p-4">
        <h1 className="text-2xl font-bold">{productName}</h1>
        <div className="opacity-70 mb-2">{formatMXN(price)} · CORVE {line}</div>
        {description && <p className="italic text-sm opacity-80">{description}</p>}
      </div>
      <div className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider opacity-60">Color</div>
        <div className="flex gap-2">
          {colors.map((c) => (
            <button key={c.color} onClick={() => { setColor(c.color); setSize(""); }}
              className={`px-3 py-1 rounded border text-sm ${c.color === color ? "bg-white text-[#161311]" : "border-white/40"}`}>
              {c.color}
            </button>
          ))}
        </div>
        <div className="text-xs uppercase tracking-wider opacity-60">Talla</div>
        <div className="flex gap-2">
          {sizes.map((s) => (
            <button key={s.size} disabled={!s.inStock} onClick={() => setSize(s.size)}
              className={`px-3 py-1 rounded border text-sm ${s.size === size ? "bg-white text-[#161311]" : "border-white/40"} ${!s.inStock ? "opacity-30 line-through" : ""}`}>
              {s.size}
            </button>
          ))}
        </div>
        <button disabled={!chosen}
          onClick={() => {
            if (!chosen) return;
            add({ variantId: chosen.id, productId, productName, color, size, unitPrice: price, qty: 1 });
            router.push("/carrito");
          }}
          className="w-full rounded-xl bg-white text-[#161311] py-3 text-sm disabled:opacity-40">
          Agregar · {formatMXN(price)}
        </button>
      </div>
    </main>
  );
}
