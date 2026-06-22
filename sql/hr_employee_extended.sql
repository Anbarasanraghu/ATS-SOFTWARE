-- HR Module Extended Migration
-- Run this in your Supabase SQL Editor (or psql) once

-- ── Extend employees table ─────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS designation        VARCHAR,
  ADD COLUMN IF NOT EXISTS work_location      VARCHAR,
  ADD COLUMN IF NOT EXISTS employee_type      VARCHAR DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS work_shift         VARCHAR,
  ADD COLUMN IF NOT EXISTS date_of_birth      DATE,
  ADD COLUMN IF NOT EXISTS gender             VARCHAR,
  ADD COLUMN IF NOT EXISTS address            TEXT,
  ADD COLUMN IF NOT EXISTS reporting_manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS family_details     JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS insurance_details  JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS system_details     JSONB DEFAULT '{}';

-- ── Designations table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS designations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Employee tasks ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title          VARCHAR NOT NULL,
  project_client VARCHAR,
  priority       VARCHAR DEFAULT 'medium',
  status         VARCHAR DEFAULT 'pending',
  due_date       DATE,
  assigned_by    VARCHAR,
  notes          TEXT,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Employee work reports ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_work_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  report_date      DATE NOT NULL,
  work_type        VARCHAR,
  project_client   VARCHAR,
  work_summary     TEXT,
  hours_worked     NUMERIC(4,1),
  status           VARCHAR DEFAULT 'submitted',
  manager_remarks  TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Employee call logs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_call_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id          UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  call_date            DATE NOT NULL,
  customer_client_name VARCHAR,
  phone_number         VARCHAR,
  call_type            VARCHAR,
  call_status          VARCHAR,
  notes                TEXT,
  followup_required    BOOLEAN DEFAULT false,
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Employee projects ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_name   VARCHAR NOT NULL,
  client_name    VARCHAR,
  employee_role  VARCHAR,
  start_date     DATE,
  end_date       DATE,
  status         VARCHAR DEFAULT 'active',
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Employee logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  action       VARCHAR NOT NULL,
  details      TEXT,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Employee notes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  note         TEXT NOT NULL,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
