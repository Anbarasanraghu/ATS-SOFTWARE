-- ============================================================
-- 003_crm.sql — customers table with RLS
-- ============================================================

create table customers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  email         text,
  phone         text,
  company       text,
  address       text,
  notes         text,
  status        text not null default 'active'
                  check (status in ('active','inactive')),
  custom_fields jsonb not null default '{}'::jsonb,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on customers(tenant_id);
create index on customers(tenant_id, status);
create index on customers using gin (custom_fields);

alter table customers enable row level security;
alter table customers force  row level security;

create policy tenant_isolation on customers
  using  (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create trigger trg_customers_updated
  before update on customers
  for each row execute function set_updated_at();
