import { CartProvider } from "@/lib/cart/CartContext";
import { Wordmark } from "@/components/ui";
import CartPill from "./CartPill";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-white text-ink">
        <header className="flex items-center justify-between px-5 py-4 border-b border-line">
          <Wordmark className="text-2xl" />
          <CartPill />
        </header>
        {children}
      </div>
    </CartProvider>
  );
}
