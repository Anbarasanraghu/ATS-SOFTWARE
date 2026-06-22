-- HR Extended v3 Migration — WhatsApp messaging fields
-- Run once in Supabase SQL Editor

ALTER TABLE employee_messages
  ADD COLUMN IF NOT EXISTS message_type       VARCHAR  DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS related_module     VARCHAR,
  ADD COLUMN IF NOT EXISTS related_record_id  UUID;
