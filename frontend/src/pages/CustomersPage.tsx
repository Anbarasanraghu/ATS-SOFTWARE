import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Plus, PhoneCall, CheckCircle2, XCircle, PenLine, Trash2,
  Eye, CalendarPlus, Filter, RotateCcw, Users, Calendar, AlertCircle,
  TrendingUp, Clock, X, BarChart3, Tag, Upload, Download,
  FileText, Banknote, ChevronDown, ChevronUp, ChevronsUpDown,
  MoreVertical,
} from "lucide-react";

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}
import {
  api, type Customer, type CustomerFollowup, type PaymentFollowupReportRow,
  CRM_STATUSES, PRIORITIES, SERVICES, PAYMENT_STATUSES,
} from "../lib/api";
import AddCustomerModal from "./customers/AddCustomerModal";
import AddFollowUpModal from "./customers/AddFollowUpModal";
import CustomerDrawer from "./customers/CustomerDrawer";
import AddPaymentFollowupModal from "./customers/AddPaymentFollowupModal";
import ImportCustomersModal from "./customers/ImportCustomersModal";
import WhatsAppMessageModal from "./customers/WhatsAppMessageModal";

// ── Helpers ───────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }

function isMissed(c: Customer) {
  if (!c.next_followup_date) return false;
  if (["converted", "lost", "not_interested"].includes(c.crm_status)) return false;
  return c.next_followup_date < today();
}

function StatusBadge({ value }: { value: string }) {
  const s = CRM_STATUSES.find(x => x.value === value);
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${s?.cls ?? "bg-zinc-100 text-zinc-500"}`}>
      {s?.label ?? value}
    </span>
  );
}

function PriorityBadge({ value }: { value: string }) {
  const p = PRIORITIES.find(x => x.value === value);
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p?.cls ?? "bg-zinc-100 text-zinc-500"}`}>
      {p?.label ?? value}
    </span>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return <span className="text-muted">—</span>;
  const dt = new Date(d);
  const t = today();
  if (d === t) return <span className="text-accent font-medium">Today</span>;
  if (d < t) return <span className="text-danger">{dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>;
  return <span>{dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</span>;
}

const TAG_COLORS = [
  "bg-blue-100 text-blue-700", "bg-green-100 text-green-700",
  "bg-orange-100 text-orange-700", "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700", "bg-teal-100 text-teal-700",
];

// ── Stats Card ────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, accent, onClick, active,
}: {
  label: string; value: number; icon: React.ElementType;
  accent: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-surface border rounded-xl p-5 flex items-center gap-4 transition-all ${
        active ? "border-accent ring-2 ring-accent/20 shadow-sm" : "border-line hover:border-accent/40 hover:shadow-sm"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}>
      <div className={`rounded-xl p-3 flex-shrink-0 ${accent}`}><Icon size={20} /></div>
      <div className="min-w-0">
        <p className="text-3xl font-bold text-ink leading-none">{value}</p>
        <p className="text-xs text-muted mt-1.5 leading-tight">{label}</p>
      </div>
    </button>
  );
}

// ── Pipeline View ─────────────────────────────────────────────

const PIPELINE_STAGES = [
  { value: "new_lead",          label: "New Lead",  cls: "bg-blue-500" },
  { value: "contacted",         label: "Contacted", cls: "bg-purple-500" },
  { value: "interested",        label: "Interested",cls: "bg-green-500" },
  { value: "demo_scheduled",    label: "Demo",      cls: "bg-teal-500" },
  { value: "quotation_sent",    label: "Quotation", cls: "bg-indigo-500" },
  { value: "follow_up_pending", label: "Follow-up", cls: "bg-orange-500" },
  { value: "converted",         label: "Converted", cls: "bg-emerald-600" },
];
const TERMINAL_STAGES = [
  { value: "lost",           label: "Lost",           cls: "bg-red-400" },
  { value: "not_interested", label: "Not Interested", cls: "bg-zinc-400" },
];

