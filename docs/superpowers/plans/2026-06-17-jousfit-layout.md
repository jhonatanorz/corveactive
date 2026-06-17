# jousfit-style Collection & Product Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give collection cards clickable color dots that crossfade the card image, and restructure the product page into a jousfit-style gallery (main image + all-images thumbnail strip) with synced color/thumbnail selection — in CORVE's design system.

**Architecture:** A pure `productColors` helper feeds both surfaces; a shared `FadeImage` primitive does the crossfade. The catalog query returns per-product variant colors so cards can render hex dots. The collection grid swaps an inline tile for a client `ProductCard`; the PDP gains a thumbnail gallery. No data-model/admin changes — both reuse existing `product_images` (default + one per color).

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind v4, `next/image`, Vitest. Spec: `docs/superpowers/specs/2026-06-17-jousfit-layout-design.md`.

## Global Constraints

- **Visuals/layout only.** No changes to copy, cart, WhatsApp, RLS, RPC, data model, or admin. CORVE design system (royal/ink/mist, Card, pill, DS motion) — not jousfit's colors/fonts.
- **Reuse existing images:** gallery/cards show the current `product_images` rows (default + one per color). No multi-image upload.
- **Interaction is click** (not hover). All image swaps crossfade via `FadeImage` (opacity, ~300ms, ease-out).
- **Dev caveat:** `npm run dev` (Turbopack) panics on Windows over the local font CSS module. Use `npm run build` + `npm start` for the browser walk-through.
- Branch from `design-system`. Build stays green at every task.

---

## Task 1: `productColors` helper (pure, TDD)

**Files:** Create `src/domain/product-colors.ts`, `src/domain/product-colors.test.ts`.

**Interfaces:**
- Consumes: `pickProductImage`, `ImageChoice` from `@/domain/product-image`.
- Produces: `interface ColorOption { color: string; hex: string; url: string | null }` and `productColors(variants: { color: string; color_hex: string }[], images: ImageChoice[]): ColorOption[]`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/product-colors.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { productColors } from "@/domain/product-colors";
import type { ImageChoice } from "@/domain/product-image";

const imgs: ImageChoice[] = [
  { url: "default.jpg", color: null },
  { url: "negro.jpg", color: "Negro" },
];

