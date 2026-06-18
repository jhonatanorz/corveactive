import { listOrders } from "@/lib/repos/orders";
import { formatMXN } from "@/domain/money";
import { PageHeader, Table, THead, Th, Td, Tr, LinkRow, ChevronCell, Pill, type PillTone } from "@/components/ui";

function orderTone(status: string): PillTone {
  if (status === "confirmado") return "info";
  if (status === "pagado" || status === "enviado" || status === "entregado") return "success";
  if (status === "cancelado") return "cancelled";
  return "neutral";
}

export default async function PedidosPage() {
  const orders = await listOrders();
  return (
    <div className="p-6">
      <PageHeader title="Pedidos" />
      <Table>
        <THead>
          <Th>#</Th>
          <Th>Cliente</Th>
          <Th>Total</Th>
          <Th>Estado</Th>
          <Th>Fecha</Th>
          <Th className="w-8" />
        </THead>
        <tbody>
          {orders.map((o) => (
            <LinkRow key={o.id} href={`/admin/pedidos/${o.id}`} className={o.status === "nuevo" ? "bg-mist/40" : ""}>
              <Td className="font-medium">#{o.id.slice(0, 8)}</Td>
              <Td>{o.customer_name}</Td>
              <Td>{formatMXN(o.total)}</Td>
              <Td><Pill tone={orderTone(o.status)}>{o.status}</Pill></Td>
              <Td className="text-ink-2">{o.created_at.slice(0, 10)}</Td>
              <ChevronCell />
            </LinkRow>
          ))}
          {orders.length === 0 && (
            <Tr><Td colSpan={6} className="py-8 text-center text-ink-3">Sin pedidos aún.</Td></Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
