import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Eye, Search, Download, FileText,
  CreditCard, MessageCircle, Printer, Bell, Edit,
} from "lucide-react";
import * as XLSX from "xlsx";
import { api, type Invoice } from "../lib/api";
import { RecordPaymentModal } from "./billing/RecordPaymentModal";

// ── Status styling ─────────────────────────────────────────────
const STATUS_CLS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  sent:  "bg-sky-100 text-sky-700",
  paid:  "bg-emerald-100 text-emerald-700",
  void:  "bg-red-100 text-red-600",
};
const PAY_STATUS: Record<string, { label: string; cls: string }> = {
  paid:           { label: "Paid",           cls: "bg-emerald-100 text-emerald-700" },
  partially_paid: { label: "Partially Paid", cls: "bg-amber-100 text-amber-700" },
  unpaid:         { label: "Unpaid",         cls: "bg-zinc-100 text-zinc-600" },
  void:           { label: "Void",           cls: "bg-red-100 text-red-600" },
};

// ── Helpers ────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => Number(n).toFixed(2);

function getPayStatus(inv: Invoice) {
  if (inv.status === "void") return { key: "void", ...PAY_STATUS.void };
  if (Number(inv.balance_due) <= 0.001) return { key: "paid", ...PAY_STATUS.paid };
  if (Number(inv.amount_paid) > 0) return { key: "partially_paid", ...PAY_STATUS.partially_paid };
  return { key: "unpaid", ...PAY_STATUS.unpaid };
}

function buildWaPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 10) return "91" + d;
  if (d.length > 10) return d;
  return null;
}

function invoiceWaMsg(inv: Invoice): string {
  return (
    `Hi ${inv.customer_name},\n\n` +
    `Your invoice ${inv.invoice_number} has been generated.\n\n` +
    `Total Amount: ₹${fmt(inv.total)}\n` +
    `Paid Amount: ₹${fmt(inv.amount_paid)}\n` +
    `Balance Amount: ₹${fmt(inv.balance_due)}\n` +
    `Due Date: ${inv.due_date ?? "N/A"}\n\n` +
    `Please check and complete the payment.`
  );
}

function reminderWaMsg(inv: Invoice): string {
  return (
    `Hi ${inv.customer_name},\n\n` +
    `This is a payment reminder for invoice ${inv.invoice_number}.\n\n` +
    `Balance Amount: ₹${fmt(inv.balance_due)}\n` +
    `Due Date: ${inv.due_date ?? "N/A"}\n\n` +
    `Kindly complete the pending payment.`
  );
}

