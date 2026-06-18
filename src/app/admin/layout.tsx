import AdminNav from "./AdminNav";
import { Toaster } from "@/components/ui";
import { readFlash } from "@/lib/flash";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const flash = await readFlash();
  return (
    <div className="min-h-screen md:flex bg-white text-ink">
      <AdminNav />
      <main className="flex-1 min-w-0">{children}</main>
      <Toaster flash={flash} />
    </div>
  );
}
