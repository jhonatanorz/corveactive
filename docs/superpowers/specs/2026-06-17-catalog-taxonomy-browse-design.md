# CORVE — Catalog Taxonomy & Browse UX — Design

- **Date:** 2026-06-17
- **Status:** Approved (design), pending implementation plan
- **Branch base:** `inventory-costing`

## Problem

CORVE's catalog taxonomy is hardcoded and shallow, and the storefront has no way to
browse or filter:

- **Lines** are a Postgres `enum` (`product_line` = `'MOVE','HIM'`), duplicated across
  `src/domain/types.ts`, `src/app/(shop)/page.tsx` (with marketing copy baked into JSX),
  and `src/lib/admin/product-input.ts`. Adding a line is a multi-file code change, and
  the brand actually has six lines (MOVE, HIM, FLOW, CONFY, BOND, ESSENTIALS).
- **Type** (skirts, shorts, leggings…) is a free-text field on `products`, validated only
  as non-empty. No controlled vocabulary, so it can't drive menus or filters.
- The storefront has **no navigation menu, no search, and no filters** — just a header
  with the wordmark and cart pill. Products are reachable only by scrolling the two
  hardcoded line sections on the home page.

## Goals

1. Classify products by **category** (formerly "type") via a managed vocabulary.
2. Make **lines** first-class data so storefront sections render dynamically.
3. Add a **search bar** and **filters** (category + color) to the storefront.
4. Add a **lateral menu** listing lines and categories.

## Decisions (resolved during brainstorming)

| Decision | Choice |
| --- | --- |
| How lines & categories are managed | **Admin-managed DB tables** (full CRUD) |
| Category ↔ line relationship | **Global categories**, independent of line (one product has one line + one category, chosen independently) |
| Browse UX location | **Home page keeps marketing sections + gains side-menu/search/filters**, *and* a **dedicated page per line** |
| Search scope | Matches **name + category** |
| Filter facets | **Multi-select category** + **multi-select color** |
| Filtering mechanism | **Client-side, URL-synced** query params |
| Naming | Rename `type` → **`category`** (`categoría`); keep **`line`** (`línea`) |
| Future-proofing | Categories get a nullable `parent_id` (hierarchy reserved, unused); "Collections" reserved as a separate future axis |

## Terminology & taxonomy model

Two independent axes, aligned with the Google / Shopify standard product taxonomy:

| Axis | Answers | Cardinality | Field |
| --- | --- | --- | --- |
| **Category** (`categoría`) | *What is this?* (legging, short, skirt) | one per product; hierarchy reserved | `products.category_id` |
| **Line** (`línea`) | *What sub-brand?* (MOVE, HIM, FLOW…) | one per product | `products.line_id` |

**Color** is a third filter facet but is **not** a managed taxonomy — it is derived from
existing `variants` data (distinct `color` + `color_hex`), grouped case-insensitively.

**Out of scope (reserved future axis):** **Collections** — curated, many-to-many,
transient groupings ("Verano 2026", "Lo más vendido", "Sale"). Not built now; `line`
must not be overloaded to cover it.

## Data model

### New table: `product_lines`

```sql
create table product_lines (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,          -- 'MOVE', 'HIM', …
  name         text not null,                 -- 'CORVE MOVE'
  hero_title   text not null default '',      -- marketing copy, was hardcoded in JSX
  hero_message text not null default '',
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
```

### New table: `product_categories`

```sql
create table product_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,            -- 'leggings', 'shorts', …
  name       text not null,                   -- 'Leggings'
  parent_id  uuid references product_categories(id) on delete set null, -- reserved, unused
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
```

### `products` changes

- Add `line_id uuid references product_lines(id)`.
- Add `category_id uuid references product_categories(id)`.
- After backfill, set both `not null`, **drop `products.line` and `products.type`**, and
  **drop the `product_line` enum** once nothing references it.
- Add indexes on `products(line_id)` and `products(category_id)`.

### `order_items.line` (snapshot) — enum → text

`order_items.line` is a **historical sales-report snapshot** (drives "Ventas por línea").
Convert it from the `product_line` enum to **`text`**, storing the line **slug** at sale
time. Text (not an FK) keeps historical reporting intact even if a line is later renamed
or deleted. Stored values stay `'MOVE'`/`'HIM'` (slug == old enum value), so existing rows
and the `getSalesByLine` repo (`src/lib/repos/sales.ts`) need no data change.

