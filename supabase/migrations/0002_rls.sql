-- Row Level Security for CORVE.
--
-- Plan 2 scope: the admin is the only authenticated user, so authenticated gets
-- full access to every app table. Public (anon) catalog-read and order-insert
-- policies are intentionally deferred to Plan 3 (when the public catalog/checkout
-- are built), so until then the data is reachable only by a logged-in admin.

-- Table-level privileges. RLS decides which rows; GRANT decides table access.
-- Both are required. anon grants are deferred to Plan 3 (catalog read).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter table products             enable row level security;
alter table product_images       enable row level security;
alter table variants             enable row level security;
alter table suppliers            enable row level security;
alter table purchase_orders      enable row level security;
alter table purchase_order_items enable row level security;
alter table orders               enable row level security;
alter table order_items          enable row level security;
alter table stock_movements      enable row level security;

create policy admin_all on products             for all to authenticated using (true) with check (true);
create policy admin_all on product_images       for all to authenticated using (true) with check (true);
create policy admin_all on variants             for all to authenticated using (true) with check (true);
create policy admin_all on suppliers            for all to authenticated using (true) with check (true);
create policy admin_all on purchase_orders      for all to authenticated using (true) with check (true);
create policy admin_all on purchase_order_items for all to authenticated using (true) with check (true);
create policy admin_all on orders               for all to authenticated using (true) with check (true);
create policy admin_all on order_items          for all to authenticated using (true) with check (true);
create policy admin_all on stock_movements      for all to authenticated using (true) with check (true);

-- Storage: authenticated admin manages product-images; public reads them.
create policy "admin write product-images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');
create policy "admin update product-images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');
create policy "admin delete product-images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');
create policy "public read product-images" on storage.objects
  for select to public using (bucket_id = 'product-images');
