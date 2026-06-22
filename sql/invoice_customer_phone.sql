-- Add customer_phone to invoices table for WhatsApp integration
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR;
