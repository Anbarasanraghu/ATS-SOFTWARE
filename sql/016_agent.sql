-- ============================================================
-- 016_agent.sql — AI Agent: conversations, messages, tool-call audit
-- The agent never touches the DB directly; it calls backend tools.
-- These tables store chat memory and a complete audit trail of every
-- tool the LLM invoked (per the architecture guide's security model).
-- All three are tenant-isolated via RLS, like every other table.
-- ============================================================

-- ── Conversations ───────────────────────────────────────────
create table if not exists agent_conversations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid references users(id) on delete set null,
  title       text not null default 'New conversation',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists agent_conv_tenant_idx on agent_conversations(tenant_id, updated_at desc);

-- ── Messages (conversation memory) ──────────────────────────
create table if not exists agent_messages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references agent_conversations(id) on delete cascade,
  role            text not null,             -- user | assistant
  content         text not null default '',
  tool_calls      jsonb not null default '[]'::jsonb,  -- [{name, args, result_summary}]
  created_at      timestamptz not null default now()
);
create index if not exists agent_msg_conv_idx on agent_messages(conversation_id, created_at);

-- ── Tool-call audit log (one row per executed tool) ─────────
create table if not exists agent_tool_calls (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid references agent_conversations(id) on delete cascade,
  user_id         uuid references users(id) on delete set null,
  tool_name       text not null,
  arguments       jsonb not null default '{}'::jsonb,
  status          text not null,             -- ok | error | denied
  error           text,
  duration_ms     integer,
  created_at      timestamptz not null default now()
);
create index if not exists agent_tool_tenant_idx on agent_tool_calls(tenant_id, created_at desc);

-- ── Row-Level Security (tenant isolation) ───────────────────
do $$
declare t text;
begin
  foreach t in array array['agent_conversations','agent_messages','agent_tool_calls'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    if not exists (select 1 from pg_policies where tablename=t and policyname='tenant_isolation') then
      execute format(
        'create policy tenant_isolation on %I using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id())', t);
    end if;
  end loop;
end $$;
