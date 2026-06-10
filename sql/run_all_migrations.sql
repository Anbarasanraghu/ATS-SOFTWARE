-- ============================================================
-- run_all_migrations.sql
-- Paste this entire file into Supabase SQL Editor and click Run.
-- Safe to re-run — uses IF NOT EXISTS on every statement.
-- ============================================================

-- ── 002: invoices ────────────────────────────────────────────
create table if not exists invoices (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  customer_id    uuid,
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
  amount_paid    numeric(14,2) not null default 0,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  product_id  uuid,
  description text not null,
  quantity    numeric(14,3) not null default 1,
  unit_price  numeric(14,2) not null default 0,
  tax_percent numeric(5,2)  not null default 0,
  line_total  numeric(14,2) not null default 0
);

create index if not exists invoices_tenant_id_idx        on invoices(tenant_id);
create index if not exists invoices_tenant_status_idx    on invoices(tenant_id, status);
create index if not exists invoice_items_invoice_id_idx  on invoice_items(invoice_id);
create index if not exists invoice_items_tenant_id_idx   on invoice_items(tenant_id);

alter table invoices      enable row level security;
alter table invoices      force  row level security;
alter table invoice_items enable row level security;
alter table invoice_items force  row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='invoices' and policyname='tenant_isolation') then
    create policy tenant_isolation on invoices
      using  (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='invoice_items' and policyname='tenant_isolation') then
    create policy tenant_isolation on invoice_items
      using  (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='trg_invoices_updated') then
    create trigger trg_invoices_updated
      before update on invoices
      for each row execute function set_updated_at();
  end if;
end $$;

-- ── 003: customers ───────────────────────────────────────────
create table if not exists customers (
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

create index if not exists customers_tenant_id_idx on customers(tenant_id);

alter table customers enable row level security;
alter table customers force  row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='customers' and policyname='tenant_isolation') then
    create policy tenant_isolation on customers
      using  (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='trg_customers_updated') then
    create trigger trg_customers_updated
      before update on customers
      for each row execute function set_updated_at();
  end if;
end $$;

-- ── 004: hr (employees) ──────────────────────────────────────
create table if not exists employees (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  department_id        uuid,
  employee_no          text,
  full_name            text not null,
  email                text,
  phone                text,
  department           text,
  job_title            text,
  hire_date            date,
  status               text not null default 'active'
                         check (status in ('active','on_leave','terminated')),
  salary               numeric(14,2),
  annual_leave_balance numeric(5,1) not null default 0,
  notes                text,
  custom_fields        jsonb not null default '{}'::jsonb,
  created_by           uuid references users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists employees_tenant_id_idx on employees(tenant_id);

alter table employees enable row level security;
alter table employees force  row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='employees' and policyname='tenant_isolation') then
    create policy tenant_isolation on employees
      using  (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='trg_employees_updated') then
    create trigger trg_employees_updated
      before update on employees
      for each row execute function set_updated_at();
  end if;
end $$;

insert into modules (code, name, category, description)
values ('hr', 'HR & Employees', 'core', 'Employee records, departments, payroll')
on conflict (code) do nothing;

-- ── 005: inventory (categories, suppliers, stock movements) ──
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists suppliers (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  name           text not null,
  email          text,
  phone          text,
  address        text,
  contact_person text,
  notes          text,
  status         text not null default 'active' check (status in ('active','inactive')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists stock_movements (
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

alter table products add column if not exists category_id    uuid references categories(id) on delete set null;
alter table products add column if not exists supplier_id    uuid references suppliers(id)  on delete set null;
alter table products add column if not exists cost_price     numeric(14,2) not null default 0;
alter table products add column if not exists reorder_level  numeric(14,3) not null default 0;

create index if not exists categories_tenant_id_idx      on categories(tenant_id);
create index if not exists suppliers_tenant_id_idx       on suppliers(tenant_id);
create index if not exists stock_movements_tenant_id_idx on stock_movements(tenant_id);
create index if not exists stock_movements_product_id_idx on stock_movements(product_id);

alter table categories      enable row level security;
alter table categories      force  row level security;
alter table suppliers       enable row level security;
alter table suppliers       force  row level security;
alter table stock_movements enable row level security;
alter table stock_movements force  row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='categories' and policyname='tenant_isolation') then
    create policy tenant_isolation on categories using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='suppliers' and policyname='tenant_isolation') then
    create policy tenant_isolation on suppliers using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='stock_movements' and policyname='tenant_isolation') then
    create policy tenant_isolation on stock_movements using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='trg_suppliers_updated') then
    create trigger trg_suppliers_updated before update on suppliers for each row execute function set_updated_at();
  end if;
end $$;

-- ── 006: payments + customer FK on invoices ──────────────────
alter table invoices add column if not exists customer_id uuid references customers(id) on delete set null;
alter table invoices add column if not exists amount_paid numeric(14,2) not null default 0;

