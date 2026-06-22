const BASE = "http://localhost:8000";

let token: string | null = localStorage.getItem("erp_token");

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem("erp_token", t);
  else localStorage.removeItem("erp_token");
}
export function getToken() { return token; }

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    let detail = res.statusText;
    try { const d = await res.json(); if (typeof d.detail === "string") detail = d.detail; } catch { /* */ }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────
export interface Me {
  user: { id: string; email: string; full_name: string | null; is_platform_admin: boolean; role: string };
  tenant: { slug: string; name: string; vertical: string };
  modules: string[];
}

// ── Field definitions ────────────────────────────────────────
export interface FieldDef {
  field_key: string; label: string;
  data_type: "text" | "number" | "boolean" | "date" | "select" | "multiselect";
  is_required: boolean;
  options: (string | { value: string; label?: string })[];
  sort_order: number;
}

// ── Inventory ────────────────────────────────────────────────
export interface Category { id: string; name: string; description: string | null; created_at: string; }
export interface Supplier {
  id: string; name: string; email: string | null; phone: string | null;
  address: string | null; contact_person: string | null; notes: string | null;
  status: string; created_at: string;
}
export interface Product {
  id: string; sku: string | null; barcode: string | null; barcode_type?: string | null; name: string; unit: string;
  price: number; cost_price: number; tax_percent: number;
  stock_qty: number; reorder_level: number; is_low_stock: boolean;
  category_id: string | null; supplier_id: string | null;
  custom_fields: Record<string, unknown>;
  expiry_status?: "none" | "ok" | "near" | "expired" | null;
  nearest_expiry?: string | null;
  sellable_qty?: number | null;
}
export interface ProductBarcode { id: string; barcode: string; barcode_type: string; kind: string; }
export interface ProductBatch {
  id: string; product_id: string; product_name: string;
  batch_no: string | null; mfg_date: string | null; expiry_date: string | null;
  quantity: number; mrp: number | null; manufacturer: string | null;
  status: "ok" | "near" | "expired"; days_to_expiry: number | null; created_at: string;
}
export interface BatchSummary {
  batches: number; sellable_units: number; near_count: number;
  expired_count: number; expired_units: number; stock_value: number;
}
export interface StockMovement {
  id: string; product_id: string; product_name: string;
  movement_type: string; quantity: number; unit_cost: number | null;
  reference: string | null; notes: string | null; created_at: string;
}
export interface Activity {
  id: string; entity: string; entity_id: string | null; entity_name: string | null;
  action: string; detail: Record<string, unknown>; actor: string | null; created_at: string;
}
export interface DailyCount { day: string; count: number; }
export interface DocItem {
  id?: string; product_id: string | null; description: string;
  quantity: number; unit_price: number; tax_percent: number; line_total?: number;
}
export interface InventoryDoc {
  id: string; doc_type: "purchase" | "sale"; doc_number: string | null;
  party_id: string | null; party_name: string | null; doc_date: string;
  status: string; subtotal: number; tax_total: number; total: number;
  notes: string | null; created_at: string; items: DocItem[];
}
export interface LowStockItem {
  id: string; name: string; sku: string | null; stock_qty: number; reorder_level: number; unit: string;
}
export interface InventorySummary {
  item_count: number; total_stock_units: number;
  stock_value_cost: number; stock_value_retail: number;
  low_stock_count: number; low_stock_items: LowStockItem[];
  purchases_total: number; sales_total: number;
  purchases_today: number; sales_today: number;
}
export interface PeriodStat {
  period: string; stock_in: number; stock_out: number; purchases: number; sales: number;
}

// ── Billing ──────────────────────────────────────────────────
export interface InvoiceItem {
  id: string; product_id: string | null; description: string;
  quantity: number; unit_price: number; tax_percent: number;
  discount: number; discount_type: string; line_total: number;
}
export interface Payment {
  id: string; invoice_id: string; amount: number;
  payment_date: string; method: string; reference: string | null;
  notes: string | null; created_at: string;
}
export interface Invoice {
  id: string; customer_id: string | null; invoice_number: string;
  customer_name: string; customer_email: string | null; customer_phone: string | null;
  customer_address: string | null; customer_gst: string | null; payment_terms: string | null;
  issue_date: string; due_date: string | null;
  status: "draft" | "sent" | "paid" | "void";
  notes: string | null; terms: string | null;
  subtotal: number; tax_total: number; discount_total: number; other_charges: number;
  total: number; amount_paid: number; balance_due: number;
  items?: InvoiceItem[]; payments?: Payment[];
}

