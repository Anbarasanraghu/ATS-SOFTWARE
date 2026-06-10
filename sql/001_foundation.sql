-- ============================================================
-- 001_foundation.sql — platform tables + products, with RLS
-- ============================================================
create extension if not exists pgcrypto;            -- for gen_random_uuid()

-- Reads the per-request tenant id that RLS policies compare against.
create or replace function current_tenant_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

-- Keeps updated_at honest on every table that has the column.
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- The tenant (one row per customer business).
create table tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  vertical   text not null default 'generic',
  status     text not null default 'active'
               check (status in ('active','suspended','cancelled')),
  settings   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Global catalog of features the platform offers.
create table modules (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  category    text not null default 'core' check (category in ('core','vertical')),
  description text,
  is_active   boolean not null default true
);

-- Which modules each tenant has switched on (the feature toggle).
create table tenant_modules (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  module_id  uuid not null references modules(id) on delete cascade,
  enabled    boolean not null default true,
  settings   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, module_id)
);

-- Users belong to a tenant.
create table users (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  auth_user_id      uuid,
  email             text not null,
  full_name         text,
  password_hash     text,
  is_platform_admin boolean not null default false,
  status            text not null default 'active'
                      check (status in ('active','invited','disabled')),
  custom_fields     jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, email)
);

-- Per-tenant definitions of extra fields (drives dynamic forms later).
create table field_definitions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  entity      text not null,
  field_key   text not null,
  label       text not null,
  data_type   text not null
                check (data_type in ('text','number','boolean','date','select','multiselect')),
  is_required boolean not null default false,
  options     jsonb not null default '[]'::jsonb,
  sort_order  integer not null default 0,
  module_code text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity, field_key)
);

-- First business table — extra fields live in custom_fields (JSONB).
create table products (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  sku           text,
  name          text not null,
  description   text,
  unit          text not null default 'pcs',
  price         numeric(14,2) not null default 0,
  tax_percent   numeric(5,2)  not null default 0,
  stock_qty     numeric(14,3) not null default 0,
  is_active     boolean not null default true,
  custom_fields jsonb not null default '{}'::jsonb,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, sku)
);

-- Indexes
create index on users(tenant_id);
create index on tenant_modules(tenant_id);
create index on field_definitions(tenant_id, entity);
create index on products(tenant_id);
create index on products using gin (custom_fields);

-- Turn on Row-Level Security for every tenant-scoped table.
do $$
declare t text;
begin
  foreach t in array array['users','tenant_modules','field_definitions','products']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
    execute format(
      'create policy tenant_isolation on %I '
      'using (tenant_id = current_tenant_id()) '
      'with check (tenant_id = current_tenant_id());', t);
  end loop;
end $$;

-- Attach the updated_at trigger to every table that has the column.
do $$
declare r record;
begin
  for r in select table_name from information_schema.columns
           where table_schema='public' and column_name='updated_at'
  loop
    execute format(
      'create trigger trg_%1$s_updated before update on %1$I '
      'for each row execute function set_updated_at();', r.table_name);
  end loop;
end $$;

-- Seed the module catalog.
insert into modules (code, name, category, description) values
  ('billing','Billing & Invoicing','core','Invoices, items, taxes'),
  ('inventory','Inventory','core','Products and stock'),
  ('crm','CRM','core','Customers'),
  ('reports','Reports','core','Dashboards'),
  ('medical','Medical / Clinic','vertical','Patients, appointments'),
  ('manufacturing','Manufacturing','vertical','BOM, work orders')
on conflict (code) do nothing;