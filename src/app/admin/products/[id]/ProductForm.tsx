"use client";

import { useActionState } from "react";
import type { ProductRow, ProductLineRow, ProductCategoryRow } from "@/lib/db-types";
import { Button, inputClass } from "@/components/ui";

type Props = {
  product: Pick<ProductRow, "name" | "line_id" | "category_id" | "description" | "price" | "status"> | null;
  lines: Pick<ProductLineRow, "id" | "name">[];
  categories: Pick<ProductCategoryRow, "id" | "name">[];
  action: (prev: unknown, formData: FormData) => Promise<{ errors: Record<string, string> } | void>;
};

const peso = (centavos: number) => (centavos / 100).toString();

export default function ProductForm({ product, lines, categories, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={formAction} className="space-y-4 text-sm">
      <h1 className="text-lg font-bold text-ink">{product ? "Editar producto" : "Nuevo producto"}</h1>

      <label className="block text-ink-2">Nombre
        <input name="name" defaultValue={product?.name ?? ""} className={inputClass} />
        {e.name && <span className="text-red-600 text-xs">{e.name}</span>}
      </label>

      <label className="block text-ink-2">Línea
        <select name="line_id" defaultValue={product?.line_id ?? ""} className={inputClass}>
          <option value="" disabled>Selecciona una línea</option>
          {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {e.line_id && <span className="text-red-600 text-xs">{e.line_id}</span>}
      </label>

      <label className="block text-ink-2">Categoría
        <select name="category_id" defaultValue={product?.category_id ?? ""} className={inputClass}>
          <option value="" disabled>Selecciona una categoría</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {e.category_id && <span className="text-red-600 text-xs">{e.category_id}</span>}
      </label>

      <label className="block text-ink-2">Descripción
        <textarea name="description" defaultValue={product?.description ?? ""} className={inputClass} />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="block flex-1 text-ink-2">Precio (MXN)
          <input name="price" defaultValue={product ? peso(product.price) : ""} className={inputClass} />
          {e.price && <span className="text-red-600 text-xs">{e.price}</span>}
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
