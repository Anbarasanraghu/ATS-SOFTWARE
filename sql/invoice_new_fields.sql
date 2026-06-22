-- Extended invoice fields for improved invoice creation
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_terms    VARCHAR,
  ADD COLUMN IF NOT EXISTS other_charges    NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total   NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_gst     VARCHAR,
  ADD COLUMN IF NOT EXISTS terms            TEXT;

-- Discount support on line items
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS discount       NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type  VARCHAR DEFAULT 'amount';
