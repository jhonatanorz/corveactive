"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { availableByColor, type AvailVariant } from "@/domain/availability";
import { formatMXN } from "@/domain/money";

interface VariantLite extends AvailVariant { id: string }

type Props = {
  productId: string;
  productName: string;
  price: number;
  variants: VariantLite[];
};

export default function AddToCart({ productId, productName, price, variants }: Props) {
  const router = useRouter();
  const { add } = useCart();
  const colors = availableByColor(variants);
  const [color, setColor] = useState(colors[0]?.color ?? "");
  const [size, setSize] = useState("");

  const sizes = colors.find((c) => c.color === color)?.sizes ?? [];
  const chosen = variants.find((v) => v.color === color && v.size === size);

  return (
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
  );
}
