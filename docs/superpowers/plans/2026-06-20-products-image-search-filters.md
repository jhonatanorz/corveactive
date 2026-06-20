# Products Image, Search & Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a product thumbnail, a name search box, and Línea/Categoría/Estado dropdown filters to the admin Products list.

**Architecture:** The server page (`page.tsx`) loads all products + their default thumbnails + line/category options, then hands them to a new client component (`ProductsTable.tsx`) that owns search/filter state and renders the table. Filtering is client-side via a pure, unit-tested predicate (`matchesProductFilters`), mirroring the existing inventory list and shop browsers.

**Tech Stack:** Next.js (App Router, server + client components), React `useState`, Supabase (PostgREST), Tailwind, Vitest.

## Global Constraints

- Reuse existing primitives only — no new UI components: `Thumb`, `Table/THead/Th/Td/Tr`, `LinkRow/ChevronCell`, `Pill`, `PageHeader`, `buttonClass`, `formatMXN`, `inputClass`, `normalizeColorKey`, `imagesByProducts`, `pickProductImage`, `listLines`, `listCategories`.
- Client-side filtering (all products load in one query) — no server-side filtering or pagination.
- Single-select dropdowns; the default option means "no constraint."
- Search matches product **name** only, accent-insensitive via `normalizeColorKey`.
- `ProductStatus` values are exactly `"draft" | "active" | "hidden"`.
- Thumbnails use the **default** image (color-agnostic): `pickProductImage(imgs, null)`.
- Test runner: `npm run test` (vitest run). Lint: `npm run lint`.
- Spanish UI copy, consistent with the existing page ("Productos", "Nombre", "Línea", "Precio", "Estado").

---

## File Structure

- `src/domain/product-filter.ts` — **new**. Pure predicate + types for filtering one product row.
- `src/domain/product-filter.test.ts` — **new**. Unit tests for the predicate.
- `src/lib/repos/products.ts` — **modify**. Extend `listProducts()` + `ProductListRow` to carry category slug/name.
- `src/app/admin/products/ProductsTable.tsx` — **new**. Client component: toolbar (search + 3 dropdowns) + table with image column.
- `src/app/admin/products/page.tsx` — **modify**. Load data, resolve thumbnails, render `ProductsTable`.

---

### Task 1: Pure filter predicate

**Files:**
- Create: `src/domain/product-filter.ts`
- Test: `src/domain/product-filter.test.ts`

**Interfaces:**
- Consumes: `normalizeColorKey` from `@/domain/catalog-colors` (trim + lowercase + accent-strip).
- Produces:
  - `interface ProductFilterItem { name: string; lineSlug: string; categorySlug: string; status: string }`
  - `interface ProductFilters { query?: string; lineSlug?: string; categorySlug?: string; status?: string }`
  - `function matchesProductFilters(item: ProductFilterItem, f: ProductFilters): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/domain/product-filter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { matchesProductFilters, type ProductFilterItem } from "@/domain/product-filter";

const item: ProductFilterItem = {
  name: "Legging Aurora",
  lineSlug: "MOVE",
  categorySlug: "leggings",
  status: "active",
};

describe("matchesProductFilters", () => {
  it("passes when no filters are set", () => {
    expect(matchesProductFilters(item, {})).toBe(true);
  });

  it("matches query against name (case/accent-insensitive)", () => {
    expect(matchesProductFilters(item, { query: "aurora" })).toBe(true);
    expect(matchesProductFilters(item, { query: "AURORA" })).toBe(true);
    expect(matchesProductFilters(item, { query: "léggíng" })).toBe(true);
    expect(matchesProductFilters(item, { query: "short" })).toBe(false);
  });

  it("filters by line (exact, single-select)", () => {
    expect(matchesProductFilters(item, { lineSlug: "MOVE" })).toBe(true);
    expect(matchesProductFilters(item, { lineSlug: "HIM" })).toBe(false);
  });

  it("filters by category", () => {
    expect(matchesProductFilters(item, { categorySlug: "leggings" })).toBe(true);
    expect(matchesProductFilters(item, { categorySlug: "shorts" })).toBe(false);
  });

  it("filters by status", () => {
    expect(matchesProductFilters(item, { status: "active" })).toBe(true);
    expect(matchesProductFilters(item, { status: "draft" })).toBe(false);
  });

  it("combines facets with AND", () => {
    expect(matchesProductFilters(item, { lineSlug: "MOVE", status: "active" })).toBe(true);
    expect(matchesProductFilters(item, { lineSlug: "MOVE", status: "draft" })).toBe(false);
  });

  it("treats empty strings as no constraint", () => {
    expect(matchesProductFilters(item, { query: "", lineSlug: "", categorySlug: "", status: "" })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- product-filter`
Expected: FAIL — cannot resolve `@/domain/product-filter` / `matchesProductFilters is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/product-filter.ts`:

