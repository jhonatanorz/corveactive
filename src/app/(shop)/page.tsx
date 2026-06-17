import Link from "next/link";
import Image from "next/image";
import { listActiveByLine } from "@/lib/repos/catalog";
import { formatMXN } from "@/domain/money";
import { pickProductImage } from "@/domain/product-image";
import { Card, Eyebrow, Blob } from "@/components/ui";
import type { Line } from "@/domain/types";

const LINES: { line: Line; title: string; message: string }[] = [
  { line: "MOVE", title: "Muévete desde el amor", message: "Confianza en cada movimiento" },
  { line: "HIM", title: "Una rutina que respeta tu ritmo", message: "Confianza en cada movimiento" },
];

export default async function CatalogPage() {
  const sections = await Promise.all(
    LINES.map(async (l) => ({ ...l, products: await listActiveByLine(l.line) })),
  );
  return (
    <main>
      {sections.map((s) => (
        <section key={s.line} className="mb-10">
          <div className="relative h-[60vh] flex flex-col justify-end p-6 overflow-hidden bg-royal text-ink-on-royal">
            <Blob fill="periwinkle" className="absolute -top-16 -right-10 w-72 h-72 opacity-80" />
            <Blob fill="lime" className="absolute -bottom-20 -left-10 w-64 h-64 opacity-90 mix-blend-screen" />
            <div className="relative">
              <Eyebrow className="text-periwinkle-2 mb-2">CORVE {s.line}</Eyebrow>
              <h2 className="font-display text-5xl leading-none">{s.title}</h2>
              <p className="italic opacity-80 mt-2">{s.message}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            {s.products.map((p) => {
              const url = pickProductImage(p.product_images.map((i) => ({ url: i.url, color: i.color })), null);
              return (
                <Link key={p.id} href={`/producto/${p.id}`} className="block">
                  <Card className="relative h-44 overflow-hidden bg-mist">
                    {url && <Image src={url} alt={p.name} fill sizes="50vw" className="object-cover" />}
                  </Card>
                  <div className="text-sm mt-2 text-ink">{p.name}</div>
                  <div className="text-sm text-ink-2">{formatMXN(p.price)}</div>
                </Link>
              );
            })}
            {s.products.length === 0 && <p className="text-ink-3 text-sm">Pronto.</p>}
          </div>
        </section>
      ))}
    </main>
  );
}
