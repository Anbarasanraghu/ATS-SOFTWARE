-- ============================================================
-- 005_inventory_extended.sql — categories, suppliers, stock movements
-- ============================================================

create table categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  unique (tenant_id, name)
);

create table suppliers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  address     text,
  contact_person text,
  notes       text,
  status      text not null default 'active' check (status in ('active','inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table stock_movements (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  product_id    uuid not null references products(id) on delete cascade,
  movement_type text not null check (movement_type in ('in','out','adjustment','return')),
  quantity      numeric(14,3) not null,
  unit_cost     numeric(14,2),
  reference     text,
  notes         text,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now()
);

alter table products add column if not exists category_id uuid references categories(id) on delete set null;
alter table products add column if not exists supplier_id  uuid references suppliers(id)  on delete set null;

create index on categories(tenant_id);
create index on suppliers(tenant_id);
create index on stock_movements(tenant_id);
create index on stock_movements(product_id);

alter table categories      enable row level security;
alter table categories      force  row level security;
alter table suppliers       enable row level security;
alter table suppliers       force  row level security;
alter table stock_movements enable row level security;
alter table stock_movements force  row level security;

create policy tenant_isolation on categories
  using  (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy tenant_isolation on suppliers
  using  (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create policy tenant_isolation on stock_movements
  using  (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create trigger trg_suppliers_updated
  before update on suppliers
  for each row execute function set_updated_at();