```ts
import { normalizeColorKey } from "@/domain/catalog-colors";

export interface ProductFilterItem {
  name: string;
  lineSlug: string;
  categorySlug: string;
  status: string;
}

export interface ProductFilters {
  query?: string;
  lineSlug?: string;
  categorySlug?: string;
  status?: string;
}

/** True when a product satisfies every active filter. Empty/undefined facet = no constraint. */
export function matchesProductFilters(item: ProductFilterItem, f: ProductFilters): boolean {
  const q = normalizeColorKey(f.query ?? ""); // reuse: trim + lowercase + accent-strip
  if (q !== "" && !normalizeColorKey(item.name).includes(q)) return false;
  if (f.lineSlug && item.lineSlug !== f.lineSlug) return false;
  if (f.categorySlug && item.categorySlug !== f.categorySlug) return false;
  if (f.status && item.status !== f.status) return false;
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- product-filter`
Expected: PASS (all 7 cases).

- [ ] **Step 5: Commit**

```bash
git add src/domain/product-filter.ts src/domain/product-filter.test.ts
git commit -m "feat(products): pure matchesProductFilters predicate with tests"
```

---

### Task 2: Extend `listProducts()` with category

**Files:**
- Modify: `src/lib/repos/products.ts:14-31` (the `ProductListRow` interface and `listProducts` function)

**Interfaces:**
- Consumes: existing `ProductRow` from `@/lib/db-types`.
- Produces: `ProductListRow` now also has `categorySlug: string` and `categoryName: string` (in addition to the existing `lineSlug: string`).

> Repos hit Supabase and are not unit-tested in this codebase; this task is verified by typecheck/lint and consumed by Task 3.

- [ ] **Step 1: Update the interface and query**

In `src/lib/repos/products.ts`, replace the current `ProductListRow` interface and `listProducts` function (lines 14–31) with:

```ts
export interface ProductListRow extends ProductRow {
  lineSlug: string;
  categorySlug: string;
  categoryName: string;
}

export async function listProducts(): Promise<ProductListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_lines(slug), product_categories(slug,name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Raw = ProductRow & {
    product_lines: { slug: string } | { slug: string }[] | null;
    product_categories: { slug: string; name: string } | { slug: string; name: string }[] | null;
  };
  return (data as Raw[]).map((r) => {
    const l = Array.isArray(r.product_lines) ? r.product_lines[0] : r.product_lines;
    const c = Array.isArray(r.product_categories) ? r.product_categories[0] : r.product_categories;
    return {
      ...r,
      lineSlug: l?.slug ?? "",
      categorySlug: c?.slug ?? "",
      categoryName: c?.name ?? "",
    };
  });
}
```

- [ ] **Step 2: Verify it lints and the suite still passes**

Run: `npm run lint`
Expected: no errors in `src/lib/repos/products.ts`.

Run: `npm run test`
Expected: PASS (no regressions; product-filter tests still green).

- [ ] **Step 3: Commit**

```bash
git add src/lib/repos/products.ts
git commit -m "feat(products): listProducts carries category slug + name"
```

---

### Task 3: ProductsTable client component + wire up the page

**Files:**
- Create: `src/app/admin/products/ProductsTable.tsx`
- Modify: `src/app/admin/products/page.tsx` (full rewrite of the file)

**Interfaces:**
- Consumes:
  - `matchesProductFilters`, `ProductFilterItem` from `@/domain/product-filter` (Task 1).
  - `listProducts` → `ProductListRow[]` with `lineSlug`/`categorySlug`/`categoryName` (Task 2).
  - `imagesByProducts`, `pickProductImage`, `listLines`, `listCategories`, `Thumb`, `Table` family, `LinkRow`, `ChevronCell`, `Pill`, `PageHeader`, `buttonClass`, `inputClass`, `formatMXN`.
- Produces:
  - `type ProductTableRow = { id: string; name: string; lineSlug: string; categorySlug: string; categoryName: string; price: number; status: ProductStatus; imageUrl: string | null }`
  - `type Option = { value: string; label: string }`
  - `function ProductsTable({ rows, lineOptions, categoryOptions }: { rows: ProductTableRow[]; lineOptions: Option[]; categoryOptions: Option[] }): JSX.Element` (default export)

- [ ] **Step 1: Create the client component**

