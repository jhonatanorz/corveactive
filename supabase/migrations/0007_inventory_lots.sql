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
