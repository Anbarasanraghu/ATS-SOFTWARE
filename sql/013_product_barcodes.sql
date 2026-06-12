-- ============================================================
-- 013_product_barcodes.sql — multiple barcodes per product
--   products.barcode stays the PRIMARY barcode (existing UI/labels).
--   product_barcodes holds additional codes (secondary / supplier /
--   internal / alternate), each with its symbology type. Any of them
--   resolves to the same product on scan.
-- ============================================================

alter table products add column if not exists barcode_type text;   -- type of the primary barcode

create table if not exists product_barcodes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  product_id   uuid not null references products(id) on delete cascade,
  barcode      text not null,
  barcode_type text not null default 'CODE128',   -- EAN13|EAN8|UPCA|UPCE|CODE128|CODE39|QR
  kind         text not null default 'alternate',  -- secondary|supplier|internal|alternate
  created_at   timestamptz not null default now()
);

create unique index if not exists product_barcodes_tenant_barcode_uidx on product_barcodes(tenant_id, barcode);
create index if not exists product_barcodes_product_idx on product_barcodes(product_id);

alter table product_barcodes enable row level security;
alter table product_barcodes force  row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='product_barcodes' and policyname='tenant_isolation') then
    create policy tenant_isolation on product_barcodes using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
  end if;
end $$;
