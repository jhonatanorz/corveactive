"use client";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import { buttonClass } from "@/components/ui";

export default function CartPill() {
  const { count } = useCart();
  return (
    <Link href="/carrito" className={buttonClass("primary", "sm")}>
      🛍 {count}
    </Link>
  );
}
