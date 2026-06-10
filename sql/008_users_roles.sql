-- ============================================================
-- 008_users_roles.sql — role column + user invitations
-- ============================================================

alter table users add column if not exists role text not null default 'member'
  check (role in ('owner','admin','manager','member'));

create table invitations (
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

create index on invitations(tenant_id);
create index on invitations(token);

alter table invitations enable row level security;
alter table invitations force  row level security;

create policy tenant_isolation on invitations
  using  (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
