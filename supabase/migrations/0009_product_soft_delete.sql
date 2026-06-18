-- Soft delete for products: a deleted product keeps its row (so existing orders,
-- movements and lots stay intact) but is filtered out of the catalog and admin lists.
alter table products add column deleted_at timestamptz;
create index on products (deleted_at);
