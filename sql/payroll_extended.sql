-- ── Payroll Extended Tables ────────────────────────────────────
-- Run in Supabase SQL Editor.
-- These tables power the comprehensive Payroll module.

CREATE TABLE IF NOT EXISTS payrolls (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id            UUID        NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    payroll_month          VARCHAR(7)  NOT NULL, -- YYYY-MM

    -- Employee snapshot
    basic_salary           NUMERIC(14,2) NOT NULL DEFAULT 0,
    salary_type            VARCHAR(20)   DEFAULT 'monthly',

    -- Attendance
    total_working_days     INTEGER     DEFAULT 26,
    present_days           NUMERIC(5,2) DEFAULT 0,
    absent_days            NUMERIC(5,2) DEFAULT 0,
    late_days              INTEGER     DEFAULT 0,
    early_leave_days       INTEGER     DEFAULT 0,
    total_worked_hours     NUMERIC(6,2) DEFAULT 0,
    required_working_hours NUMERIC(6,2) DEFAULT 0,

    -- Leave
    paid_leave_days        NUMERIC(5,2) DEFAULT 0,
    sick_leave_days        NUMERIC(5,2) DEFAULT 0,
    casual_leave_days      NUMERIC(5,2) DEFAULT 0,
    unpaid_leave_days      NUMERIC(5,2) DEFAULT 0,
    half_day_leave         NUMERIC(5,2) DEFAULT 0,
    remaining_leave_balance NUMERIC(5,2) DEFAULT 0,

    -- LOP
    lop_days               NUMERIC(5,2) DEFAULT 0,
    per_day_salary         NUMERIC(14,2) DEFAULT 0,
    lop_deduction          NUMERIC(14,2) DEFAULT 0,
    lop_reason             TEXT,

    -- Overtime
    normal_ot_hours        NUMERIC(6,2) DEFAULT 0,
    night_ot_hours         NUMERIC(6,2) DEFAULT 0,
    holiday_ot_hours       NUMERIC(6,2) DEFAULT 0,
    per_hour_salary        NUMERIC(14,2) DEFAULT 0,
    normal_ot_multiplier   NUMERIC(4,2) DEFAULT 1.25,
    night_ot_multiplier    NUMERIC(4,2) DEFAULT 1.50,
    holiday_ot_multiplier  NUMERIC(4,2) DEFAULT 2.00,
    total_ot_amount        NUMERIC(14,2) DEFAULT 0,

    -- Salary summary
    total_allowances       NUMERIC(14,2) DEFAULT 0,
    total_deductions       NUMERIC(14,2) DEFAULT 0,
    gross_salary           NUMERIC(14,2) DEFAULT 0,
    net_salary             NUMERIC(14,2) DEFAULT 0,

    -- Status
    payroll_status         VARCHAR(30)  DEFAULT 'draft',
    payment_status         VARCHAR(20)  DEFAULT 'unpaid',
    payment_date           DATE,
    payment_method         VARCHAR(30),
    transaction_id         VARCHAR(100),
    payment_notes          TEXT,

    -- Meta
    created_by             UUID,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, employee_id, payroll_month)
);

CREATE TABLE IF NOT EXISTS payroll_allowances (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id     UUID        NOT NULL REFERENCES payrolls(id) ON DELETE CASCADE,
    allowance_name VARCHAR(100) NOT NULL,
    amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_deductions (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id     UUID        NOT NULL REFERENCES payrolls(id) ON DELETE CASCADE,
    deduction_name VARCHAR(100) NOT NULL,
    amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_advances (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id      UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    advance_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
    deduction_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    remaining_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    advance_date     DATE        NOT NULL,
    status           VARCHAR(20) DEFAULT 'active',
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_activity_logs (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id    UUID        NOT NULL REFERENCES payrolls(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    description   TEXT,
    created_by    UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