// ── CRM ──────────────────────────────────────────────────────
export interface Customer {
  id: string; name: string; email: string | null; phone: string | null;
  whatsapp: string | null; company: string | null; address: string | null;
  notes: string | null; status: string;
  crm_status: string; priority: string;
  source: string | null; interested_service: string | null;
  requirement_details: string | null; assigned_staff: string | null;
  first_followup_date: string | null; first_followup_time: string | null;
  last_followup_date: string | null; next_followup_date: string | null;
  tags: string[];
  payment_status: string | null;
  custom_fields: Record<string, unknown>; created_at: string; updated_at: string | null;
}
export interface CustomerPaymentFollowup {
  id: string; customer_id: string;
  invoice_number: string | null; invoice_amount: number; paid_amount: number; balance_amount: number;
  payment_status: string; payment_notes: string | null;
  next_payment_followup_date: string | null;
  reminder_needed: boolean; created_by: string | null; created_at: string;
}
export interface FollowupReportRow {
  customer_name: string; customer_phone: string | null; assigned_staff: string | null;
  followup_mode: string; followup_status: string; notes: string | null;
  next_followup_date: string | null; created_at: string;
}
export interface PaymentFollowupReportRow {
  id: string; customer_id: string;
  customer_name: string; customer_phone: string | null; customer_company: string | null;
  invoice_number: string | null; invoice_amount: number; paid_amount: number; balance_amount: number;
  payment_status: string; payment_notes: string | null;
  next_payment_followup_date: string | null; reminder_needed: boolean; created_at: string;
}
export const PAYMENT_STATUSES = [
  { value: "invoice_sent",           label: "Invoice Sent" },
  { value: "payment_pending",        label: "Payment Pending" },
  { value: "partially_paid",         label: "Partially Paid" },
  { value: "payment_completed",      label: "Payment Completed" },
  { value: "payment_reminder_sent",  label: "Payment Reminder Sent" },
];
export interface CustomerFollowup {
  id: string; customer_id: string; followup_mode: string; followup_status: string;
  notes: string | null; next_followup_date: string | null; next_followup_time: string | null;
  reminder_needed: boolean; created_by: string | null; created_at: string;
}
export interface Interaction {
  id: string; type: string; subject: string | null; body: string; created_at: string;
}
export interface CustomerInvoice {
  id: string; invoice_number: string; issue_date: string | null; due_date: string | null;
  total: number; amount_paid: number; status: string;
}

export const CRM_STATUSES: { value: string; label: string; cls: string }[] = [
  { value: "new_lead",          label: "New Lead",           cls: "bg-blue-100 text-blue-700" },
  { value: "contacted",         label: "Contacted",          cls: "bg-purple-100 text-purple-700" },
  { value: "interested",        label: "Interested",         cls: "bg-green-100 text-green-700" },
  { value: "demo_scheduled",    label: "Demo Scheduled",     cls: "bg-teal-100 text-teal-700" },
  { value: "quotation_sent",    label: "Quotation Sent",     cls: "bg-indigo-100 text-indigo-700" },
  { value: "follow_up_pending", label: "Follow-up Pending",  cls: "bg-orange-100 text-orange-700" },
  { value: "converted",         label: "Converted",          cls: "bg-emerald-200 text-emerald-800" },
  { value: "lost",              label: "Lost",               cls: "bg-red-100 text-red-700" },
  { value: "not_interested",    label: "Not Interested",     cls: "bg-zinc-100 text-zinc-500" },
];

export const PRIORITIES: { value: string; label: string; cls: string }[] = [
  { value: "high",   label: "High",   cls: "bg-red-100 text-red-700" },
  { value: "medium", label: "Medium", cls: "bg-amber-100 text-amber-700" },
  { value: "low",    label: "Low",    cls: "bg-gray-100 text-gray-500" },
];

