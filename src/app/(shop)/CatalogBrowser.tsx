// src/app/(shop)/CatalogBrowser.tsx
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "./ProductCard";
import LineHero from "./LineHero";
import { matchesFilters } from "@/domain/catalog-filter";
import { productColors } from "@/domain/product-colors";
import type { CatalogItem } from "@/lib/repos/catalog";

export interface BrowserLine {
  slug: string;
  name: string;
  hero_title: string;
  hero_message: string;
}
export interface BrowserCategory {
  slug: string;
  name: string;
}

type Props = {
  items: CatalogItem[];
  lines: BrowserLine[];
  showSections: boolean;
};

function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export default function CatalogBrowser({ items, lines, showSections }: Props) {
  const sp = useSearchParams();
  const catParam = sp.get("cat") ?? "";
  const cats = useMemo(() => parseList(catParam), [catParam]);
  const active = cats.length > 0;
  const filtered = useMemo(
    () => items.filter((i) => matchesFilters(i, { categorySlugs: cats })),
    [items, cats],
  );

  const grid = (list: CatalogItem[]) => (
    <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {list.map((p) => (
        <ProductCard key={p.id} id={p.id} name={p.name} price={p.price}
          images={p.images} colors={productColors(p.colors, p.images)} />
      ))}
      {list.length === 0 && <p className="text-sm text-ink-3">Sin resultados.</p>}
    </div>
  );

  return (
    <main className="min-w-0">
      {showSections && !active
        ? lines
            .filter((l) => items.some((i) => i.lineSlug === l.slug))
            .map((l) => (
              <section key={l.slug} className="mb-10">
                <LineHero line={l} />
                {grid(items.filter((i) => i.lineSlug === l.slug))}
              </section>
            ))
        : grid(filtered)}
    </main>
  );
}
