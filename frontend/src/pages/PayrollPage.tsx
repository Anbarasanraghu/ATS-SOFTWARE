import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Search, Filter, Download, Printer, MessageCircle,
  ChevronDown, X, Trash2, CheckCircle, DollarSign, Clock,
  Users, TrendingUp, AlertCircle, BarChart2, FileText,
} from "lucide-react";
import { api, type Employee, type Payroll, type PayrollStats, type LeaveSummary, type CompanySettings } from "../lib/api";

// ── Constants ─────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const EARNINGS: [string, string][] = [
  ["basic","Basic"],["hra","HRA"],["da","DA"],["conveyance","Conveyance"],
  ["medical","Medical"],["special","Special"],["bonus","Bonus"],["overtime","Overtime"],["other","Other"],
];
const DEDUCTIONS: [string, string][] = [
  ["pf","PF"],["esi","ESI"],["pt","Prof. Tax"],["tds","TDS"],["loan","Loan"],["advance","Advance"],
];
const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

const PAYROLL_STATUSES = ["draft","calculated","pending_approval","approved","paid","hold","cancelled"];
const PAYMENT_STATUSES = ["unpaid","payment_pending","paid","hold"];
const PAYMENT_METHODS  = ["cash","upi","bank_transfer","cheque","other"];
const SALARY_TYPES     = ["monthly","daily","hourly"];

const ALLOWANCE_PRESETS = [
  "House Rent Allowance","Travel Allowance","Food Allowance",
  "Medical Allowance","Performance Bonus","Incentive","Other Allowance",
];
const DEDUCTION_PRESETS = [
  "LOP Deduction","Late Deduction","Advance Salary Deduction",
  "Loan Deduction","PF Deduction","ESI Deduction","TDS","Other Deduction",
];

const STATUS_CLS: Record<string, string> = {
  draft:            "bg-zinc-100 text-zinc-600",
  calculated:       "bg-blue-100 text-blue-700",
  pending_approval: "bg-amber-100 text-amber-700",
  approved:         "bg-sky-100 text-sky-700",
  paid:             "bg-emerald-100 text-emerald-700",
  hold:             "bg-orange-100 text-orange-700",
  cancelled:        "bg-red-100 text-red-600",
};
const PAY_STATUS_CLS: Record<string, string> = {
  unpaid:          "bg-zinc-100 text-zinc-600",
  payment_pending: "bg-amber-100 text-amber-700",
  paid:            "bg-emerald-100 text-emerald-700",
  hold:            "bg-orange-100 text-orange-700",
};

// ── Helpers ───────────────────────────────────────────────────

const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN = (n: number) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  return `${MONTHS[Number(mo)-1]} ${y}`;
};
function buildWaPhone(phone: string | null | undefined) {
  if (!phone) return null;
  const d = phone.replace(/\D/g,"");
  if (d.length === 10) return "91"+d;
  if (d.length === 12 && d.startsWith("91")) return d;
  return null;
}

// ── Blank form ────────────────────────────────────────────────

type ARow = { name: string; amount: string };

interface CalcForm {
  employee_id: string;
  payroll_month: string;
  basic_salary: string;
  salary_type: string;
  // Attendance
  total_working_days: string;
  present_days: string;
  absent_days: string;
  late_days: string;
  early_leave_days: string;
  total_worked_hours: string;
  required_working_hours: string;
  // Leave
  paid_leave_days: string;
  sick_leave_days: string;
  casual_leave_days: string;
  unpaid_leave_days: string;
  half_day_leave: string;
  remaining_leave_balance: string;
  // LOP
  lop_days: string;
  lop_reason: string;
  // OT
  normal_ot_hours: string;
  night_ot_hours: string;
  holiday_ot_hours: string;
  normal_ot_multiplier: string;
  night_ot_multiplier: string;
  holiday_ot_multiplier: string;
  // Allowances / Deductions
  allowances: ARow[];
  deductions: ARow[];
  // Payment
  payroll_status: string;
  payment_status: string;
  payment_date: string;
  payment_method: string;
  transaction_id: string;
  payment_notes: string;
}

const blankForm = (): CalcForm => ({
  employee_id: "", payroll_month: currentMonth,
  basic_salary: "", salary_type: "monthly",
  total_working_days: "26", present_days: "0", absent_days: "0",
  late_days: "0", early_leave_days: "0",
  total_worked_hours: "0", required_working_hours: "208",
  paid_leave_days: "0", sick_leave_days: "0", casual_leave_days: "0",
  unpaid_leave_days: "0", half_day_leave: "0", remaining_leave_balance: "0",
  lop_days: "0", lop_reason: "",
  normal_ot_hours: "0", night_ot_hours: "0", holiday_ot_hours: "0",
  normal_ot_multiplier: "1.25", night_ot_multiplier: "1.5", holiday_ot_multiplier: "2.0",
  allowances: [], deductions: [],
  payroll_status: "draft", payment_status: "unpaid",
  payment_date: "", payment_method: "", transaction_id: "", payment_notes: "",
});

function payrollToForm(p: Payroll): CalcForm {
  return {
    employee_id: p.employee_id,
    payroll_month: p.payroll_month,
    basic_salary: String(p.basic_salary),
    salary_type: p.salary_type,
    total_working_days: String(p.total_working_days),
    present_days: String(p.present_days),
    absent_days: String(p.absent_days),
    late_days: String(p.late_days),
    early_leave_days: String(p.early_leave_days),
    total_worked_hours: String(p.total_worked_hours),
    required_working_hours: String(p.required_working_hours),
    paid_leave_days: String(p.paid_leave_days),
    sick_leave_days: String(p.sick_leave_days),
    casual_leave_days: String(p.casual_leave_days),
    unpaid_leave_days: String(p.unpaid_leave_days),
    half_day_leave: String(p.half_day_leave),
    remaining_leave_balance: String(p.remaining_leave_balance),
    lop_days: String(p.lop_days),
    lop_reason: p.lop_reason ?? "",
    normal_ot_hours: String(p.normal_ot_hours),
    night_ot_hours: String(p.night_ot_hours),
    holiday_ot_hours: String(p.holiday_ot_hours),
    normal_ot_multiplier: String(p.normal_ot_multiplier),
    night_ot_multiplier: String(p.night_ot_multiplier),
    holiday_ot_multiplier: String(p.holiday_ot_multiplier),
    allowances: p.allowances.map(a => ({ name: a.allowance_name, amount: String(a.amount) })),
    deductions: p.deductions.map(d => ({ name: d.deduction_name, amount: String(d.amount) })),
    payroll_status: p.payroll_status,
    payment_status: p.payment_status,
    payment_date: p.payment_date ?? "",
    payment_method: p.payment_method ?? "",
    transaction_id: p.transaction_id ?? "",
    payment_notes: p.payment_notes ?? "",
  };
}

