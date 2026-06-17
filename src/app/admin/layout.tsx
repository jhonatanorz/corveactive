import AdminNav from "./AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex bg-snow text-ink">
      <AdminNav />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