### `place_order` RPC update (critical)

The `place_order` SQL function (`supabase/migrations/0003_catalog_orders.sql:70`) snapshots
`v_product.line` into `order_items.line`. After the column is dropped this breaks. The
migration must `create or replace function place_order(...)` to snapshot the slug:

```sql
-- inside the item loop, replacing v_product.line:
insert into order_items (order_id, variant_id, product_name, line, color, size, unit_price, cost, qty)
values (v_order_id, v_variant.id, v_product.name,
        (select slug from product_lines where id = v_product.line_id),
        v_variant.color, v_variant.size, v_product.price, v_product.cost, v_qty);
```

### RLS / grants (new tables)

Mirror the `0003` anon-read pattern: lines and categories are public reference data.

```sql
alter table product_lines      enable row level security;
alter table product_categories enable row level security;
grant select on product_lines, product_categories to anon;
create policy public_read on product_lines      for select to anon using (true);
create policy public_read on product_categories  for select to anon using (true);
create policy admin_all  on product_lines      for all to authenticated using (true) with check (true);
create policy admin_all  on product_categories  for all to authenticated using (true) with check (true);
```

(`authenticated` already has table-wide grants from `0002`; the explicit `admin_all`
policies match the existing per-table convention.)

## Migration plan (single migration `0010_catalog_taxonomy.sql`)

1. Create `product_lines`, `product_categories` (+ RLS, grants, policies).
2. Seed `product_lines` with **MOVE** and **HIM**, carrying the exact `hero_title` /
   `hero_message` currently in `src/app/(shop)/page.tsx` (`sort_order` 0,1; `active`).
3. Seed `product_categories` from `select distinct type from products` (slugify name).
4. Add `products.line_id`, `products.category_id` (nullable).
5. Backfill: `line_id` from `product_lines.slug = products.line`; `category_id` from
   `product_categories.slug = slugify(products.type)`.
6. Set `line_id`, `category_id` `not null`; add indexes.
7. Alter `order_items.line` → `text`.
8. `create or replace function place_order` (slug snapshot).
9. Drop `products.line`, `products.type`; drop `type product_line` enum.

The other four brand lines (FLOW, CONFY, BOND, ESSENTIALS) are **not** seeded — the admin
adds them via the new CRUD.

## Admin CRUD

Two new admin sections, reusing existing components (`Table`, `PageHeader`, `Field`,
`Button`) and the server-action + `validate*Input` pattern:

- **`/admin/lines`** — list (ordered by `sort_order`) + create/edit form
  (`name`, `slug`, `hero_title`, `hero_message`, `sort_order`, `active`).
- **`/admin/categories`** — list + create/edit form (`name`, `slug`, `sort_order`).
  `parent_id` not surfaced in UI (reserved).
- Add both to `src/app/admin/AdminNav.tsx` `LINKS`.

**Product form** (`src/app/admin/products/[id]/ProductForm.tsx`):

- The hardcoded line `<select>` becomes a dropdown sourced from `product_lines`.
- The free-text "Tipo" input becomes a **"Categoría" dropdown** sourced from
  `product_categories`.
- `src/lib/admin/product-input.ts`: `validateProductInput` stops checking a hardcoded
  `LINES` array; it validates `line_id` and `category_id` are present and reference
  existing rows. `ProductPayload` carries `line_id` / `category_id`.

Slug generation: a small shared `slugify(name)` helper (lowercase, strip accents,
hyphenate) used by both admin forms; slug is editable but defaults from name.

## Storefront UX

### Shared components

- **`CatalogSideMenu`** — drawer on mobile / sidebar on desktop, mirroring the proven
  `AdminNav` pattern (slide-in + backdrop on mobile, `md:` persistent). Sections:
  - **Líneas** — each links to its line page (`/linea/[slug]`).
  - **Categorías** — each toggles a category filter on the current page (writes the URL
    query param; does **not** navigate to a separate page).
- **`CatalogFilterBar`** — sticky. Contains: search input (name + category), multi-select
  category chips, multi-select color swatches, and a "Limpiar" clear-all.
- **`CatalogGrid`** — client component that holds the loaded products and renders either
  the marketing sections (home, no filter active) or a flat filtered grid.

### Home page (`/`)

- Renders line sections **dynamically** from `product_lines` (active, ordered by
  `sort_order`) — replaces the hardcoded `LINES` array and inline hero copy.
