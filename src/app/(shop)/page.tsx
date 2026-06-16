import Link from "next/link";
import Image from "next/image";
import { listActiveByLine } from "@/lib/repos/catalog";
import { formatMXN } from "@/domain/money";
import { pickProductImage } from "@/domain/product-image";
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
          <div className="relative h-[60vh] flex flex-col justify-end p-6"
            style={{ background: "linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.6)),linear-gradient(135deg,#c9a487,#7c5942)" }}>
            <div className="tracking-[0.3em] text-xs mb-2">CORVE {s.line}</div>
            <h2 className="text-3xl font-bold leading-none">{s.title}</h2>
            <p className="italic opacity-80 mt-1">{s.message}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            {s.products.map((p) => {
              const url = pickProductImage(p.product_images.map((i) => ({ url: i.url, color: i.color })), null);
              return (
                <Link key={p.id} href={`/producto/${p.id}`} className="block">
                  <div className="relative h-44 rounded-lg overflow-hidden bg-gradient-to-br from-[#d8c1ad] to-[#9a7a61]">
                    {url && <Image src={url} alt={p.name} fill sizes="50vw" className="object-cover" />}
                  </div>
                  <div className="text-sm mt-2">{p.name}</div>
                  <div className="text-sm opacity-70">{formatMXN(p.price)}</div>
                </Link>
              );
            })}
            {s.products.length === 0 && <p className="opacity-60 text-sm">Pronto.</p>}
          </div>
        </section>
      ))}
    </main>
  );
}
