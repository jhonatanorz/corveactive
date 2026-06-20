# Remove unused categories — design

**Date:** 2026-06-20
**Status:** Approved, ready for planning

## Problem

Admins can create and edit product categories (`/admin/categories`), but there is
no way to delete one. Categories accumulate, including ones created by mistake or
left empty after products are moved elsewhere. We want an option to remove a
category, but only when it is safe to do so — i.e. no live product depends on it.

## Constraints (from the codebase)

- `products.category_id` is a **NOT NULL** FK to `product_categories(id)` with the
  default `ON DELETE NO ACTION`. The database itself refuses to delete a category
  while any product row references it.
- Products use **soft-delete**: archiving sets `deleted_at` but leaves
  `category_id` populated. So an archived product still references its category
  and still trips the FK.
- Categories live in a hard table — no `deleted_at`, no soft-delete. Deletion is a
  real `DELETE`.
- The categories list uses `LinkRow`, a whole-row click target (`onClick` on the
  `<tr>` navigates to the editor).

## Decisions

- **Placement:** delete is offered in **both** the category editor page and inline
  on the categories list.
- **In-use guard:** the delete control is **always visible but disabled** when the
  category has live products, shown greyed out with a count note (e.g. "3
  productos") and a tooltip.
- **What counts as "associated":** only **live** products (`deleted_at IS NULL`).
  Archived (soft-deleted) products are **ignored** for the guard.
- **Archived-products edge case:** because the FK still refuses a delete when
  archived rows reference the category, a category may show "0 productos" yet fail
  to delete at the DB level. The server action catches the Postgres FK violation
  (code `23503`) and surfaces a friendly fallback error instead of crashing.

## Design

### Data layer — `src/lib/repos/categories.ts`

- **`countLiveProductsByCategory(): Promise<Record<string, number>>`**
  Select `category_id` from `products` where `deleted_at IS NULL`; tally in JS;
  return a `categoryId → count` map. One query serves the whole list page.
- **`countLiveProductsInCategory(id: string): Promise<number>`**
  A single exact head-count query (`count: "exact", head: true`) filtered by
  `category_id` and `deleted_at IS NULL`. Used by the editor page.
- **`deleteCategory(id: string): Promise<void>`**
  `supabase.from("product_categories").delete().eq("id", id)`. Lets a Postgres
  FK-violation error propagate to the caller.

### Server action — `src/app/admin/categories/[id]/actions.ts`

- **`deleteCategory(id: string): Promise<void>`** (new `"use server"` export)
  - Try the repo `deleteCategory(id)`.
  - On success → `setFlash("Categoría eliminada")`,
    `revalidatePath("/admin/categories")`, `redirect("/admin/categories")`.
  - On FK violation (error `code === "23503"`) → `setFlash` an error such as
    *"No se puede eliminar: la categoría está asociada a productos archivados."*
    and `redirect("/admin/categories")` without deleting. The action is shared by
    both call sites, so it always returns to the list for a consistent outcome.
  - Mirrors the existing `deleteProduct` action shape.

### UI

- **New client component `src/app/admin/categories/DeleteCategoryButton.tsx`**
  Modeled on `DeleteProductButton`: a `confirm()`-guarded `<form>` whose `action`
  is the bound server action. Props:
  - `action: () => void | Promise<void>` — bound `deleteCategory`.
  - `count: number` — live product count.
  - `variant: "link" | "icon"` — "link" renders the editor's red text link; "icon"
    renders the compact list-row control.
  When `count > 0`: render **disabled + greyed**, with the count note and a `title`
  tooltip; the form cannot submit. When `count === 0`: enabled, with the
  `confirm()` guard.

- **Editor page — `src/app/admin/categories/[id]/page.tsx`**
  For existing categories (not `new`), fetch `countLiveProductsInCategory(id)` and
  render `DeleteCategoryButton` (link variant) below the form.

- **List page — `src/app/admin/categories/page.tsx`**
  Fetch `countLiveProductsByCategory()`. Add a trailing action cell to each
  `LinkRow` rendering `DeleteCategoryButton` (icon variant) with that category's
  count. The cell stops click propagation (`onClick` → `e.stopPropagation()`) so
  using the delete control does not trigger the row's navigate-to-editor. The
  existing chevron cell is kept.

## Testing

- Unit-test `countLiveProductsByCategory`'s tally/mapping logic, following the
  existing Vitest patterns (see `category-input.test.ts`).
- Unit-test the action's FK-error branch (code `23503` → error flash, no throw)
  vs. the success branch.
- Match whatever mocking approach the repo tests already use for the Supabase
  client; if repo functions aren't currently unit-tested, keep coverage to the
  pure logic (mapping, error-code branching) rather than introducing new infra.

## Out of scope (YAGNI)

- Bulk delete of categories.
- Soft-delete / undo for categories (hard table by design).
- Reassigning archived products to another category to free up a deletion.
- Cascading or nulling `category_id` (it is NOT NULL).
