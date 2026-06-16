"use client";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";

export default function CartPill() {
  const { count } = useCart();
  return (
    <Link href="/carrito" className="rounded-full bg-white/90 text-[#161311] text-xs px-3 py-1">
      🛍 {count}
    </Link>
  );
}
