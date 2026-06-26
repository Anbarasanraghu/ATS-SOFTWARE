-- ============================================================
-- 017_tenant_seats_user_modules.sql
-- Multi-user tenants with per-seat licensing and per-user module access.
--   • tenants.max_users — the paid seat limit the PLATFORM ADMIN grants.
--     Each active user = 1 seat = a fixed monthly price (see config).
--   • user_modules — which modules a given user may access. The tenant
--     owner/admin decides this per user. Owners/admins implicitly get all
--     of the tenant's enabled modules; regular members only get what's
--     assigned here.
-- ============================================================

-- Seat limit per tenant (default 1 = just the owner until you grant more).
alter table tenants add column if not exists max_users integer not null default 1;

-- Per-user module grants.
create table if not exists user_modules (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  user_id    uuid not null references users(id)   on delete cascade,
  module_id  uuid not null references modules(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, module_id)
);
create index if not exists user_modules_user_idx   on user_modules(user_id);
create index if not exists user_modules_tenant_idx on user_modules(tenant_id);

alter table user_modules enable row level security;
alter table user_modules force  row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_modules' and policyname='tenant_isolation') then
    create policy tenant_isolation on user_modules
      using  (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id());
  end if;
end $$;
