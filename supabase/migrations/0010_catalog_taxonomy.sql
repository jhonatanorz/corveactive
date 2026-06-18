-- supabase/migrations/0010_catalog_taxonomy.sql
-- Catalog taxonomy: lines + categories become admin-managed tables; products
-- reference them by FK. order_items.line becomes a text slug snapshot.

-- 1. New tables ------------------------------------------------------------
create table product_lines (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  hero_title   text not null default '',
  hero_message text not null default '',
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table product_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  parent_id  uuid references product_categories(id) on delete set null, -- reserved (hierarchy), unused
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. RLS + grants (mirror 0002/0003: anon reads, admin writes) -------------
alter table product_lines      enable row level security;
alter table product_categories enable row level security;

grant select, insert, update, delete on product_lines, product_categories to authenticated;
grant select on product_lines, product_categories to anon;

create policy admin_all   on product_lines      for all    to authenticated using (true) with check (true);
create policy admin_all   on product_categories for all    to authenticated using (true) with check (true);
create policy public_read on product_lines      for select to anon using (true);
create policy public_read on product_categories for select to anon using (true);

-- 3. Seed lines from the previously hardcoded copy --------------------------
insert into product_lines (slug, name, hero_title, hero_message, sort_order, active) values
  ('MOVE', 'CORVE MOVE', 'Muévete desde el amor',            'Confianza en cada movimiento', 0, true),
  ('HIM',  'CORVE HIM',  'Una rutina que respeta tu ritmo',  'Confianza en cada movimiento', 1, true);

-- 4. Seed categories from existing distinct product types -------------------
--    Same slug expression is used for backfill below, so accented names map
--    consistently on both sides even without the unaccent extension.
insert into product_categories (slug, name, sort_order)
select slug, min(name), 0
from (
  select btrim(regexp_replace(lower(type), '[^a-z0-9]+', '-', 'g'), '-') as slug, type as name
  from products
  where coalesce(btrim(type), '') <> ''
) s
group by slug
on conflict (slug) do nothing;

-- 5. Add FK columns (nullable for backfill) --------------------------------
alter table products add column line_id     uuid references product_lines(id);
alter table products add column category_id uuid references product_categories(id);

-- 6. Backfill --------------------------------------------------------------
update products p set line_id = l.id
  from product_lines l where l.slug = p.line::text;

update products p set category_id = c.id
  from product_categories c
  where c.slug = btrim(regexp_replace(lower(p.type), '[^a-z0-9]+', '-', 'g'), '-');

-- 7. Enforce + index -------------------------------------------------------
alter table products alter column line_id     set not null;
alter table products alter column category_id set not null;
create index on products (line_id);
create index on products (category_id);

-- 8. order_items.line: enum -> text snapshot (keeps historical reporting) ---
alter table order_items alter column line type text using line::text;

-- 9. place_order RPC: snapshot the line slug via line_id -------------------
create or replace function place_order(
  p_customer_name text,
  p_customer_whatsapp text,
  p_delivery_note text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_qty int;
  v_variant variants%rowtype;
  v_product products%rowtype;
  v_total int := 0;
begin
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'name_required';
  end if;
  if p_customer_whatsapp is null or btrim(p_customer_whatsapp) = '' then
    raise exception 'whatsapp_required';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;

  insert into orders (customer_name, customer_whatsapp, delivery_note, status, total)
  values (btrim(p_customer_name), btrim(p_customer_whatsapp), nullif(btrim(coalesce(p_delivery_note,'')), ''), 'nuevo', 0)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'invalid_qty'; end if;

    select * into v_variant from variants where id = (v_item->>'variant_id')::uuid for update;
    if not found then raise exception 'variant_not_found'; end if;
    if v_variant.stock < v_qty then
      raise exception 'insufficient_stock:%', v_variant.id;
    end if;

    select * into v_product from products where id = v_variant.product_id;
    if v_product.status <> 'active' then raise exception 'product_unavailable'; end if;

    update variants set stock = stock - v_qty where id = v_variant.id;

    insert into order_items (order_id, variant_id, product_name, line, color, size, unit_price, cost, qty)
    values (v_order_id, v_variant.id, v_product.name,
            (select slug from product_lines where id = v_product.line_id),
            v_variant.color, v_variant.size, v_product.price, v_product.cost, v_qty);

    insert into stock_movements (variant_id, delta, type, reference)
    values (v_variant.id, -v_qty, 'pedido', '#' || left(v_order_id::text, 8));

    v_total := v_total + v_product.price * v_qty;
  end loop;

  update orders set total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

grant execute on function place_order(text, text, text, jsonb) to anon, authenticated;

-- 10. Drop the old columns + enum (now unreferenced) -----------------------
alter table products drop column line;
alter table products drop column type;
drop type product_line;
