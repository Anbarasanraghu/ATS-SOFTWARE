-- ============================================================
-- 009_activity_log.sql — audit / activity feed for inventory
-- Records every create/update/delete and stock movement so the
-- Updates page can show a recent-activity feed and per-day counts.
-- ============================================================

create table if not exists activity_log (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  entity      text not null,            -- product | category | supplier | stock
  entity_id   uuid,
  entity_name text,
  action      text not null,            -- create | update | delete | stock_in | stock_out | adjustment | return
  detail      jsonb not null default '{}'::jsonb,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_tenant_id_idx  on activity_log(tenant_id);
create index if not exists activity_log_created_at_idx  on activity_log(tenant_id, created_at desc);

alter table activity_log enable row level security;
alter table activity_log force  row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='activity_log' and policyname='tenant_isolation') then
    create policy tenant_isolation on activity_log
      using  (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id());
  end if;
end $$;