function PipelineView({ customers }: { customers: Customer[] }) {
  const counts = Object.fromEntries(CRM_STATUSES.map(s => [s.value, customers.filter(c => c.crm_status === s.value).length]));
  const maxCount = Math.max(...PIPELINE_STAGES.map(s => counts[s.value] ?? 0), 1);
  return (
    <div className="bg-surface border border-line rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <BarChart3 size={15} className="text-accent" /> Sales Pipeline
        </h3>
        <span className="text-xs text-muted">Conversion rate: <strong className="text-ink">
          {customers.length > 0 ? Math.round(((counts["converted"] ?? 0) / customers.length) * 100) : 0}%
        </strong></span>
      </div>
      <div className="flex items-end gap-3 mb-2">
        {PIPELINE_STAGES.map(stage => {
          const count = counts[stage.value] ?? 0;
          const height = count === 0 ? 6 : Math.max(20, (count / maxCount) * 88);
          return (
            <div key={stage.value} className="flex flex-col items-center gap-1.5 flex-1">
              <span className="text-sm font-bold text-ink">{count > 0 ? count : ""}</span>
              <div className={`w-full rounded-t-md ${stage.cls} ${count === 0 ? "opacity-15" : "opacity-80"}`} style={{ height: `${height}px` }} />
              <span className="text-[11px] text-muted text-center leading-tight">{stage.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-5 pt-3 border-t border-line mt-1">
        {TERMINAL_STAGES.map(stage => (
          <div key={stage.value} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${stage.cls}`} />
            <span className="text-xs text-muted">{stage.label}: <strong className="text-ink">{counts[stage.value] ?? 0}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Export helpers ────────────────────────────────────────────

function exportCustomers(customers: Customer[]) {
  const data = customers.map(c => ({
    "Customer Name": c.name, "Company": c.company ?? "", "Phone": c.phone ?? "", "Email": c.email ?? "",
    "CRM Status": CRM_STATUSES.find(s => s.value === c.crm_status)?.label ?? c.crm_status,
    "Priority": PRIORITIES.find(p => p.value === c.priority)?.label ?? c.priority,
    "Assigned Staff": c.assigned_staff ?? "", "Source": c.source ?? "",
    "Interested Service": c.interested_service ?? "", "Tags": (c.tags ?? []).join(", "),
    "Payment Status": c.payment_status ?? "",
    "Next Follow-up Date": c.next_followup_date ?? "", "Last Follow-up Date": c.last_followup_date ?? "",
    "Address": c.address ?? "", "Notes": c.notes ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [22,18,14,26,18,10,16,14,24,20,18,16,16,30,40].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customers");
  XLSX.writeFile(wb, `customers_${new Date().toISOString().slice(0,10)}.xlsx`);
}

async function exportFollowupReport(setExporting: (v: boolean) => void) {
  setExporting(true);
  try {
    const report = await api.followupsReport();
    if (report.length === 0) { alert("No follow-up records found."); return; }
    const data = report.map(r => ({
      "Customer Name": r.customer_name, "Phone": r.customer_phone ?? "", "Assigned Staff": r.assigned_staff ?? "",
      "Follow-up Mode": r.followup_mode.charAt(0).toUpperCase() + r.followup_mode.slice(1),
      "Follow-up Status": CRM_STATUSES.find(s => s.value === r.followup_status)?.label ?? r.followup_status,
      "Notes": r.notes ?? "", "Next Follow-up Date": r.next_followup_date ?? "",
      "Created Date": r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [22,14,18,16,20,44,18,14].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Follow-up Report");
    XLSX.writeFile(wb, `followup_report_${new Date().toISOString().slice(0,10)}.xlsx`);
  } catch (err) {
    alert(err instanceof Error ? err.message : "Export failed");
  } finally { setExporting(false); }
}

// ── Export Dropdown ───────────────────────────────────────────

function ExportDropdown({ filtered, exportingReport, setExportingReport }: {
  filtered: Customer[]; exportingReport: boolean; setExportingReport: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} disabled={exportingReport}
        className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-line bg-paper text-ink text-sm hover:bg-line/40 disabled:opacity-60">
        <Download size={14} />
        {exportingReport ? "Exporting…" : "Export"}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-surface border border-line rounded-xl shadow-xl py-1.5 z-30 min-w-[210px]">
          <button onClick={() => { exportCustomers(filtered); setOpen(false); }}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-paper w-full text-left">
            <Users size={14} className="text-accent" /> Export Customers (.xlsx)
          </button>
          <button onClick={() => { setOpen(false); exportFollowupReport(setExportingReport); }}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-paper w-full text-left">
            <FileText size={14} className="text-accent" /> Export Follow-up Report
          </button>
        </div>
      )}
    </div>
  );
}

// ── Row Overflow Menu (⋮) ─────────────────────────────────────

function RowMenu({ customer, onConvert, onLost, onDelete }: {
  customer: Customer; onConvert: () => void; onLost: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-ink hover:border-line hover:bg-line/60 transition-colors">
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-line rounded-xl shadow-xl py-1.5 z-30 min-w-[170px]">
          {customer.crm_status !== "converted" && (
            <button onClick={() => { setOpen(false); onConvert(); }}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50 w-full text-left">
              <CheckCircle2 size={14} /> Mark Converted
            </button>
          )}
          {customer.crm_status !== "lost" && (
            <button onClick={() => { setOpen(false); onLost(); }}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 w-full text-left">
              <XCircle size={14} /> Mark Lost
            </button>
          )}
          <div className="my-1 border-t border-line" />
          <button onClick={() => { setOpen(false); onDelete(); }}
            className="flex items-center gap-2.5 px-4 py-2 text-sm text-danger hover:bg-red-50 w-full text-left">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sort helpers ──────────────────────────────────────────────

type SortField = "name" | "next_followup_date" | "last_followup_date" | "crm_status" | "priority" | "created_at";

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: "asc" | "desc" }) {
  if (field !== sortField) return <ChevronsUpDown size={11} className="text-muted/40 ml-0.5" />;
  return sortDir === "asc"
    ? <ChevronUp size={11} className="text-accent ml-0.5" />
    : <ChevronDown size={11} className="text-accent ml-0.5" />;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function sortCustomers(customers: Customer[], field: SortField, dir: "asc" | "desc"): Customer[] {
  const d = dir === "asc" ? 1 : -1;
  return [...customers].sort((a, b) => {
    switch (field) {
      case "name": return d * a.name.localeCompare(b.name);
      case "next_followup_date": return d * ((a.next_followup_date ?? "9999") > (b.next_followup_date ?? "9999") ? 1 : -1);
      case "last_followup_date": return d * ((a.last_followup_date ?? "") > (b.last_followup_date ?? "") ? 1 : -1);
      case "crm_status": return d * a.crm_status.localeCompare(b.crm_status);
      case "priority": return d * ((PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1));
      default: return d * (a.created_at > b.created_at ? 1 : -1);
    }
  });
}

// ── Payment Follow-up Panel ───────────────────────────────────

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  invoice_sent: "bg-blue-50 text-blue-700 border-blue-200",
  payment_pending: "bg-amber-50 text-amber-700 border-amber-200",
  partially_paid: "bg-yellow-50 text-yellow-700 border-yellow-200",
  payment_completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  payment_reminder_sent: "bg-purple-50 text-purple-700 border-purple-200",
};

function PaymentFollowupPanel({
  customers, refreshToken, onAddPayment, onWhatsApp,
}: {
  customers: Customer[];
  refreshToken: number;
  onAddPayment: (customer: Customer) => void;
  onWhatsApp: (customer: Customer) => void;
}) {
  const [records, setRecords] = useState<PaymentFollowupReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.paymentFollowupsReport().then(setRecords).catch(() => {}).finally(() => setLoading(false));
  }, [refreshToken]);

  const t = new Date().toISOString().slice(0, 10);
  const filtered = records.filter(r => {
    if (filterStatus && r.payment_status !== filterStatus) return false;
    const q = search.toLowerCase();
    if (q && !r.customer_name.toLowerCase().includes(q)
      && !(r.invoice_number ?? "").toLowerCase().includes(q)
      && !(r.customer_phone ?? "").includes(q)
      && !(r.customer_company ?? "").toLowerCase().includes(q)) return false;
    return true;
  });

  const totalInvoiced = filtered.reduce((s, r) => s + r.invoice_amount, 0);
  const totalPaid = filtered.reduce((s, r) => s + r.paid_amount, 0);
  const totalBalance = filtered.reduce((s, r) => s + r.balance_amount, 0);
  const overdueCount = filtered.filter(r => r.next_payment_followup_date && r.next_payment_followup_date < t && r.payment_status !== "payment_completed").length;

  function fmt(n: number) {
    return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function exportReport() {
    setExporting(true);
    try {
      const data = filtered.map(r => ({
        "Customer": r.customer_name, "Company": r.customer_company ?? "", "Phone": r.customer_phone ?? "",
        "Invoice #": r.invoice_number ?? "", "Invoice Amount": r.invoice_amount,
        "Paid Amount": r.paid_amount, "Balance": r.balance_amount,
        "Status": PAYMENT_STATUSES.find(s => s.value === r.payment_status)?.label ?? r.payment_status,
        "Next Follow-up": r.next_payment_followup_date ?? "",
        "Notes": r.payment_notes ?? "",
        "Date": r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN") : "",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [22, 18, 14, 14, 14, 14, 14, 22, 16, 36, 12].map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Payment Follow-ups");
      XLSX.writeFile(wb, `payment_followups_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally { setExporting(false); }
  }

  return (
    <div className="bg-surface border border-line rounded-xl overflow-hidden">

      {/* Panel header + stats */}
      <div className="px-5 py-4 border-b border-line bg-paper/60 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-ink">Payment Follow-up Tracker</h3>
            <span className="text-xs text-muted font-normal">({records.length} total records)</span>
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 text-danger text-xs font-semibold px-2 py-0.5">
                <AlertCircle size={10} /> {overdueCount} overdue
              </span>
            )}
          </div>
          <button onClick={exportReport} disabled={exporting || filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-paper text-ink text-xs hover:bg-line/40 disabled:opacity-50">
            <Download size={12} /> {exporting ? "Exporting…" : "Export Excel"}
          </button>
        </div>

        {/* Summary stat tiles */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border bg-blue-50 border-blue-100 px-4 py-3">
            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">Total Invoiced</p>
            <p className="text-2xl font-bold text-blue-800 mt-1 leading-none">{fmt(totalInvoiced)}</p>
          </div>
          <div className="rounded-xl border bg-emerald-50 border-emerald-100 px-4 py-3">
            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">Total Paid</p>
            <p className="text-2xl font-bold text-emerald-800 mt-1 leading-none">{fmt(totalPaid)}</p>
          </div>
          <div className={`rounded-xl border px-4 py-3 ${totalBalance > 0 ? "bg-amber-50 border-amber-200" : "bg-zinc-50 border-zinc-100"}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${totalBalance > 0 ? "text-amber-600" : "text-zinc-500"}`}>Pending Balance</p>
            <p className={`text-2xl font-bold mt-1 leading-none ${totalBalance > 0 ? "text-amber-800" : "text-zinc-500"}`}>{fmt(totalBalance)}</p>
          </div>
          <div className="rounded-xl border bg-purple-50 border-purple-100 px-4 py-3">
            <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-wide">Records</p>
            <p className="text-2xl font-bold text-purple-800 mt-1 leading-none">{filtered.length}</p>
          </div>
        </div>

        {/* Search + status filter */}
        <div className="flex items-center gap-2">
          <input className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-accent w-60"
            placeholder="Search customer, invoice, phone…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-accent"
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Payment Statuses</option>
            {PAYMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {(search || filterStatus) && (
            <button onClick={() => { setSearch(""); setFilterStatus(""); }}
              className="text-xs text-accent hover:underline flex items-center gap-1">
              <X size={11} /> Clear
            </button>
          )}
          <span className="ml-auto text-xs text-muted">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-10 text-center">
          <div className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-sm text-muted">Loading payment records…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center">
          <Banknote size={36} className="mx-auto text-muted/20 mb-3" />
          <p className="text-sm font-medium text-muted">
            {records.length === 0
              ? "No payment follow-ups yet. Click the payment button on any customer row to add one."
              : "No records match your filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper/40 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap">Customer</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap">Invoice #</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted text-right whitespace-nowrap">Invoiced</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted text-right whitespace-nowrap">Paid</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted text-right whitespace-nowrap">Balance</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap">Payment Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap">Next Follow-up</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap">Notes</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {filtered.map(r => {
                const statusCls = PAYMENT_STATUS_COLORS[r.payment_status] ?? "bg-zinc-50 text-zinc-600 border-zinc-200";
                const statusLabel = PAYMENT_STATUSES.find(s => s.value === r.payment_status)?.label ?? r.payment_status;
                const isOverdue = r.next_payment_followup_date && r.next_payment_followup_date < t && r.payment_status !== "payment_completed";
                const customer = customers.find(c => c.id === r.customer_id);
                return (
                  <tr key={r.id} className="hover:bg-paper/60 transition-colors group">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-ink text-[13px] leading-tight">{r.customer_name}</p>
                      {r.customer_company && <p className="text-xs text-muted mt-0.5">{r.customer_company}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      {r.invoice_number
                        ? <span className="font-mono text-[12px] bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200">{r.invoice_number}</span>
                        : <span className="text-muted text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-ink text-[13px] tabular-nums">
                      {r.invoice_amount > 0 ? fmt(r.invoice_amount) : <span className="text-muted text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[13px] tabular-nums">
                      {r.paid_amount > 0
                        ? <span className="font-medium text-emerald-700">{fmt(r.paid_amount)}</span>
                        : <span className="text-muted text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      {r.balance_amount > 0
                        ? <span className="font-bold text-amber-700 text-[13px]">{fmt(r.balance_amount)}</span>
                        : <span className="text-emerald-600 font-semibold text-[12px]">Paid ✓</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium border whitespace-nowrap ${statusCls}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-[13px]">
                      {r.next_payment_followup_date ? (
                        <span className={isOverdue ? "text-danger font-semibold" : "text-ink"}>
                          {isOverdue ? "⚠ " : ""}
                          {new Date(r.next_payment_followup_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                        </span>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3.5 max-w-[180px]">
                      {r.payment_notes
                        ? <span className="text-xs text-muted line-clamp-2">{r.payment_notes}</span>
                        : <span className="text-muted text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        {customer && (
                          <button onClick={() => onAddPayment(customer)} title="Add Payment Follow-up"
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 transition-colors">
                            <Banknote size={14} />
                          </button>
                        )}
                        {r.customer_phone && (
                          <a href={`tel:${r.customer_phone}`} title="Call"
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-accent hover:border-accent/40 hover:bg-accent-soft transition-colors">
                            <PhoneCall size={14} />
                          </a>
                        )}
                        {r.customer_phone && customer && (
                          <button onClick={() => onWhatsApp(customer)} title="Send WhatsApp Message"
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-green-600 hover:border-green-300 hover:bg-green-50 transition-colors">
                            <WhatsAppIcon size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

const PAGE_SIZES = [10, 25, 50, 100];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  // Modals / Drawer
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [followupTarget, setFollowupTarget] = useState<Customer | null>(null);
  const [paymentFollowupTarget, setPaymentFollowupTarget] = useState<Customer | null>(null);
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [paymentPanelRefresh, setPaymentPanelRefresh] = useState(0);
  const [whatsappTarget, setWhatsappTarget] = useState<Customer | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterService, setFilterService] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function refresh() {
    setLoading(true);
    try { setCustomers(await api.listCustomers()); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  // Reset to page 1 when filters/sort change
  useEffect(() => { setPage(1); }, [search, filterStatus, filterPriority, filterService, filterStaff, filterDate, filterTag, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  // ── Stats ──────────────────────────────────────────────────
  const t = today();
  const stats = {
    total: customers.length,
    todayFollowups: customers.filter(c => c.next_followup_date === t && !["converted","lost","not_interested"].includes(c.crm_status)).length,
    pending: customers.filter(c => ["follow_up_pending","contacted","interested","demo_scheduled","quotation_sent"].includes(c.crm_status)).length,
    converted: customers.filter(c => c.crm_status === "converted").length,
    missed: customers.filter(isMissed).length,
  };

  // ── Filter → Sort → Paginate ───────────────────────────────
  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    if (q && !c.name.toLowerCase().includes(q) && !(c.phone ?? "").includes(q)
      && !(c.company ?? "").toLowerCase().includes(q) && !(c.email ?? "").toLowerCase().includes(q)) return false;
    if (filterStatus === "missed") { if (!isMissed(c)) return false; }
    else if (filterStatus === "all_pending") {
      if (!["follow_up_pending","contacted","interested","demo_scheduled","quotation_sent"].includes(c.crm_status)) return false;
    }
    else if (filterStatus && c.crm_status !== filterStatus) return false;
    if (filterPriority && c.priority !== filterPriority) return false;
    if (filterService && c.interested_service !== filterService) return false;
    if (filterStaff && !(c.assigned_staff ?? "").toLowerCase().includes(filterStaff.toLowerCase())) return false;
    if (filterDate && c.next_followup_date !== filterDate) return false;
    if (filterTag && !(c.tags ?? []).some(tag => tag.toLowerCase().includes(filterTag.toLowerCase()))) return false;
    return true;
  });

  const sorted = sortCustomers(filtered, sortField, sortDir);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const activeFilterCount = [filterStatus, filterPriority, filterService, filterStaff, filterDate, filterTag].filter(Boolean).length;
  const hasFilters = !!(search || activeFilterCount);

  function resetFilters() {
    setSearch(""); setFilterStatus(""); setFilterPriority("");
    setFilterService(""); setFilterStaff(""); setFilterDate(""); setFilterTag("");
  }

  // ── Handlers ──────────────────────────────────────────────
  async function handleStatusChange(id: string, crm_status: string) {
    try {
      await api.patchCrmStatus(id, crm_status);
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, crm_status } : c));
      if (viewing?.id === id) setViewing(v => v ? { ...v, crm_status } : v);
    } catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete customer "${name}"? This cannot be undone.`)) return;
    try { await api.deleteCustomer(id); setCustomers(prev => prev.filter(c => c.id !== id)); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  function handleFollowupSaved(_: CustomerFollowup) { setFollowupTarget(null); void refresh(); }

  const selCls = "rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";
  const inputCls = "rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";
  const showReminder = !reminderDismissed && (stats.missed > 0 || stats.todayFollowups > 0);

  // Sortable header helper
  function Th({ field, children, className = "" }: { field: SortField; children: React.ReactNode; className?: string }) {
    return (
      <th onClick={() => toggleSort(field)}
        className={`px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted cursor-pointer select-none hover:text-ink ${className}`}>
        <span className="inline-flex items-center gap-0.5">
          {children}
          <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── ROW 1: Title + Primary action ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Customers &amp; Follow Ups</h1>
          <p className="text-sm text-muted mt-1">Manage customers, leads, follow-ups, and conversion pipeline</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-accent text-white px-5 py-2.5 text-sm font-semibold shadow-sm hover:bg-accent/90 flex-shrink-0">
          <Plus size={16} /> New Customer
        </button>
      </div>

      {/* ── ROW 2: Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputCls} w-64`} placeholder="Search name, phone, company…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => setShowPaymentPanel(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm transition-colors ${
            showPaymentPanel ? "border-amber-400 bg-amber-50 text-amber-700" : "border-line bg-paper text-ink hover:bg-line/40"}`}>
          <Banknote size={14} /> Payment Follow-up
        </button>
        <button onClick={() => setShowPipeline(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm transition-colors ${
            showPipeline ? "border-accent bg-accent-soft text-accent" : "border-line bg-paper text-ink hover:bg-line/40"}`}>
          <BarChart3 size={14} /> Pipeline
        </button>
        <button onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm transition-colors ${
            showFilters ? "border-accent bg-accent-soft text-accent" : "border-line bg-paper text-ink hover:bg-line/40"}`}>
          <Filter size={14} /> Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent text-white text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className="flex-1" />
        <button onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-line bg-paper text-ink text-sm hover:bg-line/40">
          <Upload size={14} /> Import Excel
        </button>
        <ExportDropdown filtered={filtered} exportingReport={exportingReport} setExportingReport={setExportingReport} />
      </div>

      {/* ── Reminder Banner ── */}
      {showReminder && (
        <div className="flex items-center gap-3 rounded-xl border px-5 py-3 bg-amber-50 border-amber-200">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
          <div className="flex-1 text-sm">
            {stats.missed > 0 && <span className="font-semibold text-amber-800">⚠️ {stats.missed} missed follow-up{stats.missed !== 1 ? "s" : ""}</span>}
            {stats.missed > 0 && stats.todayFollowups > 0 && <span className="text-amber-500 mx-2">·</span>}
            {stats.todayFollowups > 0 && <span className="font-semibold text-amber-800">📅 {stats.todayFollowups} due today</span>}
            {stats.missed > 0 && <button onClick={() => setFilterStatus("missed")} className="ml-4 text-xs text-amber-700 underline hover:no-underline">Show missed →</button>}
            {stats.todayFollowups > 0 && <button onClick={() => setFilterDate(t)} className="ml-3 text-xs text-amber-700 underline hover:no-underline">Show today →</button>}
          </div>
          <button onClick={() => setReminderDismissed(true)} className="text-amber-400 hover:text-amber-700"><X size={15} /></button>
        </div>
      )}

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Total Customers" value={stats.total} icon={Users} accent="bg-blue-50 text-blue-600"
          onClick={hasFilters ? resetFilters : undefined} active={!hasFilters && customers.length > 0} />
        <StatCard label="Today Follow-ups" value={stats.todayFollowups} icon={Calendar} accent="bg-accent-soft text-accent"
          onClick={() => setFilterDate(filterDate === t ? "" : t)} active={filterDate === t} />
        <StatCard label="Pending Follow-ups" value={stats.pending} icon={Clock} accent="bg-orange-50 text-orange-600"
          onClick={() => setFilterStatus(filterStatus === "all_pending" ? "" : "all_pending")}
          active={filterStatus === "all_pending"} />
        <StatCard label="Converted" value={stats.converted} icon={TrendingUp} accent="bg-emerald-50 text-emerald-700"
          onClick={() => setFilterStatus(filterStatus === "converted" ? "" : "converted")} active={filterStatus === "converted"} />
        <StatCard label="Missed Follow-ups" value={stats.missed} icon={AlertCircle}
          accent={stats.missed > 0 ? "bg-red-50 text-red-600" : "bg-zinc-50 text-zinc-400"}
          onClick={() => setFilterStatus(filterStatus === "missed" ? "" : "missed")} active={filterStatus === "missed"} />
      </div>

      {/* ── Payment Follow-up Panel ── */}
      {showPaymentPanel && (
        <PaymentFollowupPanel
          customers={customers}
          refreshToken={paymentPanelRefresh}
          onAddPayment={c => setPaymentFollowupTarget(c)}
          onWhatsApp={c => setWhatsappTarget(c)}
        />
      )}

      {/* ── Pipeline ── */}
      {showPipeline && <PipelineView customers={customers} />}

      {/* ── Filter Panel ── */}
      {showFilters && (
        <div className="bg-surface border border-line rounded-xl p-5">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-1.5">Status</label>
              <select className={`${selCls} w-full`} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                {CRM_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                <option value="all_pending">📋 All Pending (Active)</option>
                <option value="missed">⚠ Missed Follow-up</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-1.5">Priority</label>
              <select className={`${selCls} w-full`} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                <option value="">All Priorities</option>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-1.5">Interested Service</label>
              <select className={`${selCls} w-full`} value={filterService} onChange={e => setFilterService(e.target.value)}>
                <option value="">All Services</option>
                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-1.5">Assigned Staff</label>
              <input className={`${inputCls} w-full`} placeholder="Staff name…" value={filterStaff} onChange={e => setFilterStaff(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-1.5">Follow-up Date</label>
              <input type="date" className={`${inputCls} w-full`} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-1.5 flex items-center gap-1">
                <Tag size={10} /> Tag
              </label>
              <input className={`${inputCls} w-full`} placeholder="Filter by tag…" value={filterTag} onChange={e => setFilterTag(e.target.value)} />
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
              <span className="text-xs text-muted">{activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active · {filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
              <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line text-sm text-muted hover:text-ink hover:bg-line/50">
                <RotateCcw size={12} /> Reset All
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Customer Table ── */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">

        {/* Table top bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-paper/60">
          <span className="text-sm font-medium text-ink">
            {filtered.length} {filtered.length === 1 ? "customer" : "customers"}
            {hasFilters && <span className="text-muted font-normal"> (filtered)</span>}
          </span>
          {hasFilters && <button onClick={resetFilters} className="text-xs text-accent hover:underline">Clear filters</button>}
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-muted">Loading customers…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={36} className="mx-auto text-muted/30 mb-3" />
            <p className="text-sm font-medium text-muted">
              {customers.length === 0 ? "No customers yet." : "No customers match the current filters."}
            </p>
            {customers.length === 0 && (
              <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-accent hover:underline">
                Add your first customer →
              </button>
            )}
            {hasFilters && (
              <button onClick={resetFilters} className="mt-2 text-sm text-accent hover:underline block mx-auto">Reset filters</button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead>
                  <tr className="border-b border-line text-left bg-paper/40">
                    <Th field="name" className="px-5">Customer</Th>
                    <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted">Phone</th>
                    <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted">Service</th>
                    <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted">Staff</th>
                    <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted">Tags</th>
                    <Th field="last_followup_date">Last F/U</Th>
                    <Th field="next_followup_date">Next F/U</Th>
                    <Th field="crm_status">Status</Th>
                    <Th field="priority">Priority</Th>
                    <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(c => {
                    const missed = isMissed(c);
                    const tags = c.tags ?? [];
                    return (
                      <tr key={c.id}
                        className={`border-b border-line/60 last:border-0 hover:bg-paper/70 transition-colors ${missed ? "bg-red-50/40" : ""}`}>

                        <td className="px-5 py-3.5">
                          <button onClick={() => setViewing(c)}
                            className="font-semibold text-ink hover:text-accent text-left block leading-tight">
                            {c.name}
                          </button>
                          {c.company && <p className="text-xs text-muted mt-0.5">{c.company}</p>}
                        </td>

                        <td className="px-3 py-3.5 text-muted whitespace-nowrap text-[13px]">{c.phone ?? "—"}</td>
                        <td className="px-3 py-3.5 text-muted max-w-[120px] truncate text-[13px]">{c.interested_service ?? "—"}</td>
                        <td className="px-3 py-3.5 text-muted text-[13px]">{c.assigned_staff ?? "—"}</td>

                        <td className="px-3 py-3.5">
                          {tags.length === 0 ? (
                            <span className="text-muted text-[13px]">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {tags.slice(0, 2).map((tag, i) => (
                                <span key={tag} className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${TAG_COLORS[i % TAG_COLORS.length]}`}>{tag}</span>
                              ))}
                              {tags.length > 2 && <span className="text-[11px] text-muted">+{tags.length - 2}</span>}
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3.5 whitespace-nowrap text-[13px]">{fmtDate(c.last_followup_date)}</td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-[13px]">
                          {missed ? <span className="text-danger font-semibold text-xs">⚠ Missed</span> : fmtDate(c.next_followup_date)}
                        </td>

                        <td className="px-3 py-3.5"><StatusBadge value={c.crm_status} /></td>
                        <td className="px-3 py-3.5"><PriorityBadge value={c.priority} /></td>

                        {/* Actions */}
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => setViewing(c)} title="View"
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-accent hover:border-accent/40 hover:bg-accent-soft transition-colors"><Eye size={14} /></button>
                            <button onClick={() => setEditing(c)} title="Edit"
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-accent hover:border-accent/40 hover:bg-accent-soft transition-colors"><PenLine size={14} /></button>
                            <button onClick={() => setFollowupTarget(c)} title="Add Follow-up"
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-accent hover:border-accent/40 hover:bg-accent-soft transition-colors"><CalendarPlus size={14} /></button>
                            <button onClick={() => setPaymentFollowupTarget(c)} title="Payment Follow-up"
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 transition-colors"><Banknote size={14} /></button>
                            {c.phone && (
                              <a href={`tel:${c.phone}`} title="Call"
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-accent hover:border-accent/40 hover:bg-accent-soft transition-colors"><PhoneCall size={14} /></a>
                            )}
                            {(c.whatsapp || c.phone) && (
                              <button onClick={() => setWhatsappTarget(c)} title="Send WhatsApp Message"
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-green-600 hover:border-green-300 hover:bg-green-50 transition-colors"><WhatsAppIcon size={14} /></button>
                            )}
                            <RowMenu
                              customer={c}
                              onConvert={() => { if (confirm(`Convert "${c.name}"?`)) handleStatusChange(c.id, "converted"); }}
                              onLost={() => { if (confirm(`Mark "${c.name}" as Lost?`)) handleStatusChange(c.id, "lost"); }}
                              onDelete={() => handleDelete(c.id, c.name)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination Footer ── */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-line bg-paper/40">
              <p className="text-xs text-muted">
                Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} to{" "}
                {Math.min(page * pageSize, filtered.length)} of {filtered.length}{" "}
                customer{filtered.length !== 1 ? "s" : ""}
              </p>

              <div className="flex items-center gap-3">
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="rounded-md border border-line bg-paper px-2 py-1 text-xs outline-none focus:border-accent">
                  {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
                </select>

                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={page === 1}
                    className="px-2 py-1 rounded text-xs border border-line disabled:opacity-40 hover:bg-line/50 disabled:cursor-not-allowed">«</button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-2 py-1 rounded text-xs border border-line disabled:opacity-40 hover:bg-line/50 disabled:cursor-not-allowed">‹</button>

                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let p: number;
                    if (totalPages <= 5) p = i + 1;
                    else if (page <= 3) p = i + 1;
                    else if (page >= totalPages - 2) p = totalPages - 4 + i;
                    else p = page - 2 + i;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded text-xs border transition-colors ${
                          p === page ? "bg-accent text-white border-accent font-semibold" : "border-line hover:bg-line/50 text-muted"
                        }`}>{p}</button>
                    );
                  })}

                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-2 py-1 rounded text-xs border border-line disabled:opacity-40 hover:bg-line/50 disabled:cursor-not-allowed">›</button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                    className="px-2 py-1 rounded text-xs border border-line disabled:opacity-40 hover:bg-line/50 disabled:cursor-not-allowed">»</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {showImport && (
        <ImportCustomersModal onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); void refresh(); }} />
      )}
      {(showCreate || editing) && (
        <AddCustomerModal editing={editing} existingCustomers={customers}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); void refresh(); }} />
      )}
      {paymentFollowupTarget && (
        <AddPaymentFollowupModal customer={paymentFollowupTarget}
          onClose={() => setPaymentFollowupTarget(null)}
          onSaved={() => { setPaymentFollowupTarget(null); void refresh(); setPaymentPanelRefresh(n => n + 1); }} />
      )}
      {followupTarget && (
        <AddFollowUpModal customer={followupTarget}
          onClose={() => setFollowupTarget(null)}
          onSaved={handleFollowupSaved} />
      )}
      {whatsappTarget && (
        <WhatsAppMessageModal
          customer={whatsappTarget}
          onClose={() => setWhatsappTarget(null)}
        />
      )}
      {viewing && (
        <CustomerDrawer
          customer={viewing}
          onClose={() => setViewing(null)}
          onEdit={c => { setViewing(null); setEditing(c); }}
          onAddFollowup={c => { setViewing(null); setFollowupTarget(c); }}
          onPaymentFollowup={c => { setViewing(null); setPaymentFollowupTarget(c); }}
          onStatusChange={async (id, status) => {
            await handleStatusChange(id, status);
            const updated = customers.find(c => c.id === id);
            if (updated) setViewing({ ...updated, crm_status: status });
          }}
        />
      )}
    </div>
  );
}
