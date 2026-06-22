-- ============================================================
-- seed_login.sql — guarantee a working admin login.
-- Paste into the Supabase SQL Editor and Run. Safe to re-run.
--
-- The SQL Editor runs as the `postgres` superuser, which bypasses
-- Row-Level Security, so these writes work without tenant context.
--
-- Password is hashed with pgcrypto's bcrypt (gen_salt('bf')), which
-- the FastAPI backend (bcrypt.checkpw) verifies. To use a different
-- password, change the two 'admin123' literals below.
-- ============================================================

create extension if not exists pgcrypto;

-- 1) Make sure the workspace (tenant) exists.
insert into tenants (name, slug, vertical, status)
values ('Demo Co', 'demo', 'generic', 'active')
on conflict (slug) do nothing;

-- 2) Create or reset the admin user with a known password.
insert into users (tenant_id, email, full_name, password_hash, is_platform_admin, role, status)
select t.id,
       'admin@demo.com',
       'Demo Admin',
       crypt('admin123', gen_salt('bf', 12)),
       true,
       'owner',
       'active'
from tenants t
where t.slug = 'demo'
on conflict (tenant_id, email) do update
   set password_hash     = excluded.password_hash,
       is_platform_admin = true,
       role              = 'owner',
       status            = 'active';

-- 3) Enable all core modules for the workspace.
insert into tenant_modules (tenant_id, module_id, enabled)
select t.id, m.id, true
from tenants t
cross join modules m
where t.slug = 'demo'
  and m.category = 'core'
on conflict (tenant_id, module_id) do update set enabled = true;

-- Verify (optional): should return one row, ok = true
select t.slug, u.email, u.is_platform_admin,
       (u.password_hash = crypt('admin123', u.password_hash)) as password_ok
from users u
join tenants t on t.id = u.tenant_id
where t.slug = 'demo' and u.email = 'admin@demo.com';
