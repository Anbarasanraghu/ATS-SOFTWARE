-- ============================================================
-- 018_perf_indexes.sql — performance indexes for hot lookups
-- Safe & additive. Speeds up barcode/SKU scans, inventory filters,
-- payroll, reports date ranges and stock movement feeds.
-- ============================================================

-- Barcode / SKU scans (POS + inventory scan were full table scans)
create index if not exists products_barcode_idx        on products(tenant_id, barcode);
create index if not exists products_sku_idx            on products(tenant_id, sku);
create index if not exists product_barcodes_code_idx   on product_barcodes(barcode);
create index if not exists product_barcodes_product_idx on product_barcodes(product_id);

-- Inventory filters by category / supplier
create index if not exists products_category_idx       on products(tenant_id, category_id);
create index if not exists products_supplier_idx       on products(tenant_id, supplier_id);

-- Stock movement feed (Updates / activity)
create index if not exists stock_movements_created_idx on stock_movements(tenant_id, created_at desc);
create index if not exists stock_movements_product_created_idx on stock_movements(product_id, created_at desc);

-- Reports: revenue-by-month & date-range filters
create index if not exists invoices_issue_date_idx     on invoices(tenant_id, issue_date);
create index if not exists payments_date_idx           on payments(tenant_id, payment_date);

-- Payroll (comprehensive "payrolls" table)
create index if not exists payrolls_tenant_idx         on payrolls(tenant_id);
create index if not exists payrolls_employee_idx       on payrolls(employee_id);
create index if not exists payrolls_month_idx          on payrolls(tenant_id, payroll_month);

-- Employees by department
create index if not exists employees_department_idx    on employees(tenant_id, department_id);

-- Agent audit/conversation lookups already covered in 016.
