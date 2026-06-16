# CORVE — Per-Color Product Images — Design Spec

**Date:** 2026-06-16
**Status:** Approved design, pending implementation plan
**Builds on:** Plans 1–4 (catalog, admin, `product_images` table, storage bucket).

---

## 1. Overview

Show a **color-specific image** on the catalog: when a shopper selects a color on the product detail page, show that color's image; if that color has no image, show the product's **default** image; if there is no image at all, show the existing gradient placeholder. The catalog grid shows each product's default image.

This also closes a gap: **the catalog currently renders gradient placeholders everywhere** and never displays the uploaded `product_images`. This feature makes real images appear on both the grid and the detail page, keyed by color with a fallback.

### Success criteria
- Uploading an image and tagging it with a color makes that image appear on the detail page when the color is selected.
- Selecting a color with no image shows the product's default image; with no images at all, the gradient placeholder.
- The grid shows each product's default image (placeholder when none).
- One image per color is maintained (re-uploading for a color replaces the previous one).

### Out of scope (YAGNI)
- Multiple images per color / carousel (decided: one per color + one default).
- Per-size images (images are keyed by **color**, shared across that color's sizes).
- Zoom/lightbox, image cropping/editing.

---

## 2. Data model

One migration adds a nullable `color` to the existing table:

```sql
-- supabase/migrations/0006_image_color.sql
alter table product_images add column color text;
```

- `color IS NULL` → the product's **default** image.
- `color = '<color name>'` (matches `variants.color`) → that color's image.
- "One image per color (+ one default)" is maintained at the **app layer** via replace-on-upload — no hard unique constraint, so the migration cannot fail on pre-existing multi-image rows. `sort_order` is retained for deterministic ordering ("first" image wins if duplicates ever exist).
- **RLS unchanged:** anon already reads `product_images` of active products (Plan 3 `0003`); adding a column needs no policy change. Admin write is already covered (Plan 2 `0002`).

`ProductImageRow` (in `src/lib/db-types.ts`) gains `color: string | null`.

---

## 3. Pure selector (domain)

`src/domain/product-image.ts`:

```ts
export interface ImageChoice { url: string; color: string | null }

/**
 * Pick the image URL to display for a given color:
 *  1. the image whose color matches `color`,
 *  2. else the default image (color === null),
 *  3. else null (caller renders the gradient placeholder).
 */
export function pickProductImage(images: ImageChoice[], color: string | null): string | null
```

- Detail page calls it with the selected color (reactive).
- Grid calls it with `null` → the default image.
- Fully unit-tested: color match, default fallback, no-images → null, color-with-no-image → default.

---

## 4. Catalog — detail page (color-reactive)

**Refactor:** today the detail server page (`src/app/(shop)/producto/[id]/page.tsx`) renders a placeholder `<div>` and a separate client `AddToCart` that owns the color state — so the image cannot react to color.

Consolidate the detail body into **one client component** `ProductDetailClient` (evolving the current `AddToCart.tsx`) that:
- receives `product`, `variants`, and `images` (`{ url, color }[]`) from the server page,
- owns `color`/`size` state,
- renders, top to bottom: the **hero image** = `pickProductImage(images, color)` (or the gradient placeholder when `null`) → name / price / line / description → color swatches → size selector → Agregar.

The server page becomes a thin fetch-and-pass; `getActiveProduct` already returns `product_images`, so add `images` to what it surfaces (it currently returns `{ product (incl. product_images), variants }`). Map images to `{ url, color }` for the client.

The hero image swaps live as the shopper taps a color (client state → `pickProductImage`).

---

## 5. Catalog — grid

`src/app/(shop)/page.tsx` tiles render `pickProductImage(p.product_images, null)` (the default), falling back to the gradient placeholder when there is no image. `listActiveByLine` already selects `*, product_images(*)`, so no query change.

**Image rendering:** switch catalog hero + grid tiles to **`next/image`** for optimization (the shareable catalog is the customer-facing "appealing" surface). Add the Supabase storage host to `next.config.ts` `images.remotePatterns`:
- local: `127.0.0.1` port `54321`,
- production: the cloud Supabase project host (added at deploy time).

Admin thumbnails keep the existing plain `<img>` (internal, not perf-sensitive).

---

## 6. Admin — upload & manage by color

In the product editor image section (`src/app/admin/products/[id]/page.tsx`):

- **Upload form** gains a **Color** `<select>`: `"Default (todas)"` (value empty → null) + the product's **distinct variant colors** (derived from its `variants`).
- `addProductImage(productId, file, color: string | null)`:
  - deletes any existing `product_images` row(s) for that `(product_id, color)` — best-effort also removing the old storage object(s) to avoid orphans,
  - uploads the new file and inserts a row with `color`.
- **Existing thumbnails** are labeled by color (`"Default"` / the color name) and each has a **delete** control → `deleteProductImage(imageId)` (removes the row, best-effort removes the storage object), then `revalidatePath`.

If the product has no variants yet, the dropdown shows only "Default".

---

## 7. Data flow

1. Admin uploads an image with a color (or default) → `product_images` row with `color`.
2. Catalog detail (client) → `pickProductImage(images, selectedColor)` → reactive hero image.
3. Grid (server) → `pickProductImage(images, null)` → default image.

---

## 8. Testing

- **Unit (TDD):** `pickProductImage` — exact color match; color-with-no-image → default; no default → null; empty list → null.
- **Build/typecheck:** `next/image` remotePatterns compiles; `ProductImageRow.color` threads through repos/components.
- **Browser E2E:** upload a Negro image to a product; on the detail page selecting **Negro** shows it, selecting a color **without** an image shows the default, and the grid tile shows the default; delete the image → falls back to placeholder.

---

## 9. Files touched

- Create: `supabase/migrations/0006_image_color.sql`, `src/domain/product-image.ts` (+ test).
- Modify: `src/lib/db-types.ts` (`color` on `ProductImageRow`); `src/lib/repos/products.ts` (`addProductImage` color + replace, `deleteProductImage`); `src/lib/repos/catalog.ts` (surface image `color`); `src/app/(shop)/producto/[id]/page.tsx` + the detail client component; `src/app/(shop)/page.tsx` (grid images); `src/app/admin/products/[id]/page.tsx` + its `actions.ts` (color dropdown, delete); `next.config.ts` (`images.remotePatterns`).

Implementation will branch from `plan4-purchasing` (which carries the full catalog + admin).