// ── Inline action button ───────────────────────────────────────
function ActionBtn({
  icon, label, onClick, disabled, tooltip, green = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
  green?: boolean;
}) {
  return (
    <button
      title={disabled && tooltip ? tooltip : undefined}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap select-none",
        disabled
          ? "border-line text-muted opacity-40 cursor-not-allowed"
          : green
            ? "border-accent/60 text-accent hover:bg-accent/5 cursor-pointer"
            : "border-line text-ink hover:bg-surface cursor-pointer",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Component ──────────────────────────────────────────────────
export default function BillingPage() {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Filters
  const [searchQ, setSearchQ]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payFilter, setPayFilter]       = useState("all");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");

  // UI
  const [recordPayInvoice, setRecordPay] = useState<Invoice | null>(null);
  const [exporting, setExporting]        = useState(false);

  async function refresh() {
    setInvoices(await api.listInvoices());
  }
  useEffect(() => { void refresh(); }, []);

  // ── Actions ────────────────────────────────────────────────
  function sendWhatsApp(inv: Invoice) {
    const wa = buildWaPhone(inv.customer_phone);
    if (!wa) return;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(invoiceWaMsg(inv))}`, "_blank", "noopener");
  }

  function sendReminder(inv: Invoice) {
    const wa = buildWaPhone(inv.customer_phone);
    if (!wa) return;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(reminderWaMsg(inv))}`, "_blank", "noopener");
  }

  // ── Exports ────────────────────────────────────────────────
  function exportInvoicesExcel() {
    const rows = filtered.map(inv => {
      const ps = getPayStatus(inv);
      return {
        "Invoice No":     inv.invoice_number,
        "Customer":       inv.customer_name,
        "Email":          inv.customer_email ?? "",
        "Phone":          inv.customer_phone ?? "",
        "Issue Date":     inv.issue_date,
        "Due Date":       inv.due_date ?? "",
        "Invoice Status": inv.status,
        "Payment Status": ps.label,
        "Subtotal":       fmt(inv.subtotal),
        "Discount":       fmt(inv.discount_total ?? 0),
        "Tax":            fmt(inv.tax_total),
        "Other Charges":  fmt(inv.other_charges ?? 0),
        "Total":          fmt(inv.total),
        "Amount Paid":    fmt(inv.amount_paid),
        "Balance Due":    fmt(inv.balance_due),
        "Notes":          inv.notes ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, `Invoices_${todayISO()}.xlsx`);
  }

  async function exportPaymentReport() {
    setExporting(true);
    try {
      const all = await Promise.all(invoices.map(inv => api.getInvoice(inv.id)));
      const rows: Record<string, string>[] = [];
      for (const inv of all) {
        for (const p of (inv.payments ?? [])) {
          rows.push({
            "Invoice No":      inv.invoice_number,
            "Customer":        inv.customer_name,
            "Phone":           inv.customer_phone ?? "",
            "Payment Date":    String(p.payment_date),
            "Amount":          fmt(p.amount),
            "Method":          p.method,
            "Transaction ID":  p.reference ?? "",
            "Notes":           p.notes ?? "",
            "Invoice Total":   fmt(inv.total),
            "Invoice Balance": fmt(inv.balance_due),
            "Invoice Status":  inv.status,
          });
        }
      }
      if (rows.length === 0) { alert("No payment records to export."); return; }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Payments");
      XLSX.writeFile(wb, `PaymentReport_${todayISO()}.xlsx`);
    } catch { alert("Export failed. Please try again."); }
    setExporting(false);
  }

  // ── Stats ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = todayISO();
    return {
      total:         invoices.length,
      paid:          invoices.filter(i => i.status === "paid").length,
      pendingAmt:    invoices.filter(i => !["paid","void"].includes(i.status)).reduce((s,i) => s + Number(i.balance_due), 0),
      partiallyPaid: invoices.filter(i => Number(i.amount_paid) > 0 && Number(i.balance_due) > 0).length,
      overdue:       invoices.filter(i => i.due_date && i.due_date < today && !["paid","void"].includes(i.status) && Number(i.balance_due) > 0).length,
      revenue:       invoices.reduce((s,i) => s + Number(i.amount_paid), 0),
    };
  }, [invoices]);

  // ── Filtered invoices ──────────────────────────────────────
  const filtered = useMemo(() => invoices.filter(inv => {
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!inv.invoice_number.toLowerCase().includes(q) &&
          !inv.customer_name.toLowerCase().includes(q) &&
          !(inv.customer_phone ?? "").includes(q)) return false;
    }
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (payFilter !== "all" && getPayStatus(inv).key !== payFilter) return false;
    if (dateFrom && inv.issue_date < dateFrom) return false;
    if (dateTo   && inv.issue_date > dateTo)   return false;
    return true;
  }), [invoices, searchQ, statusFilter, payFilter, dateFrom, dateTo]);

  const hasFilters = searchQ || statusFilter !== "all" || payFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h1 className="text-xl font-semibold">Invoices</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportInvoicesExcel}
            className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-md text-sm text-ink hover:bg-surface">
            <Download size={14} /> Export Invoices
          </button>
          <button onClick={exportPaymentReport} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-md text-sm text-ink hover:bg-surface disabled:opacity-50">
            <FileText size={14} /> {exporting ? "Exporting…" : "Export Payment Report"}
          </button>
          <button onClick={() => navigate("/billing/new")}
            className="flex items-center gap-2 rounded-md bg-accent text-white px-4 py-2 text-sm font-medium">
            <Plus size={16} /> New Invoice
          </button>
        </div>
      </div>

      {/* ── Dashboard Stats (click a card to filter the list) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <button onClick={() => { setStatusFilter("all"); setPayFilter("all"); }}
          className={`text-left rounded-xl p-4 border transition-all w-full cursor-pointer hover:shadow-md hover:-translate-y-0.5 bg-surface ${statusFilter === "all" && payFilter === "all" ? "border-accent ring-2 ring-accent/20 shadow-sm" : "border-line hover:border-line/80"}`}>
          <p className="text-xs text-muted mb-1">Total Invoices</p>
          <p className="text-2xl font-bold text-ink">{stats.total}</p>
        </button>
        <button onClick={() => setStatusFilter("paid")}
          className={`text-left rounded-xl p-4 border transition-all w-full cursor-pointer hover:shadow-md hover:-translate-y-0.5 bg-surface ${statusFilter === "paid" ? "border-accent ring-2 ring-accent/20 shadow-sm" : "border-line hover:border-line/80"}`}>
          <p className="text-xs text-muted mb-1">Paid Invoices</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.paid}</p>
        </button>
        <div className="bg-surface border border-line rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Pending Amount</p>
          <p className="text-2xl font-bold text-amber-600">₹{fmt(stats.pendingAmt)}</p>
        </div>
        <button onClick={() => setPayFilter("partially_paid")}
          className={`text-left rounded-xl p-4 border transition-all w-full cursor-pointer hover:shadow-md hover:-translate-y-0.5 bg-surface ${payFilter === "partially_paid" ? "border-accent ring-2 ring-accent/20 shadow-sm" : "border-line hover:border-line/80"}`}>
          <p className="text-xs text-muted mb-1">Partially Paid</p>
          <p className="text-2xl font-bold text-blue-600">{stats.partiallyPaid}</p>
        </button>
        <div className="bg-surface border border-line rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Overdue</p>
          <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-accent">₹{fmt(stats.revenue)}</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            className="w-full pl-8 pr-3 py-2 border border-line rounded-md text-sm bg-paper outline-none focus:border-accent"
            placeholder="Invoice #, customer name or phone…"
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
          />
        </div>
        <select className="border border-line rounded-md px-3 py-2 text-sm bg-paper outline-none focus:border-accent"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
        </select>
        <select className="border border-line rounded-md px-3 py-2 text-sm bg-paper outline-none focus:border-accent"
          value={payFilter} onChange={e => setPayFilter(e.target.value)}>
          <option value="all">All Payment Status</option>
          <option value="unpaid">Unpaid</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
        </select>
        <input type="date" className="border border-line rounded-md px-3 py-2 text-sm bg-paper outline-none focus:border-accent"
          value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
        <input type="date" className="border border-line rounded-md px-3 py-2 text-sm bg-paper outline-none focus:border-accent"
          value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
        {hasFilters && (
          <button onClick={() => { setSearchQ(""); setStatusFilter("all"); setPayFilter("all"); setDateFrom(""); setDateTo(""); }}
            className="text-sm text-muted hover:text-danger underline whitespace-nowrap">
            Clear filters
          </button>
        )}
      </div>

      {/* ── Invoice Table ── */}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted">
            {invoices.length === 0 ? "No invoices yet." : "No invoices match the selected filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1300px]">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Invoice Status</th>
                  <th className="px-4 py-3">Payment Status</th>
                  <th className="px-4 py-3 text-right" style={{ minWidth: "296px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const ps         = getPayStatus(inv);
                  const today      = todayISO();
                  const isOverdue  = !!inv.due_date && inv.due_date < today
                    && !["paid","void"].includes(inv.status) && Number(inv.balance_due) > 0;
                  const isVoid     = inv.status === "void";
                  const hasBalance = Number(inv.balance_due) > 0.001;
                  const hasPhone   = !!buildWaPhone(inv.customer_phone);
                  const noPhoneTip = "Customer phone not found";

                  return (
                    <tr key={inv.id}
                      className="border-b border-line/60 last:border-0 hover:bg-paper/60 cursor-pointer"
                      onClick={() => navigate(`/billing/${inv.id}`)}>

                      <td className="px-4 py-4 font-mono text-xs text-muted">{inv.invoice_number}</td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-ink">{inv.customer_name}</div>
                        {inv.customer_phone && <div className="text-xs text-muted">{inv.customer_phone}</div>}
                      </td>

                      <td className="px-4 py-4 text-muted">{inv.issue_date}</td>

                      <td className="px-4 py-4">
                        {inv.due_date ? (
                          <span className={isOverdue ? "text-danger font-medium" : "text-muted"}>
                            {inv.due_date}{isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>

                      <td className="px-4 py-4 text-right font-mono">₹{fmt(inv.total)}</td>
                      <td className="px-4 py-4 text-right font-mono text-emerald-700">₹{fmt(inv.amount_paid)}</td>

                      <td className="px-4 py-4 text-right font-mono">
                        <span className={Number(inv.balance_due) > 0 ? "text-danger font-semibold" : "text-muted"}>
                          ₹{fmt(inv.balance_due)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[inv.status] ?? ""}`}>
                          {inv.status}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ps.cls}`}>
                          {ps.label}
                        </span>
                      </td>

                      {/* ── Action buttons ── */}
                      <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col gap-1.5 items-end">

                          {/* Row 1: View | Edit | Print */}
                          <div className="flex gap-1.5">
                            <ActionBtn
                              icon={<Eye size={12} />}
                              label="View"
                              onClick={() => navigate(`/billing/${inv.id}`)}
                            />
                            <ActionBtn
                              icon={<Edit size={12} />}
                              label="Edit"
                              disabled={isVoid}
                              onClick={() => navigate(`/billing/${inv.id}`)}
                            />
                            <ActionBtn
                              icon={<Printer size={12} />}
                              label="Print"
                              onClick={() => window.open(`/billing/${inv.id}?print=1`, "_blank")}
                            />
                          </div>

                          {/* Row 2: WhatsApp | Payment | Reminder */}
                          <div className="flex gap-1.5">
                            <ActionBtn
                              icon={<MessageCircle size={12} />}
                              label="WhatsApp"
                              disabled={!hasPhone}
                              tooltip={!hasPhone ? noPhoneTip : undefined}
                              green
                              onClick={() => sendWhatsApp(inv)}
                            />
                            <ActionBtn
                              icon={<CreditCard size={12} />}
                              label="Payment"
                              disabled={isVoid || !hasBalance}
                              green
                              onClick={() => setRecordPay(inv)}
                            />
                            <ActionBtn
                              icon={<Bell size={12} />}
                              label="Reminder"
                              disabled={!hasPhone || !hasBalance}
                              tooltip={!hasPhone ? noPhoneTip : undefined}
                              green
                              onClick={() => sendReminder(inv)}
                            />
                          </div>

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

      {/* ── Record Payment Modal ── */}
      {recordPayInvoice && (
        <RecordPaymentModal
          invoice={recordPayInvoice}
          onClose={() => setRecordPay(null)}
          onSuccess={() => { setRecordPay(null); void refresh(); }}
        />
      )}
    </div>
  );
}
