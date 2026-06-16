import Link from "next/link";
import { CartProvider } from "@/lib/cart/CartContext";
import CartPill from "./CartPill";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-[#161311] text-[#f4efe9]">
        <header className="flex items-center justify-between px-5 py-4">
          <Link href="/" className="tracking-[0.3em] text-sm">C O R V E</Link>
          <CartPill />
        </header>
        {children}
      </div>
    </CartProvider>
  );
}