describe("productColors", () => {
  it("dedupes by color, preserves first-seen order, takes hex from first occurrence", () => {
    const r = productColors(
      [{ color: "Negro", color_hex: "#111" }, { color: "Arena", color_hex: "#caa" }, { color: "Negro", color_hex: "#999" }],
      imgs,
    );
    expect(r.map((c) => c.color)).toEqual(["Negro", "Arena"]);
    expect(r[0].hex).toBe("#111");
  });
  it("resolves each color's image, falling back to the default", () => {
    const r = productColors([{ color: "Negro", color_hex: "#111" }, { color: "Arena", color_hex: "#caa" }], imgs);
    expect(r.find((c) => c.color === "Negro")!.url).toBe("negro.jpg");
    expect(r.find((c) => c.color === "Arena")!.url).toBe("default.jpg");
  });
  it("url is null when the color has no image and there is no default", () => {
    const r = productColors([{ color: "Arena", color_hex: "#caa" }], [{ url: "negro.jpg", color: "Negro" }]);
    expect(r[0].url).toBeNull();
  });
  it("returns [] for no variants", () => {
    expect(productColors([], imgs)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- product-colors`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/domain/product-colors.ts`:
```ts
import { pickProductImage, type ImageChoice } from "./product-image";

export interface ColorOption {
  color: string;
  hex: string;
  url: string | null;
}

/**
 * Distinct colors for a product in first-seen variant order, each with its hex
 * (from the first occurrence) and its image (the color's own, else the default, else null).
 */
export function productColors(
  variants: { color: string; color_hex: string }[],
  images: ImageChoice[],
): ColorOption[] {
  const seen = new Set<string>();
  const out: ColorOption[] = [];
  for (const v of variants) {
    if (seen.has(v.color)) continue;
    seen.add(v.color);
    out.push({ color: v.color, hex: v.color_hex, url: pickProductImage(images, v.color) });
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- product-colors`
Expected: PASS (4).

- [ ] **Step 5: Commit**

```bash
git add src/domain/product-colors.ts src/domain/product-colors.test.ts
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(domain): productColors distinct-colors helper"
```

---

## Task 2: `FadeImage` crossfade primitive

**Files:** Create `src/components/ui/FadeImage.tsx`; Modify `src/components/ui/index.ts`. Verified by tsc/build.

**Interfaces:**
- Produces: `FadeImage` — props `{ src: string | null; alt: string; sizes?: string; className?: string }`. Renders inside a `relative` parent (uses `fill`). Crossfades on `src` change; renders nothing when `src` is null and nothing has shown yet.

- [ ] **Step 1: Create the component**

Create `src/components/ui/FadeImage.tsx`:
```tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = { src: string | null; alt: string; sizes?: string; className?: string };

export function FadeImage({ src, alt, sizes = "100vw", className = "" }: Props) {
  const [current, setCurrent] = useState<string | null>(src);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (src === current || src === incoming) return;
    if (src === null) {
      setCurrent(null);
      setIncoming(null);
      return;
    }
    setIncoming(src);
    setOn(false);
  }, [src, current, incoming]);

  useEffect(() => {
    if (!incoming) return;
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, [incoming]);

  if (current === null && incoming === null) return null;
  const base = `object-cover ${className}`;
  return (
    <>
      {current && <Image key={current} src={current} alt={alt} fill sizes={sizes} className={base} />}
      {incoming && (
        <Image
          key={incoming}
          src={incoming}
          alt={alt}
          fill
          sizes={sizes}
          onTransitionEnd={() => {
            setCurrent(incoming);
            setIncoming(null);
            setOn(false);
          }}
          className={`${base} transition-opacity duration-300 ease-out ${on ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Export from the barrel**

In `src/components/ui/index.ts`, add:
```ts
export { FadeImage } from "./FadeImage";
```

- [ ] **Step 3: Verify & commit**

Run: `npx tsc --noEmit` (exit 0) and `npm run build` (compiles).
```bash
git add src/components/ui/FadeImage.tsx src/components/ui/index.ts
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(ui): FadeImage crossfade primitive"
```

---

## Task 3: Catalog query returns variant colors

**Files:** Modify `src/lib/repos/catalog.ts`. Verified by tsc/build.

**Interfaces:**
- Produces: `interface CatalogListProduct extends CatalogProduct { variants: { color: string; color_hex: string }[] }`; `listActiveByLine(line): Promise<CatalogListProduct[]>`. `CatalogProduct` and `getActiveProduct` unchanged.

- [ ] **Step 1: Add the list type + variant select**

In `src/lib/repos/catalog.ts`, after the `CatalogProduct` interface add:
```ts
export interface CatalogListProduct extends CatalogProduct {
  variants: { color: string; color_hex: string }[];
}
```
Change `listActiveByLine` to select embedded variant colors and return the new type:
```ts
/** Active products for a line, with images + variant colors (anon-readable via RLS). */
export async function listActiveByLine(line: Line): Promise<CatalogListProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(*), variants(color,color_hex)")
    .eq("status", "active")
    .eq("line", line)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CatalogListProduct[];
}
```
(Leave `getActiveProduct` and `ProductDetail` exactly as they are — the PDP already gets full `variants` separately.)

- [ ] **Step 2: Verify & commit**

Run: `npx tsc --noEmit` (exit 0). Note: `(shop)/page.tsx` still compiles because `CatalogListProduct extends CatalogProduct` (it gains a field). Then `npm run build` (compiles).
```bash
git add src/lib/repos/catalog.ts
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(catalog): list query returns variant colors"
```

---

## Task 4: Collection `ProductCard` with color dots

**Files:** Create `src/app/(shop)/ProductCard.tsx`; Modify `src/app/(shop)/page.tsx`. Verified by build + manual.

**Interfaces:**
- Consumes: `productColors`/`ColorOption` (Task 1), `FadeImage` (Task 2), `CatalogListProduct.variants` (Task 3), `pickProductImage`/`ImageChoice`, `Card`.

- [ ] **Step 1: Create `ProductCard`**

Create `src/app/(shop)/ProductCard.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMXN } from "@/domain/money";
import { pickProductImage, type ImageChoice } from "@/domain/product-image";
import type { ColorOption } from "@/domain/product-colors";
import { Card, FadeImage } from "@/components/ui";

type Props = {
  id: string;
  name: string;
  price: number;
  images: ImageChoice[];
  colors: ColorOption[];
};

export default function ProductCard({ id, name, price, images, colors }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const url = pickProductImage(images, selected);

  return (
    <div>
      <Link href={`/producto/${id}`} className="block">
        <Card className="relative h-44 overflow-hidden bg-mist">
          <FadeImage src={url} alt={name} sizes="50vw" />
        </Card>
      </Link>
      {colors.length > 0 && (
        <div className="flex gap-1.5 mt-2">
          {colors.map((c) => (
            <button
              key={c.color}
              type="button"
              aria-label={c.color}
              onClick={() => setSelected((s) => (s === c.color ? null : c.color))}
              className={`w-4 h-4 rounded-pill border border-line transition ${selected === c.color ? "ring-2 ring-royal ring-offset-1" : ""}`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      )}
      <Link href={`/producto/${id}`} className="block">
        <div className="text-sm mt-2 text-ink">{name}</div>
        <div className="text-sm text-ink-2">{formatMXN(price)}</div>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the grid**

In `src/app/(shop)/page.tsx`, replace the imports block and the grid-tile `map` so tiles render `ProductCard`. The new top imports:
```tsx
import { listActiveByLine } from "@/lib/repos/catalog";
import { productColors } from "@/domain/product-colors";
import { Eyebrow, Blob } from "@/components/ui";
import ProductCard from "./ProductCard";
import type { Line } from "@/domain/types";
```
(Remove the now-unused `Link`, `Image`, `formatMXN`, `pickProductImage`, and `Card` imports — they moved into `ProductCard`.)

Replace the `{s.products.map((p) => { … })}` block inside `<div className="grid grid-cols-2 gap-3 p-4">` with:
```tsx
{s.products.map((p) => {
  const imgs = p.product_images.map((i) => ({ url: i.url, color: i.color }));
  return (
    <ProductCard
      key={p.id}
      id={p.id}
      name={p.name}
      price={p.price}
      images={imgs}
      colors={productColors(p.variants, imgs)}
    />
  );
})}
{s.products.length === 0 && <p className="text-ink-3 text-sm">Pronto.</p>}
```
Leave the royal cover block (`bg-royal`, `Blob`, `Eyebrow`, `font-display` title) unchanged.

- [ ] **Step 3: Verify & manual**

Run: `npm run build` (compiles). Manual (after Task 6 serve): a card with ≥2 colors shows hex dots; clicking a dot crossfades the card image and rings the dot; clicking the dot again returns to default; tapping a dot does NOT navigate; tapping the image/name does.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(shop)/ProductCard.tsx" "src/app/(shop)/page.tsx"
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(shop): collection cards with color dots that swap the image"
```

---

## Task 5: Product page gallery

**Files:** Modify `src/app/(shop)/producto/[id]/page.tsx`, `src/app/(shop)/producto/[id]/ProductDetailClient.tsx`. Verified by build + manual.

**Interfaces:**
- Consumes: `productColors`/`ColorOption` (Task 1), `FadeImage` (Task 2), `pickProductImage`/`ImageChoice`, `availableByColor`, `Button`, `Eyebrow`.

- [ ] **Step 1: Pass `colors` from the server page**

Replace `src/app/(shop)/producto/[id]/page.tsx` with:
```tsx
import { notFound } from "next/navigation";
import { getActiveProduct } from "@/lib/repos/catalog";
import { productColors } from "@/domain/product-colors";
import ProductDetailClient from "./ProductDetailClient";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getActiveProduct(id);
  if (!detail) notFound();
  const { product, variants } = detail;
  const images = product.product_images.map((i) => ({ url: i.url, color: i.color }));

  return (
    <ProductDetailClient
      productId={product.id}
      productName={product.name}
      price={product.price}
      line={product.line}
      description={product.description}
      variants={variants.map((v) => ({ id: v.id, color: v.color, size: v.size, stock: v.stock }))}
      images={images}
      colors={productColors(variants, images)}
    />
  );
}
```

- [ ] **Step 2: Rebuild `ProductDetailClient` with the gallery**

Replace `src/app/(shop)/producto/[id]/ProductDetailClient.tsx` with:
```tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { availableByColor, type AvailVariant } from "@/domain/availability";
import { pickProductImage, type ImageChoice } from "@/domain/product-image";
import type { ColorOption } from "@/domain/product-colors";
import { formatMXN } from "@/domain/money";
import { Button, Eyebrow, FadeImage } from "@/components/ui";

interface VariantLite extends AvailVariant { id: string }

type Props = {
  productId: string;
  productName: string;
  price: number;
  line: string;
  description: string;
  variants: VariantLite[];
  images: ImageChoice[];
  colors: ColorOption[];
};

export default function ProductDetailClient({ productId, productName, price, line, description, variants, images, colors }: Props) {
  const router = useRouter();
  const { add } = useCart();
  const byColor = availableByColor(variants);
  const [color, setColor] = useState(colors[0]?.color ?? "");
  const [size, setSize] = useState("");
  const [activeUrl, setActiveUrl] = useState<string | null>(() => pickProductImage(images, colors[0]?.color ?? null));

  const sizes = byColor.find((c) => c.color === color)?.sizes ?? [];
  const chosen = variants.find((v) => v.color === color && v.size === size);

  function selectColor(c: string) {
    setColor(c);
    setSize("");
    setActiveUrl(pickProductImage(images, c));
  }
  function selectThumb(img: ImageChoice) {
    setActiveUrl(img.url);
    if (img.color) {
      setColor(img.color);
      setSize("");
    }
  }

  return (
    <main className="md:flex md:gap-6 md:max-w-4xl md:mx-auto md:p-6">
      {/* gallery */}
      <div className="md:w-1/2 md:flex md:gap-3">
        <div className="order-1 md:order-2 relative h-96 md:h-[28rem] md:flex-1 bg-mist overflow-hidden">
          <FadeImage src={activeUrl} alt={productName} sizes="(min-width:768px) 40vw, 100vw" />
        </div>
        {images.length > 1 && (
          <div className="order-2 md:order-1 flex md:flex-col gap-2 p-3 md:p-0 overflow-x-auto md:overflow-visible">
            {images.map((img) => (
              <button
                key={img.url}
                type="button"
                aria-label="Ver imagen"
                onClick={() => selectThumb(img)}
                className={`relative w-16 h-20 shrink-0 rounded-md overflow-hidden bg-mist border transition ${activeUrl === img.url ? "ring-2 ring-royal border-transparent" : "border-line"}`}
              >
                <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* info */}
      <div className="md:w-1/2">
        <div className="p-4">
          <h1 className="text-2xl font-semibold text-ink">{productName}</h1>
          <div className="text-ink-2 mb-2">{formatMXN(price)} · CORVE {line}</div>
          {description && <p className="italic text-sm text-ink-2">{description}</p>}
        </div>
        <div className="p-4 space-y-3">
          <Eyebrow>Color</Eyebrow>
          <div className="flex gap-2">
            {colors.map((c) => (
              <button
                key={c.color}
                type="button"
                aria-label={c.color}
                onClick={() => selectColor(c.color)}
                className={`w-7 h-7 rounded-pill border border-line transition ${color === c.color ? "ring-2 ring-royal ring-offset-1" : ""}`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <Eyebrow>Talla</Eyebrow>
          <div className="flex gap-2">
            {sizes.map((s) => (
              <button key={s.size} disabled={!s.inStock} onClick={() => setSize(s.size)}
                className={`px-3 py-1 rounded-pill border text-sm transition ${s.size === size ? "bg-periwinkle-2 text-royal border-transparent" : "border-line-strong text-ink"} ${!s.inStock ? "opacity-30 line-through" : ""}`}>
                {s.size}
              </button>
            ))}
          </div>
          <Button variant="primary" disabled={!chosen} className="w-full"
            onClick={() => {
              if (!chosen) return;
              add({ variantId: chosen.id, productId, productName, color, size, unitPrice: price, qty: 1 });
              router.push("/carrito");
            }}>
            Agregar · {formatMXN(price)}
          </Button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify & manual**

Run: `npx tsc --noEmit` (exit 0) and `npm run build` (compiles). Manual (after Task 6 serve): PDP shows a main image + a thumbnail strip of all images; clicking a thumbnail crossfades the main and (for a color image) selects that color dot; clicking a color dot swaps the main image and rings the matching thumbnail; size + Agregar still work; on mobile thumbnails sit below the main image, on desktop they're a vertical column to its left.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(shop)/producto/[id]/page.tsx" "src/app/(shop)/producto/[id]/ProductDetailClient.tsx"
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(shop): product gallery with thumbnails and synced color selection"
```

---

## Task 6: Verification

**Files:** none.

- [ ] **Step 1: Tests + types + build**

Run: `npm test` (75 pass — Task 1 adds 4), `npx tsc --noEmit` (exit 0), `npm run build` (compiles). Confirm `git status` clean.

- [ ] **Step 2: Serve the production build**

(Dev server panics on Windows over the font module; use production.)
```bash
# kill anything on :3000 first if needed, then:
npm run build
npm start
```
Ensure the local Supabase stack is up and the seeded product (`Legging Aurora`, colors Negro + Arena, with a default + a Negro image) exists; if not, re-seed an active product with two colored variants and a default + one colored image.

- [ ] **Step 3: Browser walk-through** (mobile ~390px and desktop ≥768px):
  1. **Collection `/`** — a multi-color card shows hex dots; clicking a dot crossfades the card image and rings it; dot does not navigate; image/name do.
  2. **PDP** — main image + thumbnail strip of all images; thumbnail click crossfades the main and selects the color; color-dot click swaps the main image and rings the matching thumbnail; size + royal Agregar still add the variant and route to `/carrito`.
  3. **Responsive** — thumbnails below the main image on mobile; vertical-left on desktop.

- [ ] **Step 4: Final commit (if any walk-through fixes)**

```bash
git add -A
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "fix(shop): jousfit-layout walk-through polish"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** `productColors` helper (T1); `FadeImage` crossfade (T2); catalog query returns variant colors (T3); collection `ProductCard` with color dots + image swap (T4); PDP gallery with all-images thumbnails + color/thumbnail sync + responsive layout + color dots replacing text chips (T5); unit test + prod-build browser walk-through (T1, T6). "Clicking a color's thumbnail also selects that color" → `selectThumb` in T5. No data-model/admin change (Global Constraints).
- **Placeholder scan:** every code step carries full code; no TBD/TODO.
- **Type consistency:** `ColorOption {color,hex,url}` and `productColors(variants,images)` defined in T1, consumed unchanged in T4/T5; `FadeImage` props `{src,alt,sizes?,className?}` defined T2, used T4/T5; `CatalogListProduct.variants: {color,color_hex}[]` (T3) consumed via `p.variants` in T4; `ProductDetailClient` gains `colors: ColorOption[]` prop (T5 page passes it, T5 client consumes it). `pickProductImage(images, color|null)` usage matches its existing signature.

---

## After this feature
No new deploy steps. The catalog still needs the cloud Supabase image host added to `next.config.ts` at deploy (carried from earlier plans).