create table if not exists payments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  invoice_id   uuid not null references invoices(id) on delete cascade,
  amount       numeric(14,2) not null,
  payment_date date not null default current_date,
  method       text not null default 'cash'
                 check (method in ('cash','bank_transfer','card','cheque','other')),
  reference    text,
  notes        text,
  created_by   uuid references users(id),
  created_at   timestamptz not null default now()
);

create index if not exists payments_tenant_id_idx  on payments(tenant_id);
create index if not exists payments_invoice_id_idx on payments(invoice_id);

alter table payments enable row level security;
alter table payments force  row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='payments' and policyname='tenant_isolation') then
    create policy tenant_isolation on payments using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
  end if;
end $$;

-- ── 007: departments, leave requests, payroll, interactions ──
create table if not exists departments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  description text,
  manager_id  uuid references employees(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (tenant_id, name)
);

alter table employees add column if not exists department_id uuid references departments(id) on delete set null;

create table if not exists leave_requests (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type  text not null check (leave_type in ('annual','sick','unpaid','maternity','paternity','other')),
  start_date  date not null,
  end_date    date not null,
  days        numeric(5,1) not null default 1,
  reason      text,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references users(id),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists payroll_records (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  employee_id   uuid not null references employees(id) on delete cascade,
  period_month  int not null check (period_month between 1 and 12),
  period_year   int not null,
  basic_salary  numeric(14,2) not null default 0,
  allowances    numeric(14,2) not null default 0,
  deductions    numeric(14,2) not null default 0,
  net_salary    numeric(14,2) not null default 0,
  status        text not null default 'draft' check (status in ('draft','approved','paid')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, employee_id, period_month, period_year)
);

create table if not exists interactions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  type        text not null check (type in ('note','call','email','meeting','other')),
  subject     text,
  body        text not null,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

create index if not exists departments_tenant_id_idx    on departments(tenant_id);
create index if not exists leave_requests_tenant_id_idx on leave_requests(tenant_id);
create index if not exists leave_requests_emp_id_idx    on leave_requests(employee_id);
create index if not exists payroll_tenant_id_idx        on payroll_records(tenant_id);
create index if not exists payroll_emp_id_idx           on payroll_records(employee_id);
create index if not exists interactions_tenant_id_idx   on interactions(tenant_id);
create index if not exists interactions_customer_id_idx on interactions(customer_id);

do $$ declare t text;
begin
  foreach t in array array['departments','leave_requests','payroll_records','interactions'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force  row level security;', t);
    if not exists (select 1 from pg_policies where tablename=t and policyname='tenant_isolation') then
      execute format('create policy tenant_isolation on %I using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());', t);
    end if;
  end loop;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='trg_leave_requests_updated') then
    create trigger trg_leave_requests_updated before update on leave_requests for each row execute function set_updated_at();
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='trg_payroll_records_updated') then
    create trigger trg_payroll_records_updated before update on payroll_records for each row execute function set_updated_at();
  end if;
end $$;

-- ── 008: user roles + invitations ────────────────────────────
alter table users add column if not exists role text not null default 'member'
  check (role in ('owner','admin','manager','member'));

create table if not exists invitations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  email       text not null,
  role        text not null default 'member',
  token       text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by  uuid references users(id),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (tenant_id, email)
);

create index if not exists invitations_tenant_id_idx on invitations(tenant_id);

alter table invitations enable row level security;
alter table invitations force  row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='invitations' and policyname='tenant_isolation') then
    create policy tenant_isolation on invitations using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
  end if;
end $$;

-- ── 009: activity log (inventory audit / Updates feed) ───────
create table if not exists activity_log (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  entity      text not null,
  entity_id   uuid,
  entity_name text,
  action      text not null,
  detail      jsonb not null default '{}'::jsonb,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_tenant_id_idx on activity_log(tenant_id);
create index if not exists activity_log_created_at_idx on activity_log(tenant_id, created_at desc);

alter table activity_log enable row level security;
alter table activity_log force  row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='activity_log' and policyname='tenant_isolation') then
    create policy tenant_isolation on activity_log using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
  end if;
end $$;

-- ── 010: purchase & sales entry documents ───────────────────
create table if not exists inventory_docs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  doc_type    text not null check (doc_type in ('purchase','sale')),
  doc_number  text,
  party_id    uuid,
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

alter table stock_movements add column if not exists doc_id uuid references inventory_docs(id) on delete cascade;

create index if not exists inventory_docs_tenant_idx     on inventory_docs(tenant_id, doc_type, doc_date desc);
create index if not exists inventory_doc_items_doc_idx    on inventory_doc_items(doc_id);
create index if not exists inventory_doc_items_tenant_idx on inventory_doc_items(tenant_id);

alter table inventory_docs      enable row level security;
alter table inventory_docs      force  row level security;
alter table inventory_doc_items enable row level security;
alter table inventory_doc_items force  row level security;

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

-- Enable all core modules for any existing tenants that don't have them yet
insert into tenant_modules (tenant_id, module_id, enabled)
select t.id, m.id, true
from tenants t
cross join modules m
where m.category = 'core'
  and not exists (
    select 1 from tenant_modules tm
    where tm.tenant_id = t.id and tm.module_id = m.id
  );
