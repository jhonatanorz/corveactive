# Products page: image, search & filters — Design

**Date:** 2026-06-20
**Status:** Approved (ready for implementation plan)

## Goal

Improve the admin Products list (`src/app/admin/products/page.tsx`) so it:

1. Shows a **product image** (thumbnail) per row, like the inventory list.
2. Has a **search bar** to find products by name.
3. Has **filters** for Línea, Categoría, and Estado.

Maximize reuse of existing components and helpers; add no new UI primitives.

## Current state

`src/app/admin/products/page.tsx` is an async server component that calls
`listProducts()` and renders a plain `Table` with columns Nombre / Línea /
Precio / Estado + a chevron, each row wrapped in `LinkRow` to the editor. No
image, no search, no filters.

The inventory list (`src/app/admin/inventory/ExistenciasTable.tsx`) already
demonstrates the target pattern: a `Thumb` thumbnail plus an inline search box
filtering client-side.

## Architecture

Follow the inventory pattern: the **server page** loads data; a new
**client component** owns the search/filter state and renders the table.
Filtering is **client-side** — all products already load in a single query,
consistent with `ExistenciasTable` and the shop browsers
(`ProductBrowser`, `CatalogBrowser`).

## Components & data flow

### `src/app/admin/products/page.tsx` (server, edited)

Fetch in parallel:

- `listProducts()` *(extended — see below)* — rows carry `lineSlug`,
  `categorySlug`, `categoryName`.
- `imagesByProducts(ids)` then `pickProductImage(imgs, null)` per product —
  resolve each product's default thumbnail (same helpers inventory uses).
- `listLines()` and `listCategories()` — dropdown options.

Build a `ProductRow[]` with `{ id, name, lineSlug, categorySlug, categoryName,
price, status, imageUrl }` and pass it, plus the line/category options, to the
client component.

### `src/lib/repos/products.ts` — `listProducts()` (edited)

Extend the existing select from
`"*, product_lines(slug)"` to also join `product_categories(slug,name)`, and
extend `ProductListRow` to include `categorySlug` and `categoryName`
(normalized from the join the same way `lineSlug` already is).

### `src/app/admin/products/ProductsTable.tsx` (new client component)

State via `useState`: `query`, `line`, `category`, `status`.

Renders:

- **Toolbar row** (flex, wraps): a search `<input>` (reusing `inputClass`) and
  three `<select>` dropdowns — Línea, Categoría, Estado — each with an
  "Todas/Todos" default option meaning "no constraint."
- **Table**: a new **leading image column** rendering
  `<Thumb src={imageUrl} className="h-9 w-7" />` (same size as inventory),
  followed by the existing Nombre / Línea / Precio / Estado columns and the
  chevron, each row wrapped in `LinkRow` to `/admin/products/{id}`.

## Filtering logic

Extract a pure predicate `matchesProductFilters(row, filters)` (sibling to the
existing `catalog-filter.ts`) so it can be unit-tested. A row passes when it
satisfies **all** active facets:

- **Text search** — matches the product **name**, accent-insensitive, by reusing
  `normalizeColorKey` (the normalizer the catalog search already uses:
  trim + lowercase + accent-strip).
- **Línea / Categoría / Estado** — exact single-select match on `lineSlug` /
  `categorySlug` / `status`. An empty/default selection imposes no constraint.

## Empty states

- Truly empty catalog → keep existing "Aún no hay productos."
- Filters exclude everything → "Sin resultados." (matches `ExistenciasTable`).

## Reused (no new primitives)

`Thumb`, `Table/THead/Th/Td/Tr`, `LinkRow/ChevronCell`, `Pill`, `PageHeader`,
`buttonClass`, `formatMXN`, `inputClass`, `normalizeColorKey`,
`imagesByProducts`, `pickProductImage`, `listLines`, `listCategories`.

## Testing

- Unit-test `matchesProductFilters` (pure function) in the style of
  `src/domain/catalog-filter.test.ts`: search match/miss, accent-insensitivity,
  each facet, combined facets, and "no constraint" defaults.
- Verify UI wiring (image column, search, dropdowns, empty states) in the
  browser preview.

## Files touched

- `src/app/admin/products/page.tsx` — edited (load data, render client table).
- `src/lib/repos/products.ts` — edited (`listProducts` join + `ProductListRow`).
- `src/app/admin/products/ProductsTable.tsx` — new client component.
- `src/domain/product-filter.ts` — new pure predicate.
- `src/domain/product-filter.test.ts` — new unit tests.

## Out of scope

- Server-side filtering / pagination (catalog is small; client-side matches
  existing patterns).
- Multi-select facets, color filter, sorting (YAGNI for this change).
- Changing the product editor or image upload flow.
