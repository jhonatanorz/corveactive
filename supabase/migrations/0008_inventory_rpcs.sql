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
