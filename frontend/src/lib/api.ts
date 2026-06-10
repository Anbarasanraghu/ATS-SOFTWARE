const BASE = "http://localhost:8001";

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
  id: string; sku: string | null; barcode: string | null; name: string; unit: string;
  price: number; cost_price: number; tax_percent: number;
  stock_qty: number; reorder_level: number; is_low_stock: boolean;
  category_id: string | null; supplier_id: string | null;
  custom_fields: Record<string, unknown>;
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
  quantity: number; unit_price: number; tax_percent: number; line_total: number;
}
export interface Payment {
  id: string; invoice_id: string; amount: number;
  payment_date: string; method: string; reference: string | null;
  notes: string | null; created_at: string;
}
export interface Invoice {
  id: string; customer_id: string | null; invoice_number: string;
  customer_name: string; customer_email: string | null;
  issue_date: string; due_date: string | null;
  status: "draft" | "sent" | "paid" | "void";
  notes: string | null; subtotal: number; tax_total: number;
  total: number; amount_paid: number; balance_due: number;
  items?: InvoiceItem[]; payments?: Payment[];
}

// ── CRM ──────────────────────────────────────────────────────
export interface Customer {
  id: string; name: string; email: string | null; phone: string | null;
  company: string | null; address: string | null; notes: string | null;
  status: "active" | "inactive"; custom_fields: Record<string, unknown>; created_at: string;
}
export interface Interaction {
  id: string; type: string; subject: string | null; body: string; created_at: string;
}
export interface CustomerInvoice {
  id: string; invoice_number: string; issue_date: string | null; due_date: string | null;
  total: number; amount_paid: number; status: string;
}

// ── HR ────────────────────────────────────────────────────────
export interface Department { id: string; name: string; description: string | null; created_at: string; }
export interface Employee {
  id: string; employee_no: string | null; full_name: string;
  email: string | null; phone: string | null;
  department_id: string | null; department: string | null; job_title: string | null;
  hire_date: string | null; status: string;
  salary: number | null; annual_leave_balance: number;
  notes: string | null; custom_fields: Record<string, unknown>; created_at: string;
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
  status: string; notes: string | null; created_at: string;
}

// ── Reports ──────────────────────────────────────────────────
export interface ReportSummary {
  invoices: { total: number; draft: number; sent: number; paid: number; void: number };
  revenue: number; outstanding: number; customer_count: number; product_count: number;
  recent_invoices: { id: string; invoice_number: string; customer_name: string; total: number; status: string; issue_date: string | null }[];
  top_customers: { name: string; total: number }[];
}
export interface MonthStat { month: string; count: number; total: number; }

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
  deleteCustomer: (id: string) => request<void>(`/customers/${id}`, { method: "DELETE" }),
  customerInvoices: (id: string) => request<CustomerInvoice[]>(`/customers/${id}/invoices`),
  listInteractions: (customerId: string) => request<Interaction[]>(`/customers/${customerId}/interactions`),
  addInteraction: (customerId: string, body: unknown) =>
    request<Interaction>(`/customers/${customerId}/interactions`, { method: "POST", body }),
  deleteInteraction: (customerId: string, interactionId: string) =>
    request<void>(`/customers/${customerId}/interactions/${interactionId}`, { method: "DELETE" }),

  // Reports
  reportSummary: () => request<ReportSummary>("/reports/summary"),
  reportByMonth: () => request<MonthStat[]>("/reports/invoices-by-month"),

  // Departments
  listDepartments: () => request<Department[]>("/employees/departments"),
  createDepartment: (body: unknown) => request<Department>("/employees/departments", { method: "POST", body }),
  updateDepartment: (id: string, body: unknown) => request<Department>(`/employees/departments/${id}`, { method: "PUT", body }),
  deleteDepartment: (id: string) => request<void>(`/employees/departments/${id}`, { method: "DELETE" }),

  // Employees
  listEmployees: () => request<Employee[]>("/employees"),
  getEmployee: (id: string) => request<Employee>(`/employees/${id}`),
  createEmployee: (body: unknown) => request<Employee>("/employees", { method: "POST", body }),
  updateEmployee: (id: string, body: unknown) => request<Employee>(`/employees/${id}`, { method: "PUT", body }),
  deleteEmployee: (id: string) => request<void>(`/employees/${id}`, { method: "DELETE" }),

  // Leave requests
  listLeaveRequests: () => request<LeaveRequest[]>("/employees/leave-requests"),
  createLeaveRequest: (body: unknown) => request<LeaveRequest>("/employees/leave-requests", { method: "POST", body }),
  updateLeaveStatus: (id: string, body: unknown) =>
    request<LeaveRequest>(`/employees/leave-requests/${id}/status`, { method: "PATCH", body }),
  deleteLeaveRequest: (id: string) => request<void>(`/employees/leave-requests/${id}`, { method: "DELETE" }),

  // Payroll
  listPayroll: () => request<PayrollRecord[]>("/employees/payroll"),
  createPayroll: (body: unknown) => request<PayrollRecord>("/employees/payroll", { method: "POST", body }),
  updatePayrollStatus: (id: string, status: string) =>
    request<PayrollRecord>(`/employees/payroll/${id}/status`, { method: "PATCH", body: { status } }),
  deletePayroll: (id: string) => request<void>(`/employees/payroll/${id}`, { method: "DELETE" }),

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
