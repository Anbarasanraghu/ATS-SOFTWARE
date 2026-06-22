-- ============================================================
-- 012_barcode_unique.sql — make product barcodes scannable & unique
--   • ensure the barcode column exists
--   • one barcode per tenant (partial unique index, ignores NULLs)
-- so POS / invoice / purchase / sales scans resolve to exactly one product.
-- ============================================================

alter table products add column if not exists barcode text;

create unique index if not exists products_tenant_barcode_uidx
  on products (tenant_id, barcode)
  where barcode is not null;
