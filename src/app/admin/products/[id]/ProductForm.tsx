"use client";

import { useActionState } from "react";
import type { ProductRow } from "@/lib/db-types";
import { Button, inputClass } from "@/components/ui";

type Props = {
  product: Pick<ProductRow, "name" | "line" | "type" | "description" | "price" | "cost" | "status"> | null;
  action: (prev: unknown, formData: FormData) => Promise<{ errors: Record<string, string> } | void>;
};

const peso = (centavos: number) => (centavos / 100).toString();

export default function ProductForm({ product, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={formAction} className="max-w-md space-y-3 p-6 text-sm">
      <h1 className="text-lg font-bold text-ink">{product ? "Editar producto" : "Nuevo producto"}</h1>

      <label className="block text-ink-2">Nombre
        <input name="name" defaultValue={product?.name ?? ""} className={inputClass} />
        {e.name && <span className="text-red-600 text-xs">{e.name}</span>}
      </label>

      <label className="block text-ink-2">Línea
        <select name="line" defaultValue={product?.line ?? "MOVE"} className={inputClass}>
          <option value="MOVE">CORVE MOVE</option>
          <option value="HIM">CORVE HIM</option>
        </select>
        {e.line && <span className="text-red-600 text-xs">{e.line}</span>}
      </label>

      <label className="block text-ink-2">Tipo
        <input name="type" defaultValue={product?.type ?? ""} className={inputClass} />
        {e.type && <span className="text-red-600 text-xs">{e.type}</span>}
      </label>

      <label className="block text-ink-2">Descripción
        <textarea name="description" defaultValue={product?.description ?? ""} className={inputClass} />
      </label>

      <div className="flex gap-3">
        <label className="block flex-1 text-ink-2">Precio (MXN)
          <input name="price" defaultValue={product ? peso(product.price) : ""} className={inputClass} />
          {e.price && <span className="text-red-600 text-xs">{e.price}</span>}
        </label>
        <label className="block flex-1 text-ink-2">Costo (MXN)
          <input name="cost" defaultValue={product ? peso(product.cost) : ""} className={inputClass} />
          {e.cost && <span className="text-red-600 text-xs">{e.cost}</span>}
        </label>
      </div>

      <label className="block text-ink-2">Estado
        <select name="status" defaultValue={product?.status ?? "draft"} className={inputClass}>
          <option value="draft">Borrador</option>
          <option value="active">Activa</option>
          <option value="hidden">Oculta</option>
        </select>
        {e.status && <span className="text-red-600 text-xs">{e.status}</span>}
      </label>

      <Button type="submit" disabled={pending} variant="primary" size="md">
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
