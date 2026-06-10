-- ============================================================
-- 007_hr_extended.sql — departments, leave requests, payroll
-- ============================================================

create table departments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  description text,
  manager_id  uuid references employees(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (tenant_id, name)
);

alter table employees add column if not exists department_id uuid references departments(id) on delete set null;

create table leave_requests (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type  text not null
                check (leave_type in ('annual','sick','unpaid','maternity','paternity','other')),
  start_date  date not null,
  end_date    date not null,
  days        numeric(5,1) not null default 1,
  reason      text,
  status      text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  approved_by uuid references users(id),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table payroll_records (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  employee_id   uuid not null references employees(id) on delete cascade,
  period_month  int not null check (period_month between 1 and 12),
  period_year   int not null,
  basic_salary  numeric(14,2) not null default 0,
  allowances    numeric(14,2) not null default 0,
  deductions    numeric(14,2) not null default 0,
  net_salary    numeric(14,2) not null default 0,
  status        text not null default 'draft'
                  check (status in ('draft','approved','paid')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, employee_id, period_month, period_year)
);

create table interactions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  customer_id  uuid not null references customers(id) on delete cascade,
  type         text not null check (type in ('note','call','email','meeting','other')),
  subject      text,
  body         text not null,
  created_by   uuid references users(id),
  created_at   timestamptz not null default now()
);

create index on departments(tenant_id);
create index on leave_requests(tenant_id);
create index on leave_requests(employee_id);
create index on payroll_records(tenant_id);
create index on payroll_records(employee_id);
create index on interactions(tenant_id);
create index on interactions(customer_id);

do $$
declare t text;
begin
  foreach t in array array['departments','leave_requests','payroll_records','interactions']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force  row level security;', t);
    execute format(
      'create policy tenant_isolation on %I '
      'using (tenant_id = current_tenant_id()) '
      'with check (tenant_id = current_tenant_id());', t);
  end loop;
end $$;

create trigger trg_leave_requests_updated
  before update on leave_requests
  for each row execute function set_updated_at();

create trigger trg_payroll_records_updated
  before update on payroll_records
  for each row execute function set_updated_at();