// ── Shared UI helpers ─────────────────────────────────────────

const IC = "w-full border border-line rounded-lg px-3 py-2 text-sm bg-paper outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
const IC_SM = "border border-line rounded-lg px-2.5 py-1.5 text-sm bg-paper outline-none focus:border-accent";

function SLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">{children}</p>;
}
function SCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <h4 className="text-sm font-semibold text-ink mb-3 pb-2 border-b border-line">{title}</h4>
      {children}
    </div>
  );
}
function Row2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
function Row3({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-3">{children}</div>;
}
function FRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SLabel>{label}</SLabel>
      {children}
    </div>
  );
}

// ── Stats Card ────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, active, onClick }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
  active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-surface border rounded-xl p-4 flex items-start gap-3 transition-all w-full
        ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "cursor-default"}
        ${active ? "border-accent ring-2 ring-accent/20 shadow-sm" : "border-line hover:border-line/80"}`}
    >
      <div className={`rounded-lg p-2.5 flex-shrink-0 ${color}`}><Icon size={18} /></div>
      <div className="min-w-0">
        <div className="text-lg font-bold text-ink truncate">{value}</div>
        <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
        {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      </div>
    </button>
  );
}

// ── Payslip print component ───────────────────────────────────

function PayslipView({ payroll, company }: { payroll: Payroll; company: CompanySettings | null }) {
  const companyName = company?.company_name || "Company";
  const companyAddr = company?.address || "";
  const companyPhone = company?.phone || "";
  const companyEmail = company?.email || "";
  const companyGst = company?.gst_number || "";
  const companyLogo = company?.company_logo || null;

  return (
    <div className="print-selected bg-white" style={{ width: "210mm", minHeight: "297mm", padding: "15mm", boxSizing: "border-box", fontFamily: "Arial, sans-serif", color: "#111" }}>
      {/* Company Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0F6E56", paddingBottom: "10px", marginBottom: "10px" }}>
        <div>
          {companyLogo && <img src={companyLogo} alt="logo" style={{ maxHeight: "48px", marginBottom: "6px" }} />}
          <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F6E56" }}>{companyName}</div>
          {companyAddr  && <div style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>{companyAddr}</div>}
          {companyPhone && <div style={{ fontSize: "11px", color: "#555" }}>Ph: {companyPhone}</div>}
          {companyEmail && <div style={{ fontSize: "11px", color: "#555" }}>{companyEmail}</div>}
          {companyGst   && <div style={{ fontSize: "10px", color: "#777" }}>GSTIN: {companyGst}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "22px", fontWeight: 900, color: "#0F6E56", letterSpacing: "2px" }}>PAYSLIP</div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", marginTop: "4px" }}>{monthLabel(payroll.payroll_month)}</div>
          <div style={{ marginTop: "6px", display: "inline-block", background: "#d1fae5", color: "#065f46", padding: "2px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700 }}>
            {payroll.payment_status.replace("_"," ").toUpperCase()}
          </div>
        </div>
      </div>

      {/* Employee Details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px", background: "#f9fafb", padding: "10px", borderRadius: "6px", fontSize: "12px" }}>
        {[
          ["Employee ID",   payroll.employee_no || "—"],
          ["Employee Name", payroll.employee_name],
          ["Department",    payroll.department || "—"],
          ["Designation",   payroll.designation || "—"],
          ["Payroll Month", monthLabel(payroll.payroll_month)],
          ["Salary Type",   payroll.salary_type],
        ].map(([k,v]) => (
          <div key={k} style={{ display: "flex", gap: "4px" }}>
            <span style={{ color: "#6b7280", minWidth: "110px" }}>{k}:</span>
            <span style={{ fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Attendance + Leave */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280", marginBottom: "6px" }}>Attendance</div>
          {[
            ["Working Days", payroll.total_working_days],
            ["Present Days", payroll.present_days],
            ["Absent Days",  payroll.absent_days],
            ["Late Days",    payroll.late_days],
            ["LOP Days",     payroll.lop_days],
            ["OT Hours",     `${payroll.normal_ot_hours + payroll.night_ot_hours + payroll.holiday_ot_hours} hrs`],
          ].map(([k,v]) => (
            <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "2px 0", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ color: "#6b7280" }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280", marginBottom: "6px" }}>Leave</div>
          {[
            ["Paid Leave",   payroll.paid_leave_days],
            ["Sick Leave",   payroll.sick_leave_days],
            ["Casual Leave", payroll.casual_leave_days],
            ["Unpaid Leave", payroll.unpaid_leave_days],
            ["Half Day",     payroll.half_day_leave],
            ["Balance",      payroll.remaining_leave_balance],
          ].map(([k,v]) => (
            <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "2px 0", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ color: "#6b7280" }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Earnings + Deductions side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        {/* Earnings */}
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#065f46", background: "#d1fae5", padding: "4px 8px", borderRadius: "4px", marginBottom: "6px" }}>Earnings</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "3px 0", borderBottom: "1px solid #f3f4f6" }}>
            <span>Basic Salary</span><span style={{ fontWeight: 700 }}>₹{fmtN(payroll.basic_salary)}</span>
          </div>
          {payroll.allowances.map(a => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "3px 0", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ color: "#6b7280" }}>{a.allowance_name}</span><span>₹{fmtN(a.amount)}</span>
            </div>
          ))}
          {payroll.total_ot_amount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "3px 0", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ color: "#6b7280" }}>Overtime</span><span>₹{fmtN(payroll.total_ot_amount)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 800, padding: "6px 0 0", marginTop: "4px", borderTop: "2px solid #0F6E56" }}>
            <span>Gross Salary</span><span style={{ color: "#0F6E56" }}>₹{fmtN(payroll.gross_salary)}</span>
          </div>
        </div>

        {/* Deductions */}
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#991b1b", background: "#fee2e2", padding: "4px 8px", borderRadius: "4px", marginBottom: "6px" }}>Deductions</div>
          {payroll.deductions.map(d => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "3px 0", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ color: "#6b7280" }}>{d.deduction_name}</span><span>₹{fmtN(d.amount)}</span>
            </div>
          ))}
          {payroll.deductions.length === 0 && (
            <div style={{ fontSize: "11px", color: "#9ca3af", padding: "4px 0" }}>No deductions</div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 800, padding: "6px 0 0", marginTop: "4px", borderTop: "2px solid #dc2626" }}>
            <span>Total Deductions</span><span style={{ color: "#dc2626" }}>₹{fmtN(payroll.total_deductions)}</span>
          </div>
        </div>
      </div>

      {/* Net Salary Banner */}
      <div style={{ background: "#0F6E56", color: "white", padding: "12px 16px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "13px", opacity: 0.85 }}>NET SALARY</div>
          <div style={{ fontSize: "24px", fontWeight: 900 }}>₹{fmtN(payroll.net_salary)}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: "12px", opacity: 0.9 }}>
          {payroll.payment_status === "paid" && payroll.payment_date && (
            <>
              <div>Paid on {payroll.payment_date}</div>
              <div>via {payroll.payment_method?.replace("_"," ") || "—"}</div>
              {payroll.transaction_id && <div>Ref: {payroll.transaction_id}</div>}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
        <div style={{ fontSize: "11px", color: "#6b7280" }}>
          <div>Thank you for your dedicated service.</div>
          <div style={{ marginTop: "2px" }}>This is a computer-generated payslip.</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ borderBottom: "1px solid #374151", width: "140px", marginBottom: "4px" }}></div>
          <div style={{ fontSize: "11px", color: "#6b7280" }}>Authorized Signature</div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#374151" }}>{companyName}</div>
        </div>
      </div>
    </div>
  );
}

// ── Salary Calculation Modal ──────────────────────────────────

interface SalaryModalProps {
  editPayroll: Payroll | null;
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}

function SalaryModal({ editPayroll, employees, onClose, onSaved }: SalaryModalProps) {
  const [form, setForm] = useState<CalcForm>(() =>
    editPayroll ? payrollToForm(editPayroll) : blankForm()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [loadingLeave, setLoadingLeave] = useState(false);

  const sf = (k: keyof CalcForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Auto-compute derived values
  const computed = useMemo(() => {
    const basic = parseFloat(form.basic_salary) || 0;
    const wdays = parseInt(form.total_working_days) || 26;
    const per_day = basic / wdays;
    const lop_ded = (parseFloat(form.lop_days)||0) * per_day;
    const per_hour = per_day / 8;
    const normal_ot  = (parseFloat(form.normal_ot_hours)||0) * per_hour * (parseFloat(form.normal_ot_multiplier)||1.25);
    const night_ot   = (parseFloat(form.night_ot_hours)||0)  * per_hour * (parseFloat(form.night_ot_multiplier)||1.5);
    const holiday_ot = (parseFloat(form.holiday_ot_hours)||0)* per_hour * (parseFloat(form.holiday_ot_multiplier)||2);
    const total_ot   = normal_ot + night_ot + holiday_ot;
    const total_allw = form.allowances.reduce((s,a) => s + (parseFloat(a.amount)||0), 0);
    const total_ded  = form.deductions.reduce((s,d) => s + (parseFloat(d.amount)||0), 0);
    const gross      = basic + total_allw + total_ot;
    const net        = Math.max(gross - total_ded, 0);
    return { per_day, lop_ded, per_hour, total_ot, total_allw, total_ded, gross, net };
  }, [form]);

  // When employee + month changes, try to fetch leave summary
  async function loadLeave(empId: string, month: string) {
    if (!empId || !month) return;
    setLoadingLeave(true);
    try {
      const ls = await api.getPayrollLeaveSummary(empId, month).catch(() => null);
      if (ls) {
        setForm(f => ({
          ...f,
          paid_leave_days: String(ls.paid_leave_days),
          sick_leave_days: String(ls.sick_leave_days),
          casual_leave_days: String(ls.casual_leave_days),
          unpaid_leave_days: String(ls.unpaid_leave_days),
          half_day_leave: String(ls.half_day_leave),
          remaining_leave_balance: String(ls.remaining_leave_balance),
        }));
      }
    } finally { setLoadingLeave(false); }
  }

  // Auto-fill employee salary when employee selected
  function pickEmployee(id: string) {
    sf("employee_id", id);
    const emp = employees.find(e => e.id === id);
    if (emp?.salary) sf("basic_salary", String(emp.salary));
    void loadLeave(id, form.payroll_month);
  }

  function addAllowance(preset?: string) {
    setForm(f => ({ ...f, allowances: [...f.allowances, { name: preset||"", amount: "0" }] }));
  }
  function removeAllowance(i: number) {
    setForm(f => ({ ...f, allowances: f.allowances.filter((_,idx)=>idx!==i) }));
  }
  function setAllowance(i: number, k: "name"|"amount", v: string) {
    setForm(f => ({ ...f, allowances: f.allowances.map((a,idx)=>idx===i?{...a,[k]:v}:a) }));
  }
  function addDeduction(preset?: string) {
    setForm(f => ({ ...f, deductions: [...f.deductions, { name: preset||"", amount: "0" }] }));
  }
  function removeDeduction(i: number) {
    setForm(f => ({ ...f, deductions: f.deductions.filter((_,idx)=>idx!==i) }));
  }
  function setDeduction(i: number, k: "name"|"amount", v: string) {
    setForm(f => ({ ...f, deductions: f.deductions.map((d,idx)=>idx===i?{...d,[k]:v}:d) }));
  }

  function buildBody(status: string) {
    return {
      employee_id: form.employee_id,
      payroll_month: form.payroll_month,
      basic_salary: parseFloat(form.basic_salary)||0,
      salary_type: form.salary_type,
      total_working_days: parseInt(form.total_working_days)||26,
      present_days: parseFloat(form.present_days)||0,
      absent_days: parseFloat(form.absent_days)||0,
      late_days: parseInt(form.late_days)||0,
      early_leave_days: parseInt(form.early_leave_days)||0,
      total_worked_hours: parseFloat(form.total_worked_hours)||0,
      required_working_hours: parseFloat(form.required_working_hours)||0,
      paid_leave_days: parseFloat(form.paid_leave_days)||0,
      sick_leave_days: parseFloat(form.sick_leave_days)||0,
      casual_leave_days: parseFloat(form.casual_leave_days)||0,
      unpaid_leave_days: parseFloat(form.unpaid_leave_days)||0,
      half_day_leave: parseFloat(form.half_day_leave)||0,
      remaining_leave_balance: parseFloat(form.remaining_leave_balance)||0,
      lop_days: parseFloat(form.lop_days)||0,
      lop_reason: form.lop_reason||null,
      normal_ot_hours: parseFloat(form.normal_ot_hours)||0,
      night_ot_hours: parseFloat(form.night_ot_hours)||0,
      holiday_ot_hours: parseFloat(form.holiday_ot_hours)||0,
      normal_ot_multiplier: parseFloat(form.normal_ot_multiplier)||1.25,
      night_ot_multiplier: parseFloat(form.night_ot_multiplier)||1.5,
      holiday_ot_multiplier: parseFloat(form.holiday_ot_multiplier)||2.0,
      allowances: form.allowances.map(a=>({ allowance_name: a.name, amount: parseFloat(a.amount)||0 })),
      deductions: form.deductions.map(d=>({ deduction_name: d.name, amount: parseFloat(d.amount)||0 })),
      payroll_status: status,
      payment_status: form.payment_status,
      payment_date: form.payment_date||null,
      payment_method: form.payment_method||null,
      transaction_id: form.transaction_id||null,
      payment_notes: form.payment_notes||null,
    };
  }

  async function save(pStatus: string) {
    if (!form.employee_id) { setError("Select an employee"); return; }
    if (!form.payroll_month) { setError("Select payroll month"); return; }
    if (!form.basic_salary || parseFloat(form.basic_salary) < 0) { setError("Basic salary must be ≥ 0"); return; }
    setSaving(true); setError(null);
    try {
      const body = buildBody(pStatus);
      if (editPayroll) await api.updatePayrollEntry(editPayroll.id, body);
      else             await api.createPayrollEntry(body);
      onSaved();
    } catch(err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  }

  const selectedEmp = employees.find(e => e.id === form.employee_id);

  // Auto-fill working days + required hours when month changes
  function handleMonthChange(month: string) {
    const [y, m] = month.split("-").map(Number);
    const calDays = new Date(y, m, 0).getDate();
    setForm(f => ({ ...f, payroll_month: month, total_working_days: String(calDays), required_working_hours: String(calDays * 8) }));
    void loadLeave(form.employee_id, month);
  }

  // Auto-sync LOP deduction into the deductions list whenever LOP amount changes
  useEffect(() => {
    const lopAmt = parseFloat(computed.lop_ded.toFixed(2));
    setForm(f => {
      const others = f.deductions.filter(d => d.name !== "LOP Deduction");
      if (lopAmt > 0) return { ...f, deductions: [{ name: "LOP Deduction", amount: String(lopAmt) }, ...others] };
      return { ...f, deductions: others };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed.lop_ded]);

  // Auto-calculate: derive LOP from unpaid leave + absent, fill required hours
  function autoCalculate() {
    const unpaid  = parseFloat(form.unpaid_leave_days) || 0;
    const absent  = parseFloat(form.absent_days) || 0;
    const wdays   = parseInt(form.total_working_days) || 26;
    setForm(f => ({ ...f, lop_days: String(unpaid + absent), required_working_hours: String(wdays * 8) }));
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-surface border border-line rounded-xl shadow-2xl w-full max-w-5xl my-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h2 className="font-bold text-ink text-base">
              {editPayroll ? "Edit Payroll" : "Calculate Salary"}
              {selectedEmp && ` — ${selectedEmp.full_name}`}
              {form.payroll_month && ` (${monthLabel(form.payroll_month)})`}
            </h2>
            <p className="text-xs text-muted mt-0.5">Fill salary details category by category</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={20}/></button>
        </div>

        {/* Quick action bar */}
        <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-line bg-paper/60">
          <button
            onClick={() => { const emp = employees.find(e => e.id === form.employee_id); if (emp?.salary) sf("basic_salary", String(emp.salary)); }}
            disabled={!form.employee_id}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-line rounded-lg bg-surface hover:bg-line/40 text-ink disabled:opacity-40">
            <Users size={13}/> Load Employee Data
          </button>
          <button
            onClick={() => void loadLeave(form.employee_id, form.payroll_month)}
            disabled={!form.employee_id || loadingLeave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-line rounded-lg bg-surface hover:bg-line/40 text-ink disabled:opacity-40">
            <Clock size={13}/> {loadingLeave ? "Loading…" : "Load Attendance & Leave"}
          </button>
          <button
            onClick={autoCalculate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-accent/40 rounded-lg bg-accent/5 hover:bg-accent/10 text-accent">
            <TrendingUp size={13}/> Auto Calculate
          </button>
          <button
            onClick={() => setForm(blankForm())}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-line rounded-lg bg-surface hover:bg-line/40 text-muted">
            <X size={13}/> Reset
          </button>
        </div>

        {/* 2-column category grid */}
        <div className="p-5 overflow-y-auto max-h-[72vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* ── Employee & Salary ── */}
            <SCard title="Employee & Salary">
              <div className="space-y-3">
                <FRow label="Employee *">
                  <select className={IC} value={form.employee_id}
                    onChange={e => pickEmployee(e.target.value)} disabled={!!editPayroll}>
                    <option value="">— Select employee —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}{e.department ? ` (${e.department})` : ""}</option>)}
                  </select>
                </FRow>
                <FRow label="Payroll Month *">
                  <input type="month" className={IC} value={form.payroll_month}
                    onChange={e => handleMonthChange(e.target.value)} disabled={!!editPayroll}/>
                </FRow>
                <FRow label="Basic Salary (₹) *">
                  <input type="number" min="0" step="0.01" className={IC} value={form.basic_salary}
                    onChange={e => sf("basic_salary", e.target.value)}/>
                </FRow>
                <FRow label="Salary Type">
                  <select className={IC} value={form.salary_type} onChange={e => sf("salary_type", e.target.value)}>
                    {SALARY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FRow>
                {selectedEmp && (
                  <div className="text-xs text-muted bg-paper border border-line rounded-lg px-3 py-2">
                    <span className="font-medium text-ink">{selectedEmp.department || "—"}</span>
                    {selectedEmp.designation && <span> · {selectedEmp.designation}</span>}
                    {selectedEmp.hire_date && <span className="ml-2 text-muted">Joined {selectedEmp.hire_date}</span>}
                  </div>
                )}
              </div>
            </SCard>

            {/* ── Attendance ── */}
            <SCard title="Attendance">
              <div className="grid grid-cols-2 gap-3">
                <FRow label="Working Days">
                  <input type="number" min="0" className={IC} value={form.total_working_days}
                    onChange={e => sf("total_working_days", e.target.value)}/>
                </FRow>
                <FRow label="Present Days">
                  <input type="number" min="0" step="0.5" className={IC} value={form.present_days}
                    onChange={e => sf("present_days", e.target.value)}/>
                </FRow>
                <FRow label="Absent Days">
                  <input type="number" min="0" step="0.5" className={IC} value={form.absent_days}
                    onChange={e => sf("absent_days", e.target.value)}/>
                </FRow>
                <FRow label="Late Days">
                  <input type="number" min="0" className={IC} value={form.late_days}
                    onChange={e => sf("late_days", e.target.value)}/>
                </FRow>
                <FRow label="Worked Hours">
                  <input type="number" min="0" step="0.5" className={IC} value={form.total_worked_hours}
                    onChange={e => sf("total_worked_hours", e.target.value)}/>
                </FRow>
                <FRow label="Required Hours">
                  <input type="number" min="0" className={IC} value={form.required_working_hours}
                    onChange={e => sf("required_working_hours", e.target.value)}/>
                </FRow>
              </div>
            </SCard>

            {/* ── Leave & LOP ── */}
            <SCard title={`Leave & LOP${loadingLeave ? " (loading…)" : ""}`}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FRow label="Paid Leave">
                    <input type="number" min="0" step="0.5" className={IC} value={form.paid_leave_days}
                      onChange={e => sf("paid_leave_days", e.target.value)}/>
                  </FRow>
                  <FRow label="Sick Leave">
                    <input type="number" min="0" step="0.5" className={IC} value={form.sick_leave_days}
                      onChange={e => sf("sick_leave_days", e.target.value)}/>
                  </FRow>
                  <FRow label="Casual Leave">
                    <input type="number" min="0" step="0.5" className={IC} value={form.casual_leave_days}
                      onChange={e => sf("casual_leave_days", e.target.value)}/>
                  </FRow>
                  <FRow label="Unpaid Leave">
                    <input type="number" min="0" step="0.5" className={IC} value={form.unpaid_leave_days}
                      onChange={e => sf("unpaid_leave_days", e.target.value)}/>
                  </FRow>
                  <FRow label="Half Day">
                    <input type="number" min="0" step="0.5" className={IC} value={form.half_day_leave}
                      onChange={e => sf("half_day_leave", e.target.value)}/>
                  </FRow>
                  <FRow label="Leave Balance">
                    <input type="number" min="0" step="0.5" className={IC} value={form.remaining_leave_balance}
                      onChange={e => sf("remaining_leave_balance", e.target.value)}/>
                  </FRow>
                </div>
                <div className="border-t border-line/50 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FRow label="LOP Days">
                      <input type="number" min="0" step="0.5" className={IC} value={form.lop_days}
                        onChange={e => sf("lop_days", e.target.value)}/>
                    </FRow>
                    <FRow label="Per Day Salary">
                      <div className="border border-line rounded-lg px-3 py-2 text-sm bg-line/20 font-mono text-ink">
                        ₹{computed.per_day.toFixed(2)}
                      </div>
                    </FRow>
                  </div>
                  {computed.lop_ded > 0 && (
                    <div className="flex justify-between items-center bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                      <span className="text-red-700 font-medium">LOP Deduction (auto-added)</span>
                      <span className="font-mono font-bold text-red-700">₹{computed.lop_ded.toFixed(2)}</span>
                    </div>
                  )}
                  <FRow label="LOP Reason">
                    <input className={IC} value={form.lop_reason}
                      onChange={e => sf("lop_reason", e.target.value)} placeholder="Reason (optional)"/>
                  </FRow>
                </div>
              </div>
            </SCard>

            {/* ── Overtime ── */}
            <SCard title="Overtime">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FRow label="Normal OT Hours">
                    <input type="number" min="0" step="0.5" className={IC} value={form.normal_ot_hours}
                      onChange={e => sf("normal_ot_hours", e.target.value)}/>
                  </FRow>
                  <FRow label="Normal Multiplier">
                    <input type="number" min="1" step="0.25" className={IC} value={form.normal_ot_multiplier}
                      onChange={e => sf("normal_ot_multiplier", e.target.value)}/>
                  </FRow>
                  <FRow label="Night OT Hours">
                    <input type="number" min="0" step="0.5" className={IC} value={form.night_ot_hours}
                      onChange={e => sf("night_ot_hours", e.target.value)}/>
                  </FRow>
                  <FRow label="Night Multiplier">
                    <input type="number" min="1" step="0.25" className={IC} value={form.night_ot_multiplier}
                      onChange={e => sf("night_ot_multiplier", e.target.value)}/>
                  </FRow>
                  <FRow label="Holiday OT Hours">
                    <input type="number" min="0" step="0.5" className={IC} value={form.holiday_ot_hours}
                      onChange={e => sf("holiday_ot_hours", e.target.value)}/>
                  </FRow>
                  <FRow label="Holiday Multiplier">
                    <input type="number" min="1" step="0.25" className={IC} value={form.holiday_ot_multiplier}
                      onChange={e => sf("holiday_ot_multiplier", e.target.value)}/>
                  </FRow>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-line/50 pt-3">
                  <div className="bg-paper border border-line rounded-lg px-3 py-2 text-sm">
                    <p className="text-xs text-muted mb-0.5">Per Hour Salary</p>
                    <p className="font-mono font-semibold text-ink">₹{computed.per_hour.toFixed(2)}</p>
                  </div>
                  <div className={`border rounded-lg px-3 py-2 text-sm ${computed.total_ot > 0 ? "bg-blue-50 border-blue-200" : "bg-paper border-line"}`}>
                    <p className="text-xs text-muted mb-0.5">Total OT Amount</p>
                    <p className={`font-mono font-semibold ${computed.total_ot > 0 ? "text-blue-700" : "text-ink"}`}>₹{computed.total_ot.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </SCard>

            {/* ── Allowances ── */}
            <SCard title="Allowances">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "House Rent", name: "House Rent Allowance" },
                    { label: "Travel",     name: "Travel Allowance" },
                    { label: "Food",       name: "Food Allowance" },
                    { label: "Medical",    name: "Medical Allowance" },
                    { label: "Bonus",      name: "Performance Bonus" },
                    { label: "Other",      name: "Other Allowance" },
                  ].map(p => (
                    <button key={p.label} onClick={() => addAllowance(p.name)}
                      className="px-2.5 py-1 text-xs border border-dashed border-emerald-300 rounded-md text-emerald-700 hover:bg-emerald-50">
                      + {p.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {form.allowances.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className={`${IC_SM} flex-1 min-w-0`} placeholder="Allowance name" value={a.name}
                        onChange={e => setAllowance(i, "name", e.target.value)}/>
                      <div className="relative flex-shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm">₹</span>
                        <input type="number" min="0" step="0.01" className={`${IC_SM} pl-6 w-24`}
                          value={a.amount} onChange={e => setAllowance(i, "amount", e.target.value)}/>
                      </div>
                      <button onClick={() => removeAllowance(i)} className="text-muted hover:text-danger flex-shrink-0">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => addAllowance()}
                  className="flex items-center gap-1 text-xs text-muted hover:text-ink border border-dashed border-line rounded-lg px-3 py-1.5 w-full justify-center">
                  <Plus size={12}/> Add Allowance
                </button>
                {form.allowances.length > 0 && (
                  <div className="flex justify-between text-sm font-semibold text-emerald-700 border-t border-line/50 pt-2">
                    <span>Total Allowances</span>
                    <span className="font-mono">₹{computed.total_allw.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </SCard>

            {/* ── Deductions ── */}
            <SCard title="Deductions">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Late",    name: "Late Deduction" },
                    { label: "Advance", name: "Advance Salary Deduction" },
                    { label: "Loan",    name: "Loan Deduction" },
                    { label: "PF",      name: "PF Deduction" },
                    { label: "ESI",     name: "ESI Deduction" },
                    { label: "TDS",     name: "TDS" },
                    { label: "Other",   name: "Other Deduction" },
                  ].map(p => (
                    <button key={p.label} onClick={() => addDeduction(p.name)}
                      className="px-2.5 py-1 text-xs border border-dashed border-red-300 rounded-md text-red-600 hover:bg-red-50">
                      + {p.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {form.deductions.map((d, i) => (
                    <div key={i} className={`flex items-center gap-2 ${d.name === "LOP Deduction" ? "bg-red-50 rounded-lg px-1.5 py-0.5" : ""}`}>
                      <input className={`${IC_SM} flex-1 min-w-0`} placeholder="Deduction name" value={d.name}
                        onChange={e => setDeduction(i, "name", e.target.value)}/>
                      <div className="relative flex-shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm">₹</span>
                        <input type="number" min="0" step="0.01" className={`${IC_SM} pl-6 w-24`}
                          value={d.amount} onChange={e => setDeduction(i, "amount", e.target.value)}/>
                      </div>
                      <button onClick={() => removeDeduction(i)} className="text-muted hover:text-danger flex-shrink-0">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => addDeduction()}
                  className="flex items-center gap-1 text-xs text-muted hover:text-ink border border-dashed border-line rounded-lg px-3 py-1.5 w-full justify-center">
                  <Plus size={12}/> Add Deduction
                </button>
                {form.deductions.length > 0 && (
                  <div className="flex justify-between text-sm font-semibold text-danger border-t border-line/50 pt-2">
                    <span>Total Deductions</span>
                    <span className="font-mono">₹{computed.total_ded.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </SCard>

            {/* ── Salary Summary ── */}
            <SCard title="Salary Summary">
              <div className="space-y-1.5 text-sm">
                {[
                  { label: "Basic Salary",    val: parseFloat(form.basic_salary)||0, cls: "text-ink" },
                  { label: "+ Allowances",     val: computed.total_allw,               cls: "text-emerald-700" },
                  { label: "+ Overtime",       val: computed.total_ot,                 cls: "text-blue-700" },
                  { label: "= Gross Salary",   val: computed.gross,                    cls: "font-bold text-ink" },
                  { label: "− Deductions",     val: computed.total_ded,                cls: "text-danger" },
                ].map(row => (
                  <div key={row.label} className={`flex justify-between py-1.5 border-b border-line/40 ${row.cls}`}>
                    <span className={row.cls.includes("font-bold") || row.cls.includes("text-") ? "" : "text-muted"}>{row.label}</span>
                    <span className={`font-mono ${row.cls}`}>₹{row.val.toFixed(2)}</span>
                  </div>
                ))}
                <div className="mt-3 bg-accent rounded-xl px-4 py-3.5 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-white/70 uppercase tracking-wide font-medium">Net Salary</p>
                    <p className="text-2xl font-black text-white font-mono">₹{fmtN(computed.net)}</p>
                  </div>
                  <div className="text-right text-xs text-white/70 space-y-0.5">
                    {form.payroll_month && <p>{monthLabel(form.payroll_month)}</p>}
                    {selectedEmp && <p className="font-medium text-white/90">{selectedEmp.full_name}</p>}
                  </div>
                </div>
              </div>
            </SCard>

            {/* ── Payment Details ── */}
            <SCard title="Payment Details">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FRow label="Payroll Status">
                    <select className={IC} value={form.payroll_status} onChange={e => sf("payroll_status", e.target.value)}>
                      {PAYROLL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                    </select>
                  </FRow>
                  <FRow label="Payment Status">
                    <select className={IC} value={form.payment_status} onChange={e => sf("payment_status", e.target.value)}>
                      {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
                    </select>
                  </FRow>
                  <FRow label="Payment Date">
                    <input type="date" className={IC} value={form.payment_date}
                      onChange={e => sf("payment_date", e.target.value)}/>
                  </FRow>
                  <FRow label="Payment Method">
                    <select className={IC} value={form.payment_method} onChange={e => sf("payment_method", e.target.value)}>
                      <option value="">— None —</option>
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g," ")}</option>)}
                    </select>
                  </FRow>
                </div>
                <FRow label="Transaction ID / Reference">
                  <input className={IC} value={form.transaction_id}
                    onChange={e => sf("transaction_id", e.target.value)} placeholder="UTR / Ref No."/>
                </FRow>
                <FRow label="Payment Notes">
                  <input className={IC} value={form.payment_notes}
                    onChange={e => sf("payment_notes", e.target.value)} placeholder="Optional notes"/>
                </FRow>
              </div>
            </SCard>

          </div>{/* end grid */}

          {error && <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4">{error}</p>}
        </div>

        {/* Sticky footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-line bg-surface">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-line rounded-lg hover:bg-line/40">Cancel</button>
          <div className="flex gap-2">
            <button onClick={() => save("draft")} disabled={saving}
              className="px-4 py-2 text-sm border border-line rounded-lg hover:bg-line/40 disabled:opacity-60">
              Save as Draft
            </button>
            <button onClick={() => save("calculated")} disabled={saving}
              className="px-4 py-2 text-sm border border-accent text-accent rounded-lg hover:bg-accent/5 disabled:opacity-60">
              Save Calculation
            </button>
            <button onClick={() => { sf("payment_status","paid"); void save("paid"); }} disabled={saving}
              className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-60">
              {saving ? "Saving…" : "Save & Mark as Paid"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main PayrollPage ──────────────────────────────────────────

export default function PayrollPage() {
  const [payrolls, setPayrolls]     = useState<Payroll[]>([]);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [stats, setStats]           = useState<PayrollStats | null>(null);
  const [company, setCompany]       = useState<CompanySettings | null>(null);
  const [loading, setLoading]       = useState(false);

  // Filters
  const [selMonth, setSelMonth]     = useState(currentMonth);
  const [selDept, setSelDept]       = useState("");
  const [selStatus, setSelStatus]   = useState("");
  const [search, setSearch]         = useState("");

  // Modal state
  const [showCalc, setShowCalc]     = useState(false);
  const [editPayroll, setEditPayroll] = useState<Payroll | null>(null);
  const [showPayslip, setShowPayslip] = useState<Payroll | null>(null);

  const departments = useMemo(() =>
    [...new Set(employees.map(e => e.department).filter(Boolean) as string[])].sort(),
    [employees]
  );

  const _companyLoaded = useRef(false);

  // Load company settings once on mount — uses cache after first call
  useEffect(() => {
    if (_companyLoaded.current) return;
    _companyLoaded.current = true;
    api.getCompanySettings().then(setCompany).catch(() => null);
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const [pr, emps, st] = await Promise.all([
        api.listPayrolls(selMonth, selStatus||undefined, selDept||undefined).catch(() => [] as Payroll[]),
        api.listEmployees().catch(() => [] as Employee[]),
        api.getPayrollStats(selMonth).catch(() => null),
      ]);
      setPayrolls(pr);
      setEmployees(emps);
      if (st) setStats(st);
    } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [selMonth, selStatus, selDept]);

  const filtered = useMemo(() => {
    if (!search.trim()) return payrolls;
    const q = search.toLowerCase();
    return payrolls.filter(p =>
      p.employee_name.toLowerCase().includes(q) ||
      (p.employee_no || "").toLowerCase().includes(q) ||
      (p.department   || "").toLowerCase().includes(q)
    );
  }, [payrolls, search]);

  async function quickStatus(id: string, payroll_status?: string, payment_status?: string) {
    try {
      const body: Record<string, string> = {};
      if (payroll_status)  body.payroll_status  = payroll_status;
      if (payment_status)  body.payment_status  = payment_status;
      if (payment_status === "paid") body.payment_date = new Date().toISOString().slice(0,10);
      await api.patchPayrollStatus(id, body);
      await refresh();
    } catch(err) { alert(err instanceof Error ? err.message : "Failed"); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this payroll record?")) return;
    try { await api.deletePayrollEntry(id); await refresh(); }
    catch(err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  function handleWhatsApp(p: Payroll) {
    const wa = buildWaPhone(p.phone);
    if (!wa) { alert("Employee WhatsApp number not found."); return; }
    const msg = `Hi ${p.employee_name},\n\nYour salary for ${monthLabel(p.payroll_month)} has been processed.\n\nNet Salary: ₹${fmtN(p.net_salary)}\nPayment Status: ${p.payment_status.replace("_"," ")}\nPayment Date: ${p.payment_date || "—"}\n\nPlease check your payslip for details.`;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  }

  function handlePrintPayslip() {
    const el = document.getElementById("__psize__");
    if (el) el.remove();
    const style = document.createElement("style");
    style.id = "__psize__";
    style.textContent = `@page{size:A4 portrait;margin:0;}@media print{body *{visibility:hidden!important}.print-selected,.print-selected *{visibility:visible!important}.print-selected{position:fixed!important;left:0!important;top:0!important;width:100%!important;}.no-print{display:none!important;}}`;
    document.head.appendChild(style);
    setTimeout(() => { window.print(); setTimeout(() => style.remove(), 3000); }, 150);
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Payroll</h1>
          <p className="text-sm text-muted mt-0.5">
            Manage employee salary, attendance, leave, deductions, overtime, payslips, and payments.
          </p>
        </div>
        <button onClick={() => { setEditPayroll(null); setShowCalc(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90">
          <Plus size={16}/> Add Payroll
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 border border-line rounded-lg px-3 py-2 bg-surface">
          <Filter size={14} className="text-muted"/>
          <input type="month" className="text-sm bg-transparent outline-none text-ink"
            value={selMonth} onChange={e => setSelMonth(e.target.value)}/>
        </div>
        <select className="border border-line rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-accent"
          value={selDept} onChange={e => setSelDept(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="border border-line rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-accent"
          value={selStatus} onChange={e => setSelStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {PAYROLL_STATUSES.map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
        </select>
        <div className="flex items-center gap-1.5 border border-line rounded-lg px-3 py-2 bg-surface flex-1 min-w-[180px]">
          <Search size={14} className="text-muted flex-shrink-0"/>
          <input placeholder="Search employee…" className="text-sm bg-transparent outline-none w-full"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Employees" value={String(stats?.total_employees ?? 0)}
          sub={monthLabel(selMonth)} icon={Users} color="bg-blue-100 text-blue-700"
          active={selStatus === ""} onClick={() => setSelStatus("")}/>
        <StatCard label="Total Payroll" value={stats ? `₹${fmtN(stats.total_payroll)}` : "—"}
          icon={DollarSign} color="bg-emerald-100 text-emerald-700"/>
        <StatCard label="Paid Employees" value={String(stats?.paid_count ?? 0)}
          icon={CheckCircle} color="bg-green-100 text-green-700"
          active={selStatus === "paid"} onClick={() => setSelStatus("paid")}/>
        <StatCard label="Pending Payments" value={String(stats?.pending_count ?? 0)}
          icon={Clock} color="bg-amber-100 text-amber-700"
          active={selStatus === "pending_approval"} onClick={() => setSelStatus("pending_approval")}/>
        <StatCard label="Total Deductions" value={stats ? `₹${fmtN(stats.total_deductions)}` : "—"}
          icon={AlertCircle} color="bg-red-100 text-red-600"/>
        <StatCard label="Overtime Amount" value={stats ? `₹${fmtN(stats.total_ot_amount)}` : "—"}
          icon={TrendingUp} color="bg-purple-100 text-purple-700"/>
      </div>

      {/* Table */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">
            {monthLabel(selMonth)} Payroll
            {filtered.length > 0 && <span className="ml-1.5 text-xs text-muted font-normal">({filtered.length} records)</span>}
          </span>
          {loading && <span className="text-xs text-muted">Loading…</span>}
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-muted text-sm">
            <BarChart2 size={32} className="mx-auto mb-2 opacity-30"/>
            <p>No payroll records for {monthLabel(selMonth)}.</p>
            <button onClick={() => { setEditPayroll(null); setShowCalc(true); }}
              className="mt-3 px-4 py-2 bg-accent text-white rounded-lg text-xs font-medium">
              <Plus size={14} className="inline -mt-0.5 mr-1"/> Add First Payroll
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 whitespace-nowrap">Employee</th>
                  <th className="px-3 py-3">Dept</th>
                  <th className="px-3 py-3 text-center">Work</th>
                  <th className="px-3 py-3 text-center">Present</th>
                  <th className="px-3 py-3 text-center">LOP</th>
                  <th className="px-3 py-3 text-center">OT hrs</th>
                  <th className="px-3 py-3 text-right">Basic</th>
                  <th className="px-3 py-3 text-right">Gross</th>
                  <th className="px-3 py-3 text-right">Deductions</th>
                  <th className="px-3 py-3 text-right font-semibold">Net</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-ink">{p.employee_name}</div>
                      <div className="text-xs text-muted">{p.employee_no || "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-muted text-xs">{p.department || "—"}</td>
                    <td className="px-3 py-3 text-center text-muted">{p.total_working_days}</td>
                    <td className="px-3 py-3 text-center">{p.present_days}</td>
                    <td className="px-3 py-3 text-center">
                      {p.lop_days > 0
                        ? <span className="text-red-600 font-medium">{p.lop_days}</span>
                        : <span className="text-muted">0</span>}
                    </td>
                    <td className="px-3 py-3 text-center text-muted">
                      {p.normal_ot_hours + p.night_ot_hours + p.holiday_ot_hours || "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-muted">₹{fmtN(p.basic_salary)}</td>
                    <td className="px-3 py-3 text-right font-mono">₹{fmtN(p.gross_salary)}</td>
                    <td className="px-3 py-3 text-right font-mono text-danger text-xs">
                      {p.total_deductions > 0 ? `-₹${fmtN(p.total_deductions)}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-ink">₹{fmtN(p.net_salary)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_CLS[p.payroll_status]}`}>
                        {p.payroll_status.replace("_"," ")}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${PAY_STATUS_CLS[p.payment_status]}`}>
                        {p.payment_status.replace("_"," ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {/* View Payslip */}
                        <button onClick={() => setShowPayslip(p)} title="View Payslip"
                          className="p-1.5 rounded hover:bg-line text-muted hover:text-accent">
                          <FileText size={14}/>
                        </button>
                        {/* Edit */}
                        {p.payroll_status !== "paid" && (
                          <button onClick={() => { setEditPayroll(p); setShowCalc(true); }} title="Edit"
                            className="p-1.5 rounded hover:bg-line text-muted hover:text-ink">
                            <BarChart2 size={14}/>
                          </button>
                        )}
                        {/* Approve */}
                        {p.payroll_status === "calculated" && (
                          <button onClick={() => quickStatus(p.id,"approved")} title="Approve"
                            className="p-1.5 rounded hover:bg-line text-muted hover:text-sky-600">
                            <CheckCircle size={14}/>
                          </button>
                        )}
                        {/* Mark as Paid */}
                        {p.payroll_status === "approved" && p.payment_status !== "paid" && (
                          <button onClick={() => quickStatus(p.id,"paid","paid")} title="Mark as Paid"
                            className="p-1.5 rounded hover:bg-line text-muted hover:text-emerald-600">
                            <DollarSign size={14}/>
                          </button>
                        )}
                        {/* WhatsApp */}
                        <button onClick={() => handleWhatsApp(p)} title="WhatsApp"
                          className="p-1.5 rounded hover:bg-line text-muted hover:text-green-600">
                          <MessageCircle size={14}/>
                        </button>
                        {/* Delete */}
                        {p.payroll_status !== "paid" && (
                          <button onClick={() => remove(p.id)} title="Delete"
                            className="p-1.5 rounded hover:bg-line text-muted hover:text-danger">
                            <Trash2 size={14}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reports Section */}
      <div className="bg-surface border border-line rounded-xl p-5">
        <h3 className="text-sm font-semibold text-ink mb-4">Payroll Reports</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {[
            "Monthly Payroll Report","Employee Salary Report","Department Payroll Report",
            "Paid Salary Report","Pending Salary Report","Deduction Report",
            "Allowance Report","Overtime Report","Payslip Report",
          ].map(r => (
            <div key={r} className="flex items-center gap-2.5 p-3 border border-line rounded-lg hover:bg-paper/60 cursor-default">
              <FileText size={14} className="text-accent flex-shrink-0"/>
              <span className="text-xs font-medium text-ink">{r}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const headers = ["Employee","Department","Month","Basic","Gross","Deductions","Net","Payroll Status","Payment Status"];
              const rows = filtered.map(p => [
                p.employee_name, p.department||"", p.payroll_month,
                p.basic_salary, p.gross_salary, p.total_deductions, p.net_salary,
                p.payroll_status, p.payment_status,
              ]);
              const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              a.download = `Payroll-${selMonth}.csv`;
              a.click();
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-accent text-accent rounded-lg hover:bg-accent/5">
            <Download size={14}/> Export Excel (CSV)
          </button>
          <button
            onClick={() => {
              if (filtered.length === 0) return;
              window.print();
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-line rounded-lg text-muted hover:text-ink hover:bg-line/40">
            <Printer size={14}/> Print Report
          </button>
        </div>
      </div>

      {/* Salary Calculation Modal */}
      {showCalc && (
        <SalaryModal
          editPayroll={editPayroll}
          employees={employees}
          onClose={() => { setShowCalc(false); setEditPayroll(null); }}
          onSaved={() => { setShowCalc(false); setEditPayroll(null); void refresh(); }}
        />
      )}

      {/* Payslip Modal */}
      {showPayslip && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4">
            {/* Payslip actions (no-print) */}
            <div className="no-print flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-800">
                Payslip — {showPayslip.employee_name} — {monthLabel(showPayslip.payroll_month)}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => handleWhatsApp(showPayslip)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <MessageCircle size={14}/> WhatsApp
                </button>
                <button onClick={handlePrintPayslip}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-accent text-accent rounded-lg hover:bg-accent/5">
                  <Printer size={14}/> Print / Download PDF
                </button>
                <button onClick={() => setShowPayslip(null)} className="text-gray-400 hover:text-gray-700 ml-1">
                  <X size={20}/>
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[85vh]">
              <PayslipView payroll={showPayslip} company={company}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
