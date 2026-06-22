-- Migration: Add CRM fields to customers table
-- Run this in Supabase SQL Editor BEFORE the app starts

alter table customers
  add column if not exists whatsapp           text,
  add column if not exists crm_status         text not null default 'new_lead',
  add column if not exists priority           text not null default 'medium',
  add column if not exists source             text,
  add column if not exists interested_service text,
  add column if not exists requirement_details text,
  add column if not exists assigned_staff     text,
  add column if not exists first_followup_date date,
  add column if not exists first_followup_time text,
  add column if not exists last_followup_date  date,
  add column if not exists next_followup_date  date,
  add column if not exists tags               jsonb not null default '[]'::jsonb,
  add column if not exists payment_status     text;

-- Indexes for common filter/sort columns
create index if not exists idx_customers_crm_status      on customers(tenant_id, crm_status);
create index if not exists idx_customers_next_followup   on customers(tenant_id, next_followup_date);
create index if not exists idx_customers_assigned_staff  on customers(tenant_id, assigned_staff);
create index if not exists idx_customers_tags            on customers using gin(tags);
