-- Migration: CRM customer followup tables
-- Run this in Supabase SQL Editor

create table if not exists customer_followups (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  customer_id   uuid not null references customers(id) on delete cascade,
  followup_mode text not null default 'call',
  followup_status text not null,
  notes         text,
  next_followup_date date,
  next_followup_time text,
  reminder_needed boolean not null default false,
  created_by    uuid references users(id),
  created_at    timestamptz not null default now()
);

create table if not exists customer_payment_followups (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references tenants(id) on delete cascade,
  customer_id               uuid not null references customers(id) on delete cascade,
  invoice_number            text,
  invoice_amount            numeric(14,2) not null default 0,
  paid_amount               numeric(14,2) not null default 0,
  balance_amount            numeric(14,2) not null default 0,
  payment_status            text not null default 'payment_pending',
  payment_notes             text,
  next_payment_followup_date date,
  reminder_needed           boolean not null default false,
  created_by                uuid references users(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz
);

-- RLS
alter table customer_followups enable row level security;
alter table customer_payment_followups enable row level security;

create policy "tenant_isolation" on customer_followups
  using (tenant_id = (current_setting('app.tenant_id', true)::uuid));

create policy "tenant_isolation" on customer_payment_followups
  using (tenant_id = (current_setting('app.tenant_id', true)::uuid));

-- Indexes
create index if not exists idx_cf_customer  on customer_followups(customer_id);
create index if not exists idx_cf_tenant    on customer_followups(tenant_id);
create index if not exists idx_cpf_customer on customer_payment_followups(customer_id);
create index if not exists idx_cpf_tenant   on customer_payment_followups(tenant_id);