- Adds `CatalogSideMenu` + `CatalogFilterBar`.
- **Behavior:** no filter/search active → marketing line sections (as today). Any
  search/filter active → sections collapse into one **flat filtered grid**; "Limpiar"
  restores sections.

### Line pages (`/linea/[slug]`)

- Server component: loads the line by slug (404 if missing/inactive) + its active products.
- Renders the line hero + a flat product grid, with the **same** side menu + filter bar,
  scoped to that line's products.

### Filtering mechanism — client-side, URL-synced

- The server component loads active products **once** with the fields needed to filter:
  `id, name, price, category_id` (+ category name/slug), `line_id`, images, and variant
  `color`/`color_hex`. (`listActiveByLine` / a new `listActiveCatalog` in
  `src/lib/repos/catalog.ts` extended to join category and return variant colors.)
- A client component filters in memory and **mirrors active filters into URL query params**
  so filtered views are shareable and back-button friendly:
  `?q=<text>&cat=<slug,slug>&color=<key,key>`.
- No per-keystroke server round-trips. Justified by boutique-sized catalog (YAGNI vs.
  server-side search infra).

### Color facet derivation

- A pure helper aggregates distinct colors from variant data: group by
  `normalizeColorKey(color)` (trim + lowercase + strip accents), display the first-seen
  stored label and its `color_hex`. Surfaced as swatches in `CatalogFilterBar`.

## Domain / pure logic (Vitest-tested)

New pure functions in `src/domain/` (no DB), unit-tested in the existing style:

- **`catalog-filter.ts`** — `matchesFilters(product, { query, categorySlugs, colorKeys })`:
  - search: case-insensitive substring on `name` OR `category.name`;
  - category: product's category slug ∈ selected (OR within facet);
  - color: any variant color key ∈ selected (OR within facet);
  - facets combine with AND; empty facet = no constraint.
- **`catalog-colors.ts`** — `normalizeColorKey(color)` and
  `aggregateColors(variants) → { key, label, hex }[]`.
- **`slugify.ts`** — shared name→slug helper (used by admin + seed reasoning).

## Files touched (concrete)

- `supabase/migrations/0010_catalog_taxonomy.sql` (new)
- `src/domain/types.ts` (drop `Line` union; add `ProductLine` / `ProductCategory` types)
- `src/lib/db-types.ts` (`ProductRow`: `line`/`type` → `line_id`/`category_id`; new row types)
- `src/lib/repos/catalog.ts` (join category + variant colors; line-by-slug loader)
- `src/lib/repos/products.ts` (admin reads/writes `line_id`/`category_id`)
- `src/lib/admin/product-input.ts` (FK validation)
- `src/lib/repos/lines.ts`, `src/lib/repos/categories.ts` (new admin repos)
- `src/app/admin/lines/**`, `src/app/admin/categories/**` (new)
- `src/app/admin/AdminNav.tsx` (links)
- `src/app/admin/products/[id]/ProductForm.tsx` (dynamic dropdowns)
- `src/app/(shop)/page.tsx` (dynamic sections + side menu + filter bar)
- `src/app/(shop)/linea/[slug]/page.tsx` (new)
- `src/app/(shop)/CatalogSideMenu.tsx`, `CatalogFilterBar.tsx`, `CatalogGrid.tsx` (new)
- `src/domain/catalog-filter.ts` (+ test), `src/domain/catalog-colors.ts` (+ test),
  `src/domain/slugify.ts` (+ test)

## Testing

- **Unit (Vitest):** `catalog-filter`, `catalog-colors`, `slugify` — pure functions.
- **Migration:** apply locally; confirm every existing product retains its line + category,
  the catalog still renders, and a test order still places (RPC snapshot writes the slug).

## Out of scope (YAGNI)

- Collections (curated many-to-many groupings) — reserved future axis.
- Category hierarchy UI — `parent_id` column exists but is unused.
- Server-side / full-text search infrastructure.
- Price, size, or availability filters.
- Per-line category scoping (categories are global).

## Risks

- **Enum drop ordering:** `products.line` and `order_items.line` must both stop using the
  `product_line` enum before `drop type`. Sequenced in the migration (steps 7 + 9).
- **`place_order` RPC:** easy to forget; explicitly part of the migration. Verify a guest
  order still places after migrating.
- **Color normalization:** inconsistent variant color entry could over- or under-merge
  swatches. Acceptable for now; normalization key mitigates the common case (casing/accents).