export const FOLLOWUP_MODES = ["Call", "WhatsApp", "Email", "Meeting", "Payment"];
export const SOURCES = ["Website", "Phone Call", "WhatsApp", "Reference", "Walk-in", "Social Media", "Existing Customer"];
export const SERVICES = ["Billing Software", "CRM Software", "Inventory Software", "Invoice Software",
  "Website Development", "Mobile App Development", "Custom Software", "Other"];

// ── HR ────────────────────────────────────────────────────────
export interface Department { id: string; name: string; description: string | null; created_at: string; }
export interface Designation { id: string; name: string; department_id: string | null; created_at: string; }
export interface Employee {
  id: string; employee_no: string | null; full_name: string;
  email: string | null; phone: string | null;
  department_id: string | null; department: string | null; job_title: string | null;
  hire_date: string | null; status: string;
  salary: number | null; annual_leave_balance: number;
  notes: string | null; custom_fields: Record<string, unknown>; created_at: string;
  // Extended fields
  designation: string | null;
  work_location: string | null;
  employee_type: string | null;
  work_shift: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  reporting_manager_id: string | null;
  family_details: Record<string, unknown>;
  insurance_details: Record<string, unknown>;
  system_details: Record<string, unknown>;
}
export interface EmployeeTask {
  id: string; employee_id: string; title: string; description: string | null;
  project_client: string | null; priority: string; status: string;
  due_date: string | null; assigned_by: string | null; notes: string | null;
  notify_employee: boolean; employee_remarks: string | null; created_at: string;
}
export interface EmployeeWorkReport {
  id: string; employee_id: string; report_date: string; report_type: string | null;
  work_type: string | null; project_client: string | null; work_summary: string | null;
  hours_worked: number | null; status: string; manager_remarks: string | null; created_at: string;
}
export interface EmployeeCallLog {
  id: string; employee_id: string; call_date: string;
  customer_client_name: string | null; phone_number: string | null;
  call_type: string | null; call_status: string | null;
  duration: string | null; notes: string | null; followup_required: boolean;
  next_followup_date: string | null; created_at: string;
}
export interface EmployeeProject {
  id: string; employee_id: string; project_name: string;
  client_name: string | null; employee_role: string | null;
  start_date: string | null; end_date: string | null;
  status: string; project_notes: string | null; created_at: string;
}
export interface EmployeePermission {
  module: string; label: string; has_access: boolean;
}
export interface EmployeeMessage {
  id: string; employee_id: string; subject: string | null;
  message: string; send_via: string; priority: string; status: string;
  message_type: string; related_module: string | null; related_record_id: string | null;
  created_at: string;
}
export interface EmployeeNotification {
  id: string; employee_id: string; title: string;
  message: string | null; type: string; is_read: boolean; created_at: string;
}
export interface EmployeeLog {
  id: string; employee_id: string; action: string; details: string | null; created_at: string;
}
export interface EmployeeNote {
  id: string; employee_id: string; note: string; created_at: string;
}
export interface LeaveRequest {
  id: string; employee_id: string; employee_name: string;
  leave_type: string; start_date: string; end_date: string;
  days: number; reason: string | null; status: string;
  notes: string | null; created_at: string;
}
export interface PayrollRecord {
  id: string; employee_id: string; employee_name: string;
  period_month: number; period_year: number;
  basic_salary: number; allowances: number; deductions: number; net_salary: number;
  earnings: Record<string, number>; deductions_detail: Record<string, number>;
  gross_earnings: number; total_deductions: number;
  employer_pf: number; employer_esi: number;
  working_days: number | null; paid_days: number | null; lop_days: number;
  paid_on: string | null; payment_method: string | null; payment_reference: string | null;
  status: string; notes: string | null; created_at: string;
}
export interface PayrollSummary {
  period_month: number; period_year: number; count: number;
  gross: number; deductions: number; net: number;
  employer_pf: number; employer_esi: number;
  pf_total: number; esi_total: number; pt_total: number; tds_total: number; ctc: number;
}
export interface Payslip {
  company: { name: string };
  record: PayrollRecord;
  employee: Record<string, string | null>;
  ytd: { gross: number; deductions: number; net: number; financial_year: string };
}

