-- ============================================================
-- 015_batch_extra.sql — pharmacy batch extras (MRP + manufacturer)
-- MRP is printed on medicine packs; manufacturer/marketer is tracked per batch.
-- ============================================================

alter table product_batches add column if not exists mrp          numeric(14,2);
alter table product_batches add column if not exists manufacturer text;
