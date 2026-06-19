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
  status: string; notes: string | null; created_at: string;
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
  deleteProduct: (id: string) => request<void>(`/products/${id}`, { method: "DELETE" }),

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
  listPayroll: () => request<PayrollRecord[]>("/employees/payroll"),
  createPayroll: (body: unknown) => request<PayrollRecord>("/employees/payroll", { method: "POST", body }),
  updatePayrollStatus: (id: string, status: string) =>
    request<PayrollRecord>(`/employees/payroll/${id}/status`, { method: "PATCH", body: { status } }),
  deletePayroll: (id: string) => request<void>(`/employees/payroll/${id}`, { method: "DELETE" }),

  // Settings
  getCompanySettings: () => request<CompanySettings>("/settings/company"),
  saveCompanySettings: (body: Partial<CompanySettings>) =>
    request<CompanySettings>("/settings/company", { method: "PATCH", body }),
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
