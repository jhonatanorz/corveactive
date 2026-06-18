import { listSuppliers } from "@/lib/repos/suppliers";
import { addSupplier } from "./actions";
import { Button, PageHeader } from "@/components/ui";

export default async function ProveedoresPage() {
  const suppliers = await listSuppliers();
  return (
    <div className="p-6 max-w-lg text-sm">
      <PageHeader title="Proveedores" />
      <ul className="mb-4">
        {suppliers.map((s) => (
          <li key={s.id} className="flex justify-between border-b border-line py-1 text-ink">
            <span>{s.name}</span><span className="text-ink-3">{s.contact}</span>
          </li>
        ))}
        {suppliers.length === 0 && <li className="text-ink-3">Sin proveedores aún.</li>}
      </ul>
      <form action={addSupplier} className="flex flex-wrap gap-2">
        <input name="name" placeholder="Nombre" className="flex-1 rounded-sm border border-line bg-white p-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40" />
        <input name="contact" placeholder="Contacto" className="flex-1 rounded-sm border border-line bg-white p-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40" />
        <Button type="submit" variant="primary">+ Proveedor</Button>
      </form>
    </div>
  );
}
