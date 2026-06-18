# Lot-Based Inventory & Costing Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `products.cost` with FIFO inventory lots created from purchases and consumed by sales/adjustments, so cost traces to purchases and inventory can be valued.

**Architecture:** `stock_movements` becomes the canonical ledger (with real `po_item_id`/`order_item_id` FKs). Inbound movements (PO receipt, manual `+`) create `inventory_lots`; outbound movements (sale, manual `−`) consume lots FIFO into `inventory_consumptions`. The atomic plpgsql RPCs do all mutation. `variants.stock` and `order_items.cost` are RPC-maintained caches.

**Tech Stack:** Supabase (Postgres + plpgsql + RLS), Next.js 16, TypeScript, Vitest. Spec: `docs/superpowers/specs/2026-06-17-inventory-costing-model-design.md`.

## Global Constraints

- **Money is integer centavos** everywhere. `order_items.cost` stays **per-unit** (weighted COGS = `round(total_cogs / qty)`) so `summarizeSales` is unchanged.
- **FIFO:** consume lots with `qty_remaining > 0` ordered by `created_at, id` (oldest first); refuse when on-hand is insufficient.
- All inventory mutation goes through the **atomic `security definer` RPCs** — never write lots/consumptions from the TS layer.
- Manual `−` adjustments are valued (consume lots) but are **not** sales — they never appear in Ventas revenue/profit.
- DB tasks (3, 4, 5-test, 7) need the **local Supabase stack up** (Docker). Build-only tasks (1, 2) do not. If Docker is down, write the files and run the live checks once it's back.
- Branch from `ui-polish`. Build stays green at every task.

---

## Task 1: Domain — current-cost & inventory-value helpers (TDD)

**Files:** Create `src/domain/inventory.ts`, `src/domain/inventory.test.ts`.

**Interfaces:**
- Produces: `interface Lot { qty_remaining: number; unit_cost: number }`; `currentCost(lots: Lot[]): number | null`; `inventoryValue(lots: Lot[]): number`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/inventory.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { currentCost, inventoryValue, type Lot } from "@/domain/inventory";

const lots: Lot[] = [
  { qty_remaining: 2, unit_cost: 10000 },
  { qty_remaining: 3, unit_cost: 20000 },
];

describe("currentCost", () => {
  it("weighted-averages the remaining lots", () => {
    expect(currentCost(lots)).toBe(16000); // (2*10000 + 3*20000)/5
  });
  it("rounds to the nearest centavo", () => {
    expect(currentCost([{ qty_remaining: 3, unit_cost: 100 }, { qty_remaining: 0, unit_cost: 999 }])).toBe(100);
  });
  it("returns null when nothing is on hand", () => {
    expect(currentCost([{ qty_remaining: 0, unit_cost: 100 }])).toBeNull();
    expect(currentCost([])).toBeNull();
  });
});

