// src/app/(shop)/page.tsx
import { listActiveLines } from "@/lib/repos/lines";
import { listActiveCatalog } from "@/lib/repos/catalog";
import CatalogBrowser from "./CatalogBrowser";

export default async function CatalogPage() {
  const [lines, items] = await Promise.all([listActiveLines(), listActiveCatalog()]);
  return (
    <CatalogBrowser
      items={items}
      lines={lines.map((l) => ({ slug: l.slug, name: l.name, hero_title: l.hero_title, hero_message: l.hero_message }))}
      showSections
    />
  );
}
