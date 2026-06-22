-- ============================================================
-- 010_purchase_sales.sql — Purchase & Sales entry documents
-- A document groups line items and, when posted, adjusts product
-- stock and writes a stock_movement per line (linked via doc_id).
-- ============================================================

create table if not exists inventory_docs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  doc_type    text not null check (doc_type in ('purchase','sale')),
  doc_number  text,
  party_id    uuid,                 -- supplier (purchase) or customer (sale); no FK so either works
  party_name  text,
  doc_date    date not null default current_date,
  status      text not null default 'posted' check (status in ('draft','posted','void')),
  subtotal    numeric(14,2) not null default 0,
  tax_total   numeric(14,2) not null default 0,
  total       numeric(14,2) not null default 0,
  notes       text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists inventory_doc_items (
  id          uuid primary key default gen_random_uuid(),
  doc_id      uuid not null references inventory_docs(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  product_id  uuid references products(id) on delete set null,
  description text not null,
  quantity    numeric(14,3) not null default 1,
  unit_price  numeric(14,2) not null default 0,
  tax_percent numeric(5,2)  not null default 0,
  line_total  numeric(14,2) not null default 0
);

-- link stock movements back to the document that created them
alter table stock_movements add column if not exists doc_id uuid references inventory_docs(id) on delete cascade;

create index if not exists inventory_docs_tenant_idx   on inventory_docs(tenant_id, doc_type, doc_date desc);
create index if not exists inventory_doc_items_doc_idx  on inventory_doc_items(doc_id);
create index if not exists inventory_doc_items_tenant_idx on inventory_doc_items(tenant_id);

alter table inventory_docs       enable row level security;
alter table inventory_docs       force  row level security;
alter table inventory_doc_items  enable row level security;
alter table inventory_doc_items  force  row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='inventory_docs' and policyname='tenant_isolation') then
    create policy tenant_isolation on inventory_docs using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='inventory_doc_items' and policyname='tenant_isolation') then
    create policy tenant_isolation on inventory_doc_items using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='trg_inventory_docs_updated') then
    create trigger trg_inventory_docs_updated before update on inventory_docs for each row execute function set_updated_at();
  end if;
end $$;
