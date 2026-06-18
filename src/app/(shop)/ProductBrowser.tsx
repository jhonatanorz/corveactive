// src/app/(shop)/ProductBrowser.tsx
"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProductGrid from "./ProductGrid";
import FilterSortBar from "./FilterSortBar";
import FilterSheet, { type FilterGroup } from "./FilterSheet";
import SortSheet from "./SortSheet";
import { matchesFilters } from "@/domain/catalog-filter";
import { aggregateColors } from "@/domain/catalog-colors";
import { sortItems, parseSortKey, type SortKey } from "@/domain/catalog-sort";
import type { CatalogItem } from "@/lib/repos/catalog";

export type FacetKind = "line" | "category" | "color";

type Props = {
  items: CatalogItem[];
  facets: FacetKind[];
  lineOptions?: { slug: string; name: string }[];
  categoryOptions?: { slug: string; name: string }[];
};

const SORT_LABELS: Record<SortKey, string> = {
  default: "Ordenar",
  price_asc: "Precio ↑",
  price_desc: "Precio ↓",
};
const PARAM: Record<FacetKind, string> = { line: "line", category: "cat", color: "color" };

function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export default function ProductBrowser({ items, facets, lineOptions = [], categoryOptions = [] }: Props) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const lineParam = sp.get("line");
  const catParam = sp.get("cat");
  const colorParam = sp.get("color");
  const sortParam = sp.get("sort");
  const lineSel = useMemo(() => parseList(lineParam), [lineParam]);
  const catSel = useMemo(() => parseList(catParam), [catParam]);
  const colorSel = useMemo(() => parseList(colorParam), [colorParam]);
  const sort = parseSortKey(sortParam);
  const selFor = (facet: FacetKind) => (facet === "line" ? lineSel : facet === "category" ? catSel : colorSel);

  const swatches = useMemo(() => aggregateColors(items.flatMap((i) => i.colors)), [items]);

  const filtered = useMemo(() => {
    const f = {
      lineSlugs: facets.includes("line") ? lineSel : undefined,
      categorySlugs: facets.includes("category") ? catSel : undefined,
      colorKeys: facets.includes("color") ? colorSel : undefined,
    };
    return sortItems(items.filter((i) => matchesFilters(i, f)), sort);
  }, [items, facets, lineSel, catSel, colorSel, sort]);

  function writeParam(param: string, values: string[]) {
    const params = new URLSearchParams(sp.toString());
    if (values.length) params.set(param, values.join(","));
    else params.delete(param);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }
  function toggle(facet: FacetKind, value: string) {
    const cur = selFor(facet);
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    writeParam(PARAM[facet], next);
  }
  function clearAll() {
    const params = new URLSearchParams(sp.toString());
    for (const f of facets) params.delete(PARAM[f]);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }
  function setSort(next: SortKey) {
    const params = new URLSearchParams(sp.toString());
    if (next === "default") params.delete("sort");
    else params.set("sort", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const groups: FilterGroup[] = facets.flatMap((facet): FilterGroup[] => {
    if (facet === "line")
      return [{ key: "line", label: "Línea", type: "chips" as const, options: lineOptions.map((l) => ({ value: l.slug, label: l.name })), selected: lineSel }];
    if (facet === "category")
      return [{ key: "category", label: "Categoría", type: "chips" as const, options: categoryOptions.map((c) => ({ value: c.slug, label: c.name })), selected: catSel }];
    return [{ key: "color", label: "Color", type: "swatches" as const, options: swatches.map((s) => ({ value: s.key, label: s.label, hex: s.hex })), selected: colorSel }];
  });

  const activeFilterCount = facets.reduce((n, f) => n + selFor(f).length, 0);

  return (
    <>
      <FilterSortBar
        activeFilterCount={activeFilterCount}
        sortLabel={SORT_LABELS[sort]}
        onOpenFilter={() => setFilterOpen(true)}
        onOpenSort={() => setSortOpen(true)}
      />
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        groups={groups}
        onToggle={(gk, v) => toggle(gk as FacetKind, v)}
        onClear={clearAll}
        resultCount={filtered.length}
      />
      <SortSheet open={sortOpen} onClose={() => setSortOpen(false)} value={sort} onChange={setSort} />
      <ProductGrid items={filtered} />
    </>
  );
}
