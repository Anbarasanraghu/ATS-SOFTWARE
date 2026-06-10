-- ============================================================
-- 006_billing_payments.sql — payments + customer link on invoices
-- ============================================================

alter table invoices add column if not exists customer_id uuid references customers(id) on delete set null;

create table payments (
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

create index on payments(tenant_id);
create index on payments(invoice_id);

alter table payments enable row level security;
alter table payments force  row level security;

create policy tenant_isolation on payments
  using  (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
