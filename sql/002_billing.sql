-- ============================================================
-- 002_billing.sql — invoices + invoice_items with RLS
-- ============================================================

create table invoices (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  invoice_number text not null,
  customer_name  text not null,
  customer_email text,
  issue_date     date not null,
  due_date       date,
  status         text not null default 'draft'
                   check (status in ('draft','sent','paid','void')),
  notes          text,
  subtotal       numeric(14,2) not null default 0,
  tax_total      numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  description text not null,
  quantity    numeric(14,3) not null default 1,
  unit_price  numeric(14,2) not null default 0,
  tax_percent numeric(5,2)  not null default 0,
  line_total  numeric(14,2) not null default 0
);

-- Indexes
create index on invoices(tenant_id);
create index on invoices(tenant_id, status);
create index on invoice_items(invoice_id);
create index on invoice_items(tenant_id);

-- Row-Level Security
alter table invoices      enable row level security;
alter table invoices      force  row level security;
alter table invoice_items enable row level security;
alter table invoice_items force  row level security;

create policy tenant_isolation on invoices
  using  (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy tenant_isolation on invoice_items
  using  (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

-- updated_at trigger on invoices (invoice_items has no updated_at column)
create trigger trg_invoices_updated
  before update on invoices
  for each row execute function set_updated_at();