describe("inventoryValue", () => {
  it("sums qty_remaining × unit_cost", () => {
    expect(inventoryValue(lots)).toBe(80000);
  });
  it("is 0 for no lots", () => {
    expect(inventoryValue([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- inventory` → FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/domain/inventory.ts`:
```ts
export interface Lot {
  qty_remaining: number;
  unit_cost: number; // centavos
}

/** Weighted-average cost of the remaining on-hand lots (centavos), or null if nothing on hand. */
export function currentCost(lots: Lot[]): number | null {
  const onHand = lots.reduce((s, l) => s + l.qty_remaining, 0);
  if (onHand <= 0) return null;
  const value = lots.reduce((s, l) => s + l.qty_remaining * l.unit_cost, 0);
  return Math.round(value / onHand);
}

/** Total value of on-hand inventory (centavos). */
export function inventoryValue(lots: Lot[]): number {
  return lots.reduce((s, l) => s + l.qty_remaining * l.unit_cost, 0);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- inventory` → PASS (5).

- [ ] **Step 5: Commit**

```bash
git add src/domain/inventory.ts src/domain/inventory.test.ts
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(domain): currentCost + inventoryValue helpers"
```

---

## Task 2: Remove product-level cost from the TS layer

**Files:** Modify `src/lib/db-types.ts`, `src/lib/admin/product-input.ts`, `src/lib/admin/product-input.test.ts`, `src/app/admin/products/[id]/actions.ts`, `src/lib/repos/products.ts`, `src/app/admin/products/[id]/ProductForm.tsx`. Verified by tsc/build + tests.

**Interfaces:**
- Produces: `ProductRow` without `cost`; `ProductPayload` without `cost`; new `InventoryLotRow`, `InventoryConsumptionRow`; `StockMovementRow` gains `po_item_id`/`order_item_id`.

- [ ] **Step 1: db-types**

In `src/lib/db-types.ts`: remove the `cost: number;` line from `ProductRow`. Add `po_item_id`/`order_item_id` to `StockMovementRow` and add the two new row types:
```ts
export interface StockMovementRow {
  id: string;
  variant_id: string;
  delta: number;
  type: MovementType;
  reference: string | null;
  reason: string | null;
  po_item_id: string | null;
  order_item_id: string | null;
  created_at: string;
}

export interface InventoryLotRow {
  id: string;
  variant_id: string;
  source_movement_id: string | null;
  unit_cost: number; // centavos
  qty_received: number;
  qty_remaining: number;
  created_at: string;
}

export interface InventoryConsumptionRow {
  id: string;
  movement_id: string;
  lot_id: string;
  qty: number;
  unit_cost: number; // centavos
}
```

- [ ] **Step 2: product-input (drop cost)**

In `src/lib/admin/product-input.ts`: remove `cost: Centavos;` from `ProductPayload`; delete the `costRaw`/`cost` parsing block (lines computing `cost`); remove `cost` from the returned `value`. In `src/lib/admin/product-input.test.ts`: remove any assertions/fixtures referencing `cost` (read the file; delete only the cost-related lines so the remaining tests still pass).

- [ ] **Step 3: saveProduct action**

In `src/app/admin/products/[id]/actions.ts`, the `saveProduct` raw-field list: change `["name", "line", "type", "description", "price", "cost", "status"]` to `["name", "line", "type", "description", "price", "status"]` (drop `"cost"`).

- [ ] **Step 4: products repo**

Read `src/lib/repos/products.ts`. In `createProduct` and `updateProduct`, remove `cost` from the inserted/updated columns (the `ProductPayload` no longer has it). Leave everything else.

- [ ] **Step 5: ProductForm (drop cost input + product-level margin)**

Read `src/app/admin/products/[id]/ProductForm.tsx`. Remove the **Costo** input field and any product-level margin display that uses `calcMargin(price, cost)` / the product `cost` (per-variant cost/margin is added in Task 6). Remove the now-unused `calcMargin` import if nothing else uses it. Keep price, name, line, type, description, status fields.

- [ ] **Step 6: Verify & commit**

Run: `npm test` (product-input tests pass minus cost), `npx tsc --noEmit` (exit 0 — confirm no remaining `.cost` references to `ProductRow`/`ProductPayload`), `npm run build` (compiles).
```bash
git add src/lib/db-types.ts src/lib/admin/product-input.ts src/lib/admin/product-input.test.ts "src/app/admin/products/[id]/actions.ts" src/lib/repos/products.ts "src/app/admin/products/[id]/ProductForm.tsx"
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "refactor: remove product-level cost from the TS layer"
```

---

## Task 3: Migration `0007` — schema, opening lots, drop cost

**Files:** Create `supabase/migrations/0007_inventory_lots.sql`. Needs the local stack.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0007_inventory_lots.sql`:
```sql
-- Lot-based inventory. stock_movements becomes the ledger; lots are costed stock
-- created by inbound movements and consumed FIFO by outbound movements.

alter table stock_movements
  add column po_item_id    uuid references purchase_order_items(id) on delete set null,
  add column order_item_id uuid references order_items(id)          on delete set null;

create table inventory_lots (
  id                 uuid primary key default gen_random_uuid(),
  variant_id         uuid not null references variants(id) on delete cascade,
  source_movement_id uuid references stock_movements(id) on delete set null,
  unit_cost          integer not null,  -- centavos
  qty_received       integer not null,
  qty_remaining      integer not null,
  created_at         timestamptz not null default now()
);
create index on inventory_lots (variant_id, qty_remaining);
create index on inventory_lots (variant_id, created_at);

create table inventory_consumptions (
  id          uuid primary key default gen_random_uuid(),
  movement_id uuid not null references stock_movements(id) on delete cascade,
  lot_id      uuid not null references inventory_lots(id) on delete restrict,
  qty         integer not null,
  unit_cost   integer not null   -- centavos
);
create index on inventory_consumptions (movement_id);
create index on inventory_consumptions (lot_id);

-- Opening lots: one lot per variant with stock, valued at the product's current cost.
do $$
declare r record; v_mv uuid;
begin
  for r in
    select vr.id as variant_id, vr.stock as stock, p.cost as cost
    from variants vr join products p on p.id = vr.product_id
    where vr.stock > 0
  loop
    insert into stock_movements (variant_id, delta, type, reason)
      values (r.variant_id, r.stock, 'correccion', 'saldo inicial')
      returning id into v_mv;
    insert into inventory_lots (variant_id, source_movement_id, unit_cost, qty_received, qty_remaining)
      values (r.variant_id, v_mv, r.cost, r.stock, r.stock);
  end loop;
end $$;

-- Cost now lives on lots, not products.
alter table products drop column cost;

-- RLS/grants for the new tables (mirror 0002: admin = authenticated, full access).
grant select, insert, update, delete on inventory_lots, inventory_consumptions to authenticated;
alter table inventory_lots          enable row level security;
alter table inventory_consumptions  enable row level security;
create policy admin_all on inventory_lots         for all to authenticated using (true) with check (true);
create policy admin_all on inventory_consumptions for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Apply & verify** (local stack up)

Run `npx supabase db reset` (re-applies 0001–0007 + seed). Verify schema + opening lots:
```bash
node --input-type=module -e "import{createClient}from'@supabase/supabase-js';const c=createClient('http://127.0.0.1:54321','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU');const a=await c.from('inventory_lots').select('id').limit(1);const b=await c.from('products').select('cost').limit(1);console.log('lots table:',a.error?('ERR '+a.error.message):'OK');console.log('products.cost dropped:', b.error?('YES ('+b.error.message.slice(0,30)+')'):'NO — still present');"
```
Expected: `lots table: OK` and `products.cost dropped: YES`. (The service_role grant gap may make the lots read error with "permission denied" rather than a missing-table error — that still confirms the table exists; the `products.cost` check is the key signal.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_inventory_lots.sql
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(db): inventory_lots + consumptions, drop products.cost (0007)"
```

---

## Task 4: Migration `0008` — FIFO RPCs

**Files:** Create `supabase/migrations/0008_inventory_rpcs.sql`. Needs the local stack.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0008_inventory_rpcs.sql`:
```sql
-- FIFO consumption + rewritten receive/place/cancel + new adjust_inventory.

-- Consume p_qty from a variant's lots oldest-first, recording consumptions against
-- p_movement_id. Returns total COGS (centavos). Raises if on-hand is insufficient.
create or replace function _consume_fifo(p_variant_id uuid, p_qty int, p_movement_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_left int := p_qty; v_lot record; v_take int; v_cogs int := 0;
begin
  for v_lot in
    select id, qty_remaining, unit_cost from inventory_lots
    where variant_id = p_variant_id and qty_remaining > 0
    order by created_at, id for update
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_lot.qty_remaining);
    update inventory_lots set qty_remaining = qty_remaining - v_take where id = v_lot.id;
    insert into inventory_consumptions (movement_id, lot_id, qty, unit_cost)
      values (p_movement_id, v_lot.id, v_take, v_lot.unit_cost);
    v_cogs := v_cogs + v_take * v_lot.unit_cost;
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then raise exception 'insufficient_lots:%', p_variant_id; end if;
  return v_cogs;
end; $$;

-- Receive: per line add stock, log an inbound movement, create a lot at the line's unit_cost.
create or replace function receive_purchase_order(p_po_id uuid, p_receipts jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r jsonb; v_add int; v_line purchase_order_items%rowtype; v_mv uuid; v_all boolean;
begin
  for r in select * from jsonb_array_elements(p_receipts) loop
    v_add := (r->>'qty')::int;
    if v_add is null or v_add < 0 then raise exception 'invalid_receipt'; end if;
    if v_add = 0 then continue; end if;

    select * into v_line from purchase_order_items
      where po_id = p_po_id and variant_id = (r->>'variant_id')::uuid for update;
    if not found then raise exception 'po_line_not_found'; end if;
    if v_add > (v_line.qty_ordered - v_line.qty_received) then raise exception 'exceeds_outstanding'; end if;

    update variants set stock = stock + v_add where id = v_line.variant_id;

    insert into stock_movements (variant_id, delta, type, po_item_id, reference)
      values (v_line.variant_id, v_add, 'reabasto', v_line.id, 'OC-' || left(p_po_id::text, 8))
      returning id into v_mv;

    insert into inventory_lots (variant_id, source_movement_id, unit_cost, qty_received, qty_remaining)
      values (v_line.variant_id, v_mv, v_line.unit_cost, v_add, v_add);

    update purchase_order_items set qty_received = qty_received + v_add where id = v_line.id;
  end loop;

  select bool_and(qty_received >= qty_ordered) into v_all from purchase_order_items where po_id = p_po_id;
  update purchase_orders
    set status = (case when coalesce(v_all, false) then 'recibida' else 'parcial' end)::po_status
    where id = p_po_id;
end; $$;

-- Place order: per item lock+check stock, decrement, snapshot the line, log an outbound
-- movement, consume lots FIFO, store per-unit weighted COGS in order_items.cost.
create or replace function place_order(p_customer_name text, p_customer_whatsapp text, p_delivery_note text, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid; v_item jsonb; v_qty int; v_variant variants%rowtype; v_product products%rowtype;
  v_total int := 0; v_oi_id uuid; v_mv uuid; v_cogs int;
begin
  if p_customer_name is null or btrim(p_customer_name) = '' then raise exception 'name_required'; end if;
  if p_customer_whatsapp is null or btrim(p_customer_whatsapp) = '' then raise exception 'whatsapp_required'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'empty_cart'; end if;

  insert into orders (customer_name, customer_whatsapp, delivery_note, status, total)
    values (btrim(p_customer_name), btrim(p_customer_whatsapp), nullif(btrim(coalesce(p_delivery_note,'')),''), 'nuevo', 0)
    returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'invalid_qty'; end if;

    select * into v_variant from variants where id = (v_item->>'variant_id')::uuid for update;
    if not found then raise exception 'variant_not_found'; end if;
    if v_variant.stock < v_qty then raise exception 'insufficient_stock:%', v_variant.id; end if;

    select * into v_product from products where id = v_variant.product_id;
    if v_product.status <> 'active' then raise exception 'product_unavailable'; end if;

    update variants set stock = stock - v_qty where id = v_variant.id;

    insert into order_items (order_id, variant_id, product_name, line, color, size, unit_price, cost, qty)
      values (v_order_id, v_variant.id, v_product.name, v_product.line, v_variant.color, v_variant.size, v_product.price, 0, v_qty)
      returning id into v_oi_id;

    insert into stock_movements (variant_id, delta, type, order_item_id, reference)
      values (v_variant.id, -v_qty, 'pedido', v_oi_id, '#' || left(v_order_id::text, 8))
      returning id into v_mv;

    v_cogs := _consume_fifo(v_variant.id, v_qty, v_mv);
    update order_items set cost = round(v_cogs::numeric / v_qty) where id = v_oi_id;

    v_total := v_total + v_product.price * v_qty;
  end loop;

  update orders set total = v_total where id = v_order_id;
  return v_order_id;
end; $$;

-- Cancel: restore the exact lots each order_item consumed, log a cancelacion movement,
-- restore the variant stock. Idempotent via the stock_restored guard.
create or replace function cancel_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_restored boolean; v_item record; v_con record; v_mv uuid;
begin
  select stock_restored into v_restored from orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;

  if not v_restored then
    for v_item in
      select oi.id as order_item_id, oi.variant_id, oi.qty
      from order_items oi where oi.order_id = p_order_id and oi.variant_id is not null
    loop
      update variants set stock = stock + v_item.qty where id = v_item.variant_id;
      insert into stock_movements (variant_id, delta, type, reference)
        values (v_item.variant_id, v_item.qty, 'cancelacion', '#' || left(p_order_id::text, 8))
        returning id into v_mv;
      for v_con in
        select c.lot_id, c.qty from inventory_consumptions c
        join stock_movements m on m.id = c.movement_id
        where m.order_item_id = v_item.order_item_id
      loop
        update inventory_lots set qty_remaining = qty_remaining + v_con.qty where id = v_con.lot_id;
      end loop;
    end loop;
  end if;

  update orders set status = 'cancelado', stock_restored = true where id = p_order_id;
end; $$;

-- Manual adjustment: positive creates a lot (cost = given, else variant weighted cost, else 0);
-- negative consumes lots FIFO. Logged as a 'correccion' movement.
create or replace function adjust_inventory(p_variant_id uuid, p_delta int, p_reason text, p_unit_cost int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_mv uuid; v_cost int;
begin
  if p_delta = 0 then return; end if;
  perform 1 from variants where id = p_variant_id for update;

  if p_delta > 0 then
    v_cost := coalesce(p_unit_cost, (
      select case when coalesce(sum(qty_remaining),0) > 0
        then round(sum(qty_remaining * unit_cost)::numeric / sum(qty_remaining)) else 0 end
      from inventory_lots where variant_id = p_variant_id));
    update variants set stock = stock + p_delta where id = p_variant_id;
    insert into stock_movements (variant_id, delta, type, reason)
      values (p_variant_id, p_delta, 'correccion', p_reason) returning id into v_mv;
    insert into inventory_lots (variant_id, source_movement_id, unit_cost, qty_received, qty_remaining)
      values (p_variant_id, v_mv, coalesce(v_cost,0), p_delta, p_delta);
  else
    update variants set stock = stock + p_delta where id = p_variant_id;
    insert into stock_movements (variant_id, delta, type, reason)
      values (p_variant_id, p_delta, 'correccion', p_reason) returning id into v_mv;
    perform _consume_fifo(p_variant_id, -p_delta, v_mv);
  end if;
end; $$;

grant execute on function place_order(text, text, text, jsonb)        to anon, authenticated;
grant execute on function cancel_order(uuid)                          to authenticated;
grant execute on function receive_purchase_order(uuid, jsonb)         to authenticated;
grant execute on function adjust_inventory(uuid, int, text, int)      to authenticated;
```

- [ ] **Step 2: Apply**

Run `npx supabase db reset`. Expected: finishes without error (all 8 migrations apply).

- [ ] **Step 3: DB behaviour test** (local stack up)

Create `/tmp/inv_test.mjs`, run it, then delete it. It seeds a product + variant + supplier + PO with two receipts at different costs, sells across both lots, and asserts FIFO COGS + cancel restore:
```bash
cat > /tmp/inv_test.mjs <<'EOF'
import { createClient } from "@supabase/supabase-js";
const url="http://127.0.0.1:54321";
const anon="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const svc="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const s=createClient(url,svc,{auth:{persistSession:false}});
const a=createClient(url,anon);
await s.auth.admin.createUser({email:"admin@corve.test",password:"corve1234",email_confirm:true}).catch(()=>{});
await a.auth.signInWithPassword({email:"admin@corve.test",password:"corve1234"});
const p=(await a.from("products").insert({name:"T",line:"MOVE",type:"x",price:69000,status:"active"}).select("id").single()).data;
const v=(await a.from("variants").insert({product_id:p.id,color:"Negro",size:"M",stock:0}).select("id").single()).data;
const sup=(await a.from("suppliers").insert({name:"S"}).select("id").single()).data;
const po=(await a.from("purchase_orders").insert({supplier_id:sup.id,status:"pedida"}).select("id").single()).data;
await a.from("purchase_order_items").insert({po_id:po.id,variant_id:v.id,qty_ordered:5,unit_cost:10000});
// receive 2 @ 10000, then bump cost line & receive 3 @ 20000 (new PO line cost) — simulate two lots:
await a.rpc("receive_purchase_order",{p_po_id:po.id,p_receipts:[{variant_id:v.id,qty:2}]});
await a.from("purchase_order_items").update({unit_cost:20000}).eq("po_id",po.id).eq("variant_id",v.id);
await a.rpc("receive_purchase_order",{p_po_id:po.id,p_receipts:[{variant_id:v.id,qty:3}]});
// now lots: 2@10000 then 3@20000. Sell 3 -> COGS = 2*10000 + 1*20000 = 40000 over 3 = 13333/unit.
const ord=(await a.rpc("place_order",{p_customer_name:"X",p_customer_whatsapp:"55",p_delivery_note:null,p_items:[{variant_id:v.id,qty:3}]})).data;
const oi=(await a.from("order_items").select("cost,qty").eq("order_id",ord).single()).data;
const lots=(await a.from("inventory_lots").select("unit_cost,qty_remaining").eq("variant_id",v.id).order("created_at")).data;
const vrow=(await a.from("variants").select("stock").eq("id",v.id).single()).data;
console.log("order_items.cost (per-unit weighted):", oi.cost, "expected ~13333");
console.log("lots remaining:", JSON.stringify(lots), "expected [0@10000, 2@20000]");
console.log("variant stock:", vrow.stock, "expected 2");
// manual minus 1 (shrinkage) -> consumes the 20000 lot
await a.rpc("adjust_inventory",{p_variant_id:v.id,p_delta:-1,p_reason:"merma"});
const v2=(await a.from("variants").select("stock").eq("id",v.id).single()).data;
console.log("after -1 adjust, stock:", v2.stock, "expected 1");
// cancel the order -> restores lots + stock
await a.rpc("cancel_order",{p_order_id:ord});
const v3=(await a.from("variants").select("stock").eq("id",v.id).single()).data;
console.log("after cancel, stock:", v3.stock, "expected 4 (1 + 3 restored)");
EOF
node /tmp/inv_test.mjs; rm -f /tmp/inv_test.mjs
```
Expected: `order_items.cost ≈ 13333`, lots remaining `[0@10000, 2@20000]`, stock 2 → 1 (after −1) → 4 (after cancel restores the 3 sold). If any assertion is off, fix the SQL and re-`db reset`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_inventory_rpcs.sql
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(db): FIFO RPCs — receive/place/cancel + adjust_inventory (0008)"
```

---

## Task 5: Repos — adjust_inventory wrapper + cost reads

**Files:** Modify `src/lib/repos/inventory.ts`, `src/app/admin/products/[id]/actions.ts`. Verified by tsc/build (+ behaviour covered by Task 4's DB test and Task 7 E2E).

**Interfaces:**
- Produces: `adjustStockToTarget(variantId: string, target: number, reason: string, unitCost?: number | null): Promise<void>`; `listVariantLots(productId: string): Promise<Record<string, Lot[]>>` (variantId → lots) for per-variant cost display.

- [ ] **Step 1: inventory repo**

Replace the body of `src/lib/repos/inventory.ts` with (keep `listMovements`):
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Lot } from "@/domain/inventory";
import type { StockMovementRow } from "@/lib/db-types";

/** Adjust a variant's stock to an absolute target via the atomic adjust_inventory RPC.
 *  For an increase, `unitCost` (centavos) sets the new lot's cost (else the RPC defaults
 *  to the variant's current weighted cost). For a decrease it consumes lots FIFO. */
export async function adjustStockToTarget(
  variantId: string,
  target: number,
  reason: string,
  unitCost?: number | null,
): Promise<void> {
  const supabase = await createClient();
  const { data: variant, error } = await supabase
    .from("variants").select("stock").eq("id", variantId).single();
  if (error) throw error;
  const delta = target - (variant as { stock: number }).stock;
  if (delta === 0) return;
  const { error: rpcErr } = await supabase.rpc("adjust_inventory", {
    p_variant_id: variantId,
    p_delta: delta,
    p_reason: reason,
    p_unit_cost: delta > 0 ? (unitCost ?? null) : null,
  });
  if (rpcErr) throw rpcErr;
}

/** Lots (for current-cost display) grouped by variant, for a product's variants. */
export async function listVariantLots(productId: string): Promise<Record<string, Lot[]>> {
  const supabase = await createClient();
  const { data: variants, error: vErr } = await supabase
    .from("variants").select("id").eq("product_id", productId);
  if (vErr) throw vErr;
  const ids = (variants ?? []).map((v) => (v as { id: string }).id);
  const out: Record<string, Lot[]> = {};
  if (ids.length === 0) return out;
  const { data: lots, error } = await supabase
    .from("inventory_lots").select("variant_id,qty_remaining,unit_cost").in("variant_id", ids);
  if (error) throw error;
  for (const id of ids) out[id] = [];
  for (const l of (lots ?? []) as { variant_id: string; qty_remaining: number; unit_cost: number }[]) {
    (out[l.variant_id] ??= []).push({ qty_remaining: l.qty_remaining, unit_cost: l.unit_cost });
  }
  return out;
}

export async function listMovements(limit = 100): Promise<StockMovementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data as StockMovementRow[];
}
```
(The old `correctStock` + its `computeCorrection` import are removed. If `src/lib/admin/correction.ts` is now unused elsewhere, leave it — it's harmless; do not delete in this task.)

- [ ] **Step 2: correctVariant action → adjustStockToTarget**

In `src/app/admin/products/[id]/actions.ts`: change the import `import { correctStock } from "@/lib/repos/inventory";` to `import { adjustStockToTarget } from "@/lib/repos/inventory";`, and rewrite `correctVariant`:
```ts
export async function correctVariant(productId: string, formData: FormData): Promise<void> {
  const variantId = String(formData.get("variantId") ?? "");
  const target = Number(formData.get("target") ?? NaN);
  if (!variantId || !Number.isInteger(target) || target < 0) return;
  const reason = String(formData.get("reason") ?? "").trim() || "Corrección manual";
  const costRaw = String(formData.get("cost") ?? "").trim();
  const { parsePesosInput } = await import("@/domain/money");
  const unitCost = costRaw === "" ? null : parsePesosInput(costRaw);
  await adjustStockToTarget(variantId, target, reason, unitCost);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/inventory");
}
```

- [ ] **Step 3: Verify & commit**

Run: `npx tsc --noEmit` (exit 0), `npm run build` (compiles).
```bash
git add src/lib/repos/inventory.ts "src/app/admin/products/[id]/actions.ts"
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(admin): adjust_inventory repo wrapper + variant lots read"
```

---

## Task 6: Admin UI — per-variant cost/margin + adjustment cost field

**Files:** Modify `src/app/admin/products/[id]/page.tsx`, `src/app/admin/inventory/page.tsx`. Verified by build + manual.

**Interfaces:**
- Consumes: `listVariantLots` (Task 5), `currentCost` + `inventoryValue` (Task 1), `calcMargin` (`@/domain/margin`), `formatMXN`.

- [ ] **Step 1: Product editor — show per-variant cost/margin + cost input on the correction form**

In `src/app/admin/products/[id]/page.tsx` (read it first):
- import `listVariantLots` from `@/lib/repos/inventory`, `currentCost` from `@/domain/inventory`, `calcMargin` from `@/domain/margin`, `formatMXN` from `@/domain/money`.
- after loading `variants`, fetch lots: `const lots = id === "new" ? {} : await listVariantLots(id);`
- in each variant `<li>` row, after the stock span, show the variant's current cost + margin:
```tsx
{(() => {
  const cc = currentCost(lots[v.id] ?? []);
  if (cc === null) return <span className="text-ink-3">sin costo</span>;
  const m = calcMargin(product.price, cc);
  return <span className="text-ink-3">costo {formatMXN(cc)} · margen {m.pct}%</span>;
})()}
```
(`product.price` is the product's price already loaded on the page; use whatever the page calls it.)
- in the correction `<form action={correctVariant.bind(null, id)}>`, add a cost input (used only when increasing stock) before the submit button:
```tsx
<input name="cost" type="text" inputMode="decimal" placeholder="costo (si sube)" className="w-24 rounded-sm border border-line bg-white p-1 text-sm text-ink" />
```
Keep the existing `variantId`/`target`/`reason` inputs and the submit button.

- [ ] **Step 2: Inventario page — show inventory value**

In `src/app/admin/inventory/page.tsx` (read it first): it already lists variants with stock and recent movements. Add an inventory-value figure. Add a repo read in `src/lib/repos/inventory.ts`:
```ts
export async function totalInventoryValue(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("inventory_lots").select("qty_remaining,unit_cost");
  if (error) throw error;
  return (data ?? []).reduce((s, l) => s + (l as { qty_remaining: number; unit_cost: number }).qty_remaining * (l as { qty_remaining: number; unit_cost: number }).unit_cost, 0);
}
```
Then in `inventory/page.tsx`, call it and render a `Card` with `Eyebrow` "Valor de inventario" + `formatMXN(value)` near the top.

- [ ] **Step 3: Verify & commit**

Run: `npx tsc --noEmit` (exit 0), `npm run build` (compiles).
```bash
git add "src/app/admin/products/[id]/page.tsx" src/app/admin/inventory/page.tsx src/lib/repos/inventory.ts
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(admin): per-variant cost/margin, adjustment cost, inventory value"
```

---

## Task 7: Verification

**Files:** none.

- [ ] **Step 1: Gate**

Run: `npm test` (adds inventory + product-input minus cost; report counts), `npx tsc --noEmit` (exit 0), `npm run build` (compiles). Grep that no product-level cost remains: `rg -n "products.*\\bcost\\b|\\.cost\b" src/lib/repos/products.ts src/lib/admin/product-input.ts` → only unrelated/no matches.

- [ ] **Step 2: Browser E2E** (local stack up; serve via `npm run dev`, or `npm run build && npm start` if dev is unavailable):
  1. **Compras** — receive a PO line → a lot is created, no product cost field anywhere; receive a second batch.
  2. **Producto editor** — each variant shows `costo … · margen …%` from its lots; run a stock correction **up** with a cost → stock + a new lot; correction **down** → consumes lots.
  3. **Ventas** — a paid order's Ganancia reflects FIFO COGS (sell across two cost lots; profit = revenue − weighted COGS).
  4. **Inventario** — shows on-hand and the **Valor de inventario** total.

- [ ] **Step 3: Final commit (if any fixes)**

```bash
git add -A
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "fix: inventory-costing walk-through polish"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** drop `products.cost` (T2 TS, T3 DB) · `stock_movements` FKs + new tables (T3) · `inventory_lots`/`inventory_consumptions` (T3) · FIFO `_consume_fifo` + receive/place/cancel rewrite + `adjust_inventory` (T4) · `variants.stock`/`order_items.cost` caches maintained by RPCs (T4) · per-variant current cost + inventory value helpers (T1) and display (T6) · manual ± adjustments valued, excluded from sales (T4 RPC, T6 UI) · opening-lot data migration at old cost (T3) · `summarizeSales` unchanged (T1/T2 keep `order_items.cost` per-unit) · verification incl. FIFO DB test + browser E2E (T4, T7).
- **Placeholder scan:** SQL + domain + repo code is complete; T2/T6 edits are precise removals/additions over files the implementer reads first. No TBD. (Fix the deliberate committer-email typo flagged in T6 Step 3.)
- **Type consistency:** `Lot {qty_remaining, unit_cost}` defined T1, consumed by `currentCost`/`inventoryValue`/`listVariantLots`/`totalInventoryValue` (T5/T6). `adjustStockToTarget(variantId,target,reason,unitCost?)` (T5) called by `correctVariant` (T5). RPC names (`adjust_inventory`, `receive_purchase_order`, `place_order`, `cancel_order`) match the migration (T4). `order_items.cost` stays per-unit → `summarizeSales` unchanged.

---

## After this feature
Cloud deploy applies migrations `0001`–`0008`. No new env/config.