// ── Payroll v2 (comprehensive) ────────────────────────────────
export interface PayrollAllowanceRow { id: string; allowance_name: string; amount: number; }
export interface PayrollDeductionRow { id: string; deduction_name: string; amount: number; }
export interface Payroll {
  id: string;
  employee_id: string; employee_name: string; employee_no: string | null;
  department: string | null; designation: string | null; phone: string | null;
  payroll_month: string;                  // YYYY-MM
  basic_salary: number; salary_type: string;
  total_working_days: number; present_days: number; absent_days: number;
  late_days: number; early_leave_days: number;
  total_worked_hours: number; required_working_hours: number;
  paid_leave_days: number; sick_leave_days: number; casual_leave_days: number;
  unpaid_leave_days: number; half_day_leave: number; remaining_leave_balance: number;
  lop_days: number; per_day_salary: number; lop_deduction: number; lop_reason: string | null;
  normal_ot_hours: number; night_ot_hours: number; holiday_ot_hours: number;
  per_hour_salary: number;
  normal_ot_multiplier: number; night_ot_multiplier: number; holiday_ot_multiplier: number;
  total_ot_amount: number;
  total_allowances: number; total_deductions: number; gross_salary: number; net_salary: number;
  payroll_status: string; payment_status: string;
  payment_date: string | null; payment_method: string | null;
  transaction_id: string | null; payment_notes: string | null;
  allowances: PayrollAllowanceRow[]; deductions: PayrollDeductionRow[];
  created_at: string;
}
export interface PayrollStats {
  total_employees: number; total_payroll: number;
  paid_count: number; pending_count: number;
  total_deductions: number; total_ot_amount: number;
}
export interface LeaveSummary {
  paid_leave_days: number; sick_leave_days: number; casual_leave_days: number;
  unpaid_leave_days: number; half_day_leave: number; remaining_leave_balance: number;
}

// ── Settings ─────────────────────────────────────────────────
export interface CompanySettings {
  company_name: string | null;
  company_logo: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  gst_number: string | null;
  website: string | null;
  upi_id: string | null;
}
export interface InvoiceSettings {
  invoice_prefix: string | null;
  next_invoice_number: number | null;
  default_tax_percent: number | null;
  default_payment_terms: string | null;
  default_terms: string | null;
  invoice_footer_note: string | null;
}
export interface PrintSettings {
  default_print_size: string;
  enable_a4_full: boolean;
  enable_a4_half: boolean;
  enable_33x55: boolean;
  show_logo: boolean;
  show_gst: boolean;
  show_terms: boolean;
  show_signature: boolean;
}

// ── Reports ──────────────────────────────────────────────────
export interface ReportSummary {
  invoices: { total: number; draft: number; sent: number; paid: number; void: number };
  revenue: number; outstanding: number; customer_count: number; product_count: number;
  recent_invoices: { id: string; invoice_number: string; customer_name: string; total: number; status: string; issue_date: string | null }[];
  top_customers: { name: string; total: number }[];
}
export interface MonthStat { month: string; count: number; total: number; }

// ── Company settings cache (shared across all pages) ─────────
let _companyCache: CompanySettings | null = null;
let _companyCacheTs = 0;
const COMPANY_TTL = 5 * 60 * 1000; // 5 minutes

function _companyValid() {
  return _companyCache !== null && Date.now() - _companyCacheTs < COMPANY_TTL;
}

export function invalidateCompanyCache() {
  _companyCache = null;
  _companyCacheTs = 0;
}

