import { listPOs } from "@/lib/repos/purchasing";
import { formatMXN } from "@/domain/money";
import { newOrder } from "./actions";
import { Button, PageHeader, Table, THead, Th, Td, Tr, LinkRow, ChevronCell, Pill, type PillTone } from "@/components/ui";

function poTone(status: string): PillTone {
  if (status === "parcial") return "info";
  if (status === "recibida") return "success";
  if (status === "cancelada") return "cancelled";
  return "neutral";
}

export default async function ComprasPage() {
  const pos = await listPOs();
  return (
    <div className="p-6">
      <PageHeader title="Órdenes de compra">
        <form action={newOrder}><Button type="submit" variant="primary" size="sm">+ Nueva orden</Button></form>
      </PageHeader>
      <Table>
        <THead>
          <Th>#</Th>
          <Th>Proveedor</Th>
          <Th>Costo</Th>
          <Th>Estado</Th>
          <Th>Fecha</Th>
          <Th className="w-8" />
        </THead>
        <tbody>
          {pos.map((p) => (
            <LinkRow key={p.id} href={`/admin/compras/${p.id}`}>
              <Td className="font-medium">OC-{p.id.slice(0, 8)}</Td>
              <Td>{p.suppliers?.name ?? "—"}</Td>
              <Td>{formatMXN(p.total_cost)}</Td>
              <Td><Pill tone={poTone(p.status)}>{p.status}</Pill></Td>
              <Td className="text-ink-2">{p.created_at.slice(0, 10)}</Td>
              <ChevronCell />
            </LinkRow>
          ))}
          {pos.length === 0 && (
            <Tr><Td colSpan={6} className="py-8 text-center text-ink-3">Sin órdenes aún.</Td></Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
