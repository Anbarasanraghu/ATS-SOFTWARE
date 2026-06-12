-- ============================================================
-- 014_product_batches.sql — pharmacy batch & expiry tracking
-- A product can have many batches, each with its own expiry. The POS blocks
-- selling when all batch stock is expired and warns when near expiry.
-- ============================================================

create table if not exists product_batches (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  batch_no    text,
  mfg_date    date,
  expiry_date date,
  quantity    numeric(14,3) not null default 0,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

create index if not exists product_batches_tenant_idx  on product_batches(tenant_id);
create index if not exists product_batches_product_idx on product_batches(product_id);
create index if not exists product_batches_expiry_idx  on product_batches(tenant_id, expiry_date);

alter table product_batches enable row level security;
alter table product_batches force  row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='product_batches' and policyname='tenant_isolation') then
    create policy tenant_isolation on product_batches using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
  end if;
end $$;