// ── API ───────────────────────────────────────────────────────
export const api = {
  // Auth
  login: (tenant_slug: string, email: string, password: string) =>
    request<{ access_token: string }>("/auth/login", { method: "POST", auth: false, body: { tenant_slug, email, password } }),
  me: () => request<Me>("/auth/me"),

  // Field defs
  fieldDefinitions: (entity: string) =>
    request<FieldDef[]>(`/field-definitions?entity=${encodeURIComponent(entity)}`),

  // Categories
  listCategories: () => request<Category[]>("/inventory/categories"),
  createCategory: (body: unknown) => request<Category>("/inventory/categories", { method: "POST", body }),
  updateCategory: (id: string, body: unknown) => request<Category>(`/inventory/categories/${id}`, { method: "PUT", body }),
  deleteCategory: (id: string) => request<void>(`/inventory/categories/${id}`, { method: "DELETE" }),

  // Suppliers
  listSuppliers: () => request<Supplier[]>("/inventory/suppliers"),
  createSupplier: (body: unknown) => request<Supplier>("/inventory/suppliers", { method: "POST", body }),
  updateSupplier: (id: string, body: unknown) => request<Supplier>(`/inventory/suppliers/${id}`, { method: "PUT", body }),
  deleteSupplier: (id: string) => request<void>(`/inventory/suppliers/${id}`, { method: "DELETE" }),

  // Stock movements
  listStockMovements: (productId?: string) =>
    request<StockMovement[]>(`/inventory/stock-movements${productId ? `?product_id=${productId}` : ""}`),
  createStockMovement: (body: unknown) =>
    request<StockMovement>("/inventory/stock-movements", { method: "POST", body }),

  // Products
  scanProduct: (code: string) => request<Product>(`/products/scan?code=${encodeURIComponent(code)}`),
  listProducts: () => request<Product[]>("/products"),
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  createProduct: (body: unknown) => request<Product>("/products", { method: "POST", body }),
  updateProduct: (id: string, body: unknown) => request<Product>(`/products/${id}`, { method: "PUT", body }),
  patchProduct: (id: string, body: Record<string, unknown>) => request<Product>(`/products/${id}`, { method: "PATCH", body }),
  deleteProduct: (id: string) => request<void>(`/products/${id}`, { method: "DELETE" }),
  bulkDeleteProducts: (ids: string[]) => request<void>("/products/bulk-delete", { method: "POST", body: { ids } }),

  // Multiple barcodes per product
  listProductBarcodes: (productId: string) => request<ProductBarcode[]>(`/products/${productId}/barcodes`),
  addProductBarcode: (productId: string, body: { barcode?: string; barcode_type?: string; kind?: string }) =>
    request<ProductBarcode>(`/products/${productId}/barcodes`, { method: "POST", body }),
  deleteProductBarcode: (barcodeId: string) => request<void>(`/products/barcodes/${barcodeId}`, { method: "DELETE" }),

  // Pharmacy — batches & expiry
  listBatches: (productId?: string) => request<ProductBatch[]>(`/pharmacy/batches${productId ? `?product_id=${productId}` : ""}`),
  addBatch: (body: unknown) => request<ProductBatch>("/pharmacy/batches", { method: "POST", body }),
  deleteBatch: (id: string) => request<void>(`/pharmacy/batches/${id}`, { method: "DELETE" }),
  expiryReport: (days = 90) => request<ProductBatch[]>(`/pharmacy/expiry?days=${days}`),
  batchSummary: () => request<BatchSummary>("/pharmacy/summary"),

  // Inventory activity feed
  listActivity: (limit = 100) => request<Activity[]>(`/inventory/activity?limit=${limit}`),
  activityDaily: (days = 90) => request<DailyCount[]>(`/inventory/activity/daily?days=${days}`),

  // Purchase / Sales documents
  listDocuments: (docType: "purchase" | "sale") => request<InventoryDoc[]>(`/inventory/documents?doc_type=${docType}`),
  getDocument: (id: string) => request<InventoryDoc>(`/inventory/documents/${id}`),
  createDocument: (body: unknown) => request<InventoryDoc>("/inventory/documents", { method: "POST", body }),
  deleteDocument: (id: string) => request<void>(`/inventory/documents/${id}`, { method: "DELETE" }),

  // Inventory reports
  inventorySummary: () => request<InventorySummary>("/inventory/reports/summary"),
  inventoryByPeriod: (period: "daily" | "monthly") => request<PeriodStat[]>(`/inventory/reports/by-period?period=${period}`),

  // Invoices
  listInvoices: () => request<Invoice[]>("/billing"),
  getInvoice: (id: string) => request<Invoice>(`/billing/${id}`),
  getNextInvoiceNumber: () => request<{ invoice_number: string }>("/billing/next-number"),
  createInvoice: (body: unknown) => request<Invoice>("/billing", { method: "POST", body }),
  updateInvoiceStatus: (id: string, status: string) =>
    request<Invoice>(`/billing/${id}/status`, { method: "PATCH", body: { status } }),
  deleteInvoice: (id: string) => request<void>(`/billing/${id}`, { method: "DELETE" }),
  recordPayment: (invoiceId: string, body: unknown) =>
    request<Payment>(`/billing/${invoiceId}/payments`, { method: "POST", body }),
  deletePayment: (invoiceId: string, paymentId: string) =>
    request<void>(`/billing/${invoiceId}/payments/${paymentId}`, { method: "DELETE" }),

  // Customers
  listCustomers: () => request<Customer[]>("/customers"),
  getCustomer: (id: string) => request<Customer>(`/customers/${id}`),
  createCustomer: (body: unknown) => request<Customer>("/customers", { method: "POST", body }),
  updateCustomer: (id: string, body: unknown) => request<Customer>(`/customers/${id}`, { method: "PUT", body }),
  patchCrmStatus: (id: string, crm_status: string) =>
    request<Customer>(`/customers/${id}/crm-status`, { method: "PATCH", body: { crm_status } }),
  deleteCustomer: (id: string) => request<void>(`/customers/${id}`, { method: "DELETE" }),
  customerInvoices: (id: string) => request<CustomerInvoice[]>(`/customers/${id}/invoices`),
  listInteractions: (customerId: string) => request<Interaction[]>(`/customers/${customerId}/interactions`),
  addInteraction: (customerId: string, body: unknown) =>
    request<Interaction>(`/customers/${customerId}/interactions`, { method: "POST", body }),
  deleteInteraction: (customerId: string, interactionId: string) =>
    request<void>(`/customers/${customerId}/interactions/${interactionId}`, { method: "DELETE" }),
  listFollowups: (customerId: string) => request<CustomerFollowup[]>(`/customers/${customerId}/followups`),
  addFollowup: (customerId: string, body: unknown) =>
    request<CustomerFollowup>(`/customers/${customerId}/followups`, { method: "POST", body }),
  listPaymentFollowups: (customerId: string) =>
    request<CustomerPaymentFollowup[]>(`/customers/${customerId}/payment-followups`),
  addPaymentFollowup: (customerId: string, body: unknown) =>
    request<CustomerPaymentFollowup>(`/customers/${customerId}/payment-followups`, { method: "POST", body }),
  followupsReport: () => request<FollowupReportRow[]>("/customers/follow-ups-report"),
  paymentFollowupsReport: () => request<PaymentFollowupReportRow[]>("/customers/payment-followups-report"),

  // Reports
  reportSummary: () => request<ReportSummary>("/reports/summary"),
  reportByMonth: () => request<MonthStat[]>("/reports/invoices-by-month"),

  // Departments
  listDepartments: () => request<Department[]>("/employees/departments"),
  createDepartment: (body: unknown) => request<Department>("/employees/departments", { method: "POST", body }),
  updateDepartment: (id: string, body: unknown) => request<Department>(`/employees/departments/${id}`, { method: "PUT", body }),
  deleteDepartment: (id: string) => request<void>(`/employees/departments/${id}`, { method: "DELETE" }),

  // Designations
  listDesignations: () => request<Designation[]>("/employees/designations"),
  createDesignation: (body: unknown) => request<Designation>("/employees/designations", { method: "POST", body }),
  updateDesignation: (id: string, body: unknown) => request<Designation>(`/employees/designations/${id}`, { method: "PUT", body }),
  deleteDesignation: (id: string) => request<void>(`/employees/designations/${id}`, { method: "DELETE" }),

  // Employees
  listEmployees: () => request<Employee[]>("/employees"),
  getEmployee: (id: string) => request<Employee>(`/employees/${id}`),
  createEmployee: (body: unknown) => request<Employee>("/employees", { method: "POST", body }),
  updateEmployee: (id: string, body: unknown) => request<Employee>(`/employees/${id}`, { method: "PUT", body }),
  deleteEmployee: (id: string) => request<void>(`/employees/${id}`, { method: "DELETE" }),
  patchEmployeeStatus: (id: string, status: string) =>
    request<Employee>(`/employees/${id}/status`, { method: "PATCH", body: { status } }),

  // Employee tasks
  listEmployeeTasks: (id: string) => request<EmployeeTask[]>(`/employees/${id}/tasks`),
  createEmployeeTask: (id: string, body: unknown) => request<EmployeeTask>(`/employees/${id}/tasks`, { method: "POST", body }),
  updateEmployeeTask: (id: string, taskId: string, body: unknown) =>
    request<EmployeeTask>(`/employees/${id}/tasks/${taskId}`, { method: "PUT", body }),
  deleteEmployeeTask: (id: string, taskId: string) =>
    request<void>(`/employees/${id}/tasks/${taskId}`, { method: "DELETE" }),

  // Employee work reports
  listWorkReports: (id: string) => request<EmployeeWorkReport[]>(`/employees/${id}/work-reports`),
  createWorkReport: (id: string, body: unknown) => request<EmployeeWorkReport>(`/employees/${id}/work-reports`, { method: "POST", body }),
  deleteWorkReport: (id: string, reportId: string) =>
    request<void>(`/employees/${id}/work-reports/${reportId}`, { method: "DELETE" }),

  // Employee call logs
  listCallLogs: (id: string) => request<EmployeeCallLog[]>(`/employees/${id}/call-logs`),
  createCallLog: (id: string, body: unknown) => request<EmployeeCallLog>(`/employees/${id}/call-logs`, { method: "POST", body }),
  deleteCallLog: (id: string, logId: string) =>
    request<void>(`/employees/${id}/call-logs/${logId}`, { method: "DELETE" }),

  // Employee projects
  listEmployeeProjects: (id: string) => request<EmployeeProject[]>(`/employees/${id}/projects`),
  createEmployeeProject: (id: string, body: unknown) => request<EmployeeProject>(`/employees/${id}/projects`, { method: "POST", body }),
  deleteEmployeeProject: (id: string, projId: string) =>
    request<void>(`/employees/${id}/projects/${projId}`, { method: "DELETE" }),

  // Employee logs & notes
  listEmployeeLogs: (id: string) => request<EmployeeLog[]>(`/employees/${id}/logs`),
  listEmployeeNotes: (id: string) => request<EmployeeNote[]>(`/employees/${id}/notes`),
  createEmployeeNote: (id: string, body: unknown) => request<EmployeeNote>(`/employees/${id}/notes`, { method: "POST", body }),
  deleteEmployeeNote: (id: string, noteId: string) =>
    request<void>(`/employees/${id}/notes/${noteId}`, { method: "DELETE" }),

  // Employee leave history (per-employee)
  listEmployeeLeaveHistory: (id: string) => request<LeaveRequest[]>(`/employees/${id}/leave-history`),

  // Employee permissions
  listPermissions: (id: string) => request<EmployeePermission[]>(`/employees/${id}/permissions`),
  updatePermissions: (id: string, body: unknown) =>
    request<EmployeePermission[]>(`/employees/${id}/permissions`, { method: "PUT", body }),

  // Employee messages
  listMessages: (id: string) => request<EmployeeMessage[]>(`/employees/${id}/messages`),
  sendMessage: (id: string, body: unknown) =>
    request<EmployeeMessage>(`/employees/${id}/messages`, { method: "POST", body }),

  // Employee notifications
  listNotifications: (id: string) => request<EmployeeNotification[]>(`/employees/${id}/notifications`),

  // Leave requests
  listLeaveRequests: () => request<LeaveRequest[]>("/employees/leave-requests"),
  createLeaveRequest: (body: unknown) => request<LeaveRequest>("/employees/leave-requests", { method: "POST", body }),
  updateLeaveStatus: (id: string, body: unknown) =>
    request<LeaveRequest>(`/employees/leave-requests/${id}/status`, { method: "PATCH", body }),
  deleteLeaveRequest: (id: string) => request<void>(`/employees/leave-requests/${id}`, { method: "DELETE" }),

  // Payroll
  listPayroll: (q: { month?: number; year?: number; status_f?: string } = {}) => {
    const p = new URLSearchParams();
    if (q.month) p.set("month", String(q.month));
    if (q.year) p.set("year", String(q.year));
    if (q.status_f) p.set("status_f", q.status_f);
    const qs = p.toString();
    return request<PayrollRecord[]>(`/employees/payroll${qs ? `?${qs}` : ""}`);
  },
  createPayroll: (body: unknown) => request<PayrollRecord>("/employees/payroll", { method: "POST", body }),
  updatePayroll: (id: string, body: unknown) => request<PayrollRecord>(`/employees/payroll/${id}`, { method: "PUT", body }),
  runPayroll: (body: unknown) =>
    request<{ created: number; skipped: number; records: PayrollRecord[] }>("/employees/payroll/run", { method: "POST", body }),
  payrollSummary: (month: number, year: number) =>
    request<PayrollSummary>(`/employees/payroll/summary?month=${month}&year=${year}`),
  payslip: (id: string) => request<Payslip>(`/employees/payroll/${id}/payslip`),
  updatePayrollStatus: (id: string, body: { status: string; payment_method?: string; payment_reference?: string; paid_on?: string }) =>
    request<PayrollRecord>(`/employees/payroll/${id}/status`, { method: "PATCH", body }),
  deletePayroll: (id: string) => request<void>(`/employees/payroll/${id}`, { method: "DELETE" }),

  // Payroll v2 (comprehensive — /payroll prefix)
  listPayrolls: (month?: string, payroll_status?: string, dept?: string) => {
    const p = new URLSearchParams();
    if (month)          p.set("month", month);
    if (payroll_status) p.set("payroll_status", payroll_status);
    if (dept)           p.set("dept", dept);
    const qs = p.toString();
    return request<Payroll[]>(`/payroll/${qs ? "?" + qs : ""}`);
  },
  createPayrollEntry: (body: unknown) => request<Payroll>("/payroll/", { method: "POST", body }),
  getPayrollEntry: (id: string) => request<Payroll>(`/payroll/${id}`),
  updatePayrollEntry: (id: string, body: unknown) => request<Payroll>(`/payroll/${id}`, { method: "PUT", body }),
  deletePayrollEntry: (id: string) => request<void>(`/payroll/${id}`, { method: "DELETE" }),
  patchPayrollStatus: (id: string, body: unknown) => request<Payroll>(`/payroll/${id}/status`, { method: "PATCH", body }),
  getPayrollStats: (month: string) => request<PayrollStats>(`/payroll/stats?month=${month}`),
  getPayrollLeaveSummary: (empId: string, month: string) =>
    request<LeaveSummary>(`/payroll/leave-summary/${empId}?month=${month}`),

  // Settings
  getCompanySettings: async () => {
    if (_companyValid()) return _companyCache!;
    const data = await request<CompanySettings>("/settings/company");
    _companyCache = data;
    _companyCacheTs = Date.now();
    return data;
  },
  saveCompanySettings: async (body: Partial<CompanySettings>) => {
    const data = await request<CompanySettings>("/settings/company", { method: "PATCH", body });
    _companyCache = data;
    _companyCacheTs = Date.now();
    return data;
  },
  getInvoiceSettings: () => request<InvoiceSettings>("/settings/invoice"),
  saveInvoiceSettings: (body: Partial<InvoiceSettings>) =>
    request<InvoiceSettings>("/settings/invoice", { method: "PATCH", body }),
  getPrintSettings: () => request<PrintSettings>("/settings/print"),
  savePrintSettings: (body: Partial<PrintSettings>) =>
    request<PrintSettings>("/settings/print", { method: "PATCH", body }),

  // Admin
  adminTenants: () => request<{ id: string; name: string; slug: string; vertical: string }[]>("/admin/tenants"),
  adminTenantModules: (tid: string) =>
    request<{ module_id: string; code: string; name: string; category: string; enabled: boolean }[]>(`/admin/tenants/${tid}/modules`),
  adminToggleModule: (tid: string, module_id: string, enabled: boolean) =>
    request(`/admin/tenants/${tid}/modules`, { method: "PUT", body: { module_id, enabled } }),
  adminFields: (tid: string, entity: string) =>
    request<{ id: string; field_key: string; label: string; data_type: string; is_required: boolean; options: unknown[] }[]>(
      `/admin/tenants/${tid}/field-definitions?entity=${entity}`),
  adminAddField: (tid: string, body: unknown) =>
    request(`/admin/tenants/${tid}/field-definitions`, { method: "POST", body }),
};
