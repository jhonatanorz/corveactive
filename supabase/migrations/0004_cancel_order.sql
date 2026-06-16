-- Atomic order cancellation (mirrors place_order's atomicity).
-- Restores each item's stock exactly once, logs 'cancelacion' movements, and
-- sets status + stock_restored — all in one transaction. The row lock + the
-- stock_restored guard make it idempotent (a retry/double-cancel is a no-op for stock).
create or replace function cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restored boolean;
  v_item record;
begin
  select stock_restored into v_restored from orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;

  if not v_restored then
    for v_item in
      select variant_id, qty from order_items
      where order_id = p_order_id and variant_id is not null
    loop
      update variants set stock = stock + v_item.qty where id = v_item.variant_id;
      insert into stock_movements (variant_id, delta, type, reference)
      values (v_item.variant_id, v_item.qty, 'cancelacion', '#' || left(p_order_id::text, 8));
    end loop;
  end if;

  update orders set status = 'cancelado', stock_restored = true where id = p_order_id;
end;
$$;

grant execute on function cancel_order(uuid) to authenticated;
