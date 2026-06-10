-- ============================================================
-- 004_hr.sql — employees table with RLS
-- ============================================================

create table employees (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  employee_no    text,
  full_name      text not null,
  email          text,
  phone          text,
  department     text,
  job_title      text,
  hire_date      date,
  status         text not null default 'active'
                   check (status in ('active','on_leave','terminated')),
  salary         numeric(14,2),
  notes          text,
  custom_fields  jsonb not null default '{}'::jsonb,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index on employees(tenant_id);
create index on employees(tenant_id, status);
create index on employees using gin (custom_fields);

alter table employees enable row level security;
alter table employees force  row level security;

create policy tenant_isolation on employees
  using  (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());

create trigger trg_employees_updated
  before update on employees
  for each row execute function set_updated_at();

-- seed the hr module in the modules catalog
insert into modules (code, name, category, description)
values ('hr', 'HR & Employees', 'core', 'Employee records, departments, payroll')
on conflict (code) do nothing;
