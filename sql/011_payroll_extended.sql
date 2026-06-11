-- ============================================================
-- 011_payroll_extended.sql — full payroll for an Indian SMB
--   • employee statutory IDs + bank + default salary structure
--   • itemised earnings/deductions, gross, employer PF/ESI,
--     LOP days, approver + paid tracking
-- Safe to re-run.
-- ============================================================

-- ── Employee master: statutory + bank + salary structure ────
alter table employees add column if not exists pan            text;
alter table employees add column if not exists aadhaar        text;
alter table employees add column if not exists uan            text;          -- PF universal account no.
alter table employees add column if not exists pf_number      text;
alter table employees add column if not exists esi_number     text;
alter table employees add column if not exists bank_account   text;
alter table employees add column if not exists bank_ifsc      text;
alter table employees add column if not exists bank_name      text;
-- Default monthly earning components used to pre-fill payroll, e.g.
-- {"basic":20000,"hra":8000,"da":0,"conveyance":1600,"medical":1250,"special":0}
alter table employees add column if not exists salary_structure jsonb not null default '{}'::jsonb;

-- ── Payroll record: itemised + statutory + employer + paid ──
alter table payroll_records add column if not exists earnings          jsonb   not null default '{}'::jsonb;
alter table payroll_records add column if not exists deductions_detail jsonb   not null default '{}'::jsonb;
alter table payroll_records add column if not exists gross_earnings    numeric(14,2) not null default 0;
alter table payroll_records add column if not exists total_deductions  numeric(14,2) not null default 0;
alter table payroll_records add column if not exists employer_pf       numeric(14,2) not null default 0;
alter table payroll_records add column if not exists employer_esi      numeric(14,2) not null default 0;
alter table payroll_records add column if not exists working_days      numeric(5,1);
alter table payroll_records add column if not exists paid_days         numeric(5,1);
alter table payroll_records add column if not exists lop_days          numeric(5,1) not null default 0;
alter table payroll_records add column if not exists approved_by       uuid references users(id);
alter table payroll_records add column if not exists paid_on           date;
alter table payroll_records add column if not exists payment_method    text;
alter table payroll_records add column if not exists payment_reference text;