Create `src/app/admin/products/ProductsTable.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Table, THead, Th, Td, Tr, LinkRow, ChevronCell, Pill, type PillTone, inputClass, Thumb } from "@/components/ui";
import { formatMXN } from "@/domain/money";
import { matchesProductFilters } from "@/domain/product-filter";
import type { ProductStatus } from "@/domain/types";

export type ProductTableRow = {
  id: string;
  name: string;
  lineSlug: string;
  categorySlug: string;
  categoryName: string;
  price: number;
  status: ProductStatus;
  imageUrl: string | null;
};

export type Option = { value: string; label: string };

const STATUS_TONE: Record<ProductStatus, PillTone> = {
  active: "success",
  draft: "neutral",
  hidden: "muted",
};

const selectClass = `${inputClass} w-44`;

export default function ProductsTable({
  rows,
  lineOptions,
  categoryOptions,
}: {
  rows: ProductTableRow[];
  lineOptions: Option[];
  categoryOptions: Option[];
}) {
  const [query, setQuery] = useState("");
  const [lineSlug, setLineSlug] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(
    () => rows.filter((r) => matchesProductFilters(r, { query, lineSlug, categorySlug, status })),
    [rows, query, lineSlug, categorySlug, status],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto…"
          aria-label="Buscar producto"
          className={`${inputClass} w-64`}
        />
        <select value={lineSlug} onChange={(e) => setLineSlug(e.target.value)} aria-label="Línea" className={selectClass}>
          <option value="">Todas las líneas</option>
          {lineOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} aria-label="Categoría" className={selectClass}>
          <option value="">Todas las categorías</option>
          {categoryOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado" className={selectClass}>
          <option value="">Todos los estados</option>
          <option value="active">active</option>
          <option value="draft">draft</option>
          <option value="hidden">hidden</option>
        </select>
      </div>

      <Table>
        <THead>
          <Th className="w-12" />
          <Th>Nombre</Th>
          <Th>Línea</Th>
          <Th>Categoría</Th>
          <Th>Precio</Th>
          <Th>Estado</Th>
          <Th className="w-8" />
        </THead>
        <tbody>
          {filtered.map((p) => (
            <LinkRow key={p.id} href={`/admin/products/${p.id}`}>
              <Td><Thumb src={p.imageUrl} alt={p.name} className="h-9 w-7" /></Td>
              <Td className="font-medium">{p.name}</Td>
              <Td className="text-ink-2">{p.lineSlug}</Td>
              <Td className="text-ink-2">{p.categoryName}</Td>
              <Td>{formatMXN(p.price)}</Td>
              <Td><Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill></Td>
              <ChevronCell />
            </LinkRow>
          ))}
          {filtered.length === 0 && (
            <Tr>
              <Td colSpan={7} className="py-8 text-center text-ink-3">
                {rows.length === 0 ? "Aún no hay productos." : "Sin resultados."}
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the page to load data and render the table**

Replace the entire contents of `src/app/admin/products/page.tsx` with:

```tsx
import Link from "next/link";
import { listProducts, imagesByProducts } from "@/lib/repos/products";
import { listLines } from "@/lib/repos/lines";
import { listCategories } from "@/lib/repos/categories";
import { pickProductImage } from "@/domain/product-image";
import { buttonClass, PageHeader } from "@/components/ui";
import ProductsTable, { type ProductTableRow } from "./ProductsTable";

export default async function ProductsPage() {
  const products = await listProducts();
  const [imgByProduct, lines, categories] = await Promise.all([
    imagesByProducts(products.map((p) => p.id)),
    listLines(),
    listCategories(),
  ]);

  const rows: ProductTableRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    lineSlug: p.lineSlug,
    categorySlug: p.categorySlug,
    categoryName: p.categoryName,
    price: p.price,
    status: p.status,
    imageUrl: pickProductImage(imgByProduct[p.id] ?? [], null),
  }));

  const lineOptions = lines.map((l) => ({ value: l.slug, label: l.name }));
  const categoryOptions = categories.map((c) => ({ value: c.slug, label: c.name }));

  return (
    <div className="p-6">
      <PageHeader title="Productos">
        <Link href="/admin/products/import" className={buttonClass("soft", "sm")}>
          Importar CSV
        </Link>
        <Link href="/admin/products/new" className={buttonClass("primary", "sm")}>
          + Nuevo producto
        </Link>
      </PageHeader>
      <ProductsTable rows={rows} lineOptions={lineOptions} categoryOptions={categoryOptions} />
    </div>
  );
}
```

- [ ] **Step 3: Verify lint, typecheck, and tests**

Run: `npm run lint`
Expected: no errors in the new/edited files.

Run: `npm run test`
Expected: PASS (predicate tests still green; no regressions).

- [ ] **Step 4: Verify in the browser**

Start the dev server and open `/admin/products` (Docker/Supabase must be up; admin login required).
Confirm:
- Each row shows a thumbnail (or the placeholder box when a product has no image).
- Typing in the search box narrows rows by name (try a partial, lowercase, and accented query).
- Each dropdown narrows the list; combining them ANDs; resetting to the default option restores the full list.
- With a filter that matches nothing, the table shows "Sin resultados."

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/products/ProductsTable.tsx src/app/admin/products/page.tsx
git commit -m "feat(products): image thumbnails, search and Línea/Categoría/Estado filters"
```

---

## Self-Review

**Spec coverage:**
- Product image per row → Task 3 (Thumb column + `pickProductImage`). ✓
- Search bar (name, accent-insensitive) → Task 1 predicate + Task 3 input. ✓
- Línea / Categoría / Estado filters → Task 1 predicate + Task 2 (category data) + Task 3 dropdowns. ✓
- Reuse-only, client-side filtering, empty states, tested predicate → covered across tasks. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full code. ✓

**Type consistency:** `matchesProductFilters(item, f)` signature identical in Tasks 1 and 3; `ProductTableRow` is a structural superset of `ProductFilterItem` (has `name`/`lineSlug`/`categorySlug`/`status`), so it is accepted by the predicate. `ProductListRow` fields produced in Task 2 (`categorySlug`/`categoryName`) are exactly those consumed in Task 3. `ProductStatus` union matches the `STATUS_TONE` keys and the `<option>` values. ✓
