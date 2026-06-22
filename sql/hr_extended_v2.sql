-- HR Extended v2 Migration
-- Run once in Supabase SQL Editor

-- ── Extend employee_tasks ─────────────────────────────────────
ALTER TABLE employee_tasks
  ADD COLUMN IF NOT EXISTS description       TEXT,
  ADD COLUMN IF NOT EXISTS notify_employee   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS employee_remarks  TEXT;

-- ── Extend employee_work_reports ──────────────────────────────
ALTER TABLE employee_work_reports
  ADD COLUMN IF NOT EXISTS report_type VARCHAR DEFAULT 'daily';

-- ── Extend employee_call_logs ─────────────────────────────────
ALTER TABLE employee_call_logs
  ADD COLUMN IF NOT EXISTS duration            VARCHAR,
  ADD COLUMN IF NOT EXISTS next_followup_date  DATE;

-- ── Extend employee_projects ──────────────────────────────────
ALTER TABLE employee_projects
  ADD COLUMN IF NOT EXISTS project_notes TEXT;

-- ── Employee permissions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_permissions (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  employee_id  UUID         NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  module       VARCHAR      NOT NULL,
  has_access   BOOLEAN      NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (employee_id, module)
);

-- ── Employee messages ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  employee_id  UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  sender_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  subject      VARCHAR,
  message      TEXT        NOT NULL,
  send_via     VARCHAR     NOT NULL DEFAULT 'internal',
  priority     VARCHAR     NOT NULL DEFAULT 'normal',
  status       VARCHAR     NOT NULL DEFAULT 'sent',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Employee notifications ────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  employee_id  UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title        VARCHAR     NOT NULL,
  message      TEXT,
  type         VARCHAR     NOT NULL DEFAULT 'general',
  is_read      BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
