import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X, Phone, MessageCircle, CheckCircle2, XCircle, Pencil, CalendarPlus,
  Building2, Mail, MapPin, User, Tag, Clock, MessageSquare, Receipt,
  CreditCard, Activity, FileText, AlertCircle, IndianRupee, RefreshCw,
} from "lucide-react";
import {
  api, type Customer, type CustomerFollowup, type CustomerInvoice,
  type CustomerPaymentFollowup, CRM_STATUSES, PRIORITIES, PAYMENT_STATUSES,
} from "../../lib/api";
import AddFollowUpModal from "./AddFollowUpModal";
import AddPaymentFollowupModal from "./AddPaymentFollowupModal";

// ── Helpers ────────────────────────────────────────────────────

function StatusBadge({ value }: { value: string }) {
  const s = CRM_STATUSES.find(x => x.value === value);
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s?.cls ?? "bg-zinc-100 text-zinc-500"}`}>
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

function PaymentStatusBadge({ value }: { value: string }) {
  const cls: Record<string, string> = {
    invoice_sent:           "bg-blue-100 text-blue-700",
    payment_pending:        "bg-amber-100 text-amber-700",
    partially_paid:         "bg-orange-100 text-orange-700",
    payment_completed:      "bg-emerald-100 text-emerald-700",
    payment_reminder_sent:  "bg-purple-100 text-purple-700",
  };
  const label = PAYMENT_STATUSES.find(s => s.value === value)?.label ?? value;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls[value] ?? "bg-zinc-100 text-zinc-500"}`}>
      {label}
    </span>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function fmtMode(m: string) {
  const icons: Record<string, string> = {
    call: "📞", whatsapp: "💬", email: "📧", meeting: "🤝", payment: "💰",
  };
  return `${icons[m] ?? "📝"} ${m.charAt(0).toUpperCase() + m.slice(1)}`;
}

const TAG_COLORS = [
  "bg-blue-100 text-blue-700", "bg-green-100 text-green-700",
  "bg-orange-100 text-orange-700", "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700", "bg-teal-100 text-teal-700",
];

type Tab = "details" | "activity" | "payments" | "invoices";

type ActivityEntry = {
  id: string;
  type: "created" | "followup";
  date: string;
  mode?: string;
  status?: string;
  notes?: string | null;
  next_date?: string | null;
};

interface Props {
  customer: Customer;
  onClose: () => void;
  onEdit: (c: Customer) => void;
  onAddFollowup: (c: Customer) => void;
  onStatusChange: (id: string, status: string) => void;
  onPaymentFollowup?: (c: Customer) => void;
}

export default function CustomerDrawer({
  customer, onClose, onEdit, onAddFollowup: _onAddFollowup, onStatusChange, onPaymentFollowup: _onPaymentFollowup,
}: Props) {
  const navigate = useNavigate();
  const [followups, setFollowups] = useState<CustomerFollowup[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [paymentFollowups, setPaymentFollowups] = useState<CustomerPaymentFollowup[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Inline modals — open ON TOP of drawer (z-[70])
  const [showInlineFollowup, setShowInlineFollowup] = useState(false);
  const [showInlinePayment, setShowInlinePayment] = useState(false);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    try {
      const [fu, inv, pf] = await Promise.all([
        api.listFollowups(customer.id).catch(() => [] as CustomerFollowup[]),
        api.customerInvoices(customer.id).catch(() => [] as CustomerInvoice[]),
        api.listPaymentFollowups(customer.id).catch(() => [] as CustomerPaymentFollowup[]),
      ]);
      setFollowups(fu);
      setInvoices(inv);
      setPaymentFollowups(pf);
    } finally {
      if (!quiet) setLoading(false); else setRefreshing(false);
    }
  }, [customer.id]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Escape key closes drawer (only when no inline modal open)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !showInlineFollowup && !showInlinePayment) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, showInlineFollowup, showInlinePayment]);

  // Unified activity log: creation + all followups, newest first
  const activities: ActivityEntry[] = [
    {
      id: "created",
      type: "created" as const,
      date: customer.created_at,
      notes: "Customer added to CRM",
    },
    ...followups.map(f => ({
      id: f.id,
      type: "followup" as const,
      date: f.created_at,
      mode: f.followup_mode,
      status: f.followup_status,
      notes: f.notes,
      next_date: f.next_followup_date,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const phone = customer.phone ?? "";
  const wa = customer.whatsapp ?? customer.phone ?? "";
  const unpaidInvoices = invoices.filter(i => (i.total - i.amount_paid) > 0.01);
  const tags = customer.tags ?? [];
  const totalOutstanding = unpaidInvoices.reduce((s, i) => s + (i.total - i.amount_paid), 0);

  function tabBtn(tab: Tab, label: string) {
    return (
      <button key={tab} onClick={() => setActiveTab(tab)}
        className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
          activeTab === tab
            ? "border-accent text-accent"
            : "border-transparent text-muted hover:text-ink"
        }`}>
        {label}
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-[540px] bg-surface border-l border-line shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-line bg-surface">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-ink text-base truncate">{customer.name}</h2>
              <StatusBadge value={customer.crm_status} />
              <PriorityBadge value={customer.priority} />
            </div>
            {customer.company && <p className="text-xs text-muted mt-0.5">{customer.company}</p>}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag, i) => (
                  <span key={tag}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[i % TAG_COLORS.length]}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            <button onClick={() => void loadData(true)} disabled={refreshing} title="Refresh"
              className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-accent-soft disabled:opacity-50">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-md text-muted hover:text-ink">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-line bg-paper/60 flex-wrap">
          <button onClick={() => setShowInlineFollowup(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90">
            <CalendarPlus size={13} /> Add Follow-up
          </button>
          <button onClick={() => setShowInlinePayment(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100">
            <CreditCard size={13} /> Payment Follow-up
          </button>
          <button onClick={() => onEdit(customer)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line text-ink text-xs hover:bg-line/50">
            <Pencil size={13} /> Edit
          </button>
          {phone && (
            <a href={`tel:${phone}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line text-ink text-xs hover:bg-line/50">
              <Phone size={13} /> Call
            </a>
          )}
          {wa && (
            <a href={`https://wa.me/91${wa.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line text-xs text-green-700 hover:bg-green-50">
              <MessageCircle size={13} /> WhatsApp
            </a>
          )}
          <button onClick={() => navigate("/billing")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line text-ink text-xs hover:bg-line/50">
            <Receipt size={13} /> Create Invoice
          </button>
          {customer.crm_status !== "converted" && (
            <button onClick={() => { if (confirm(`Convert ${customer.name}?`)) onStatusChange(customer.id, "converted"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-200 text-emerald-700 text-xs hover:bg-emerald-50">
              <CheckCircle2 size={13} /> Convert
            </button>
          )}
          {customer.crm_status !== "lost" && (
            <button onClick={() => { if (confirm(`Mark ${customer.name} as Lost?`)) onStatusChange(customer.id, "lost"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 text-red-600 text-xs hover:bg-red-50">
              <XCircle size={13} /> Mark Lost
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-line bg-paper/30 overflow-x-auto flex-shrink-0">
          {tabBtn("details", "Details")}
          {tabBtn("activity", `Activity (${activities.length})`)}
          {tabBtn("payments", `Payments${paymentFollowups.length > 0 ? ` (${paymentFollowups.length})` : ""}`)}
          {tabBtn("invoices", `Invoices${invoices.length > 0 ? ` (${invoices.length})` : ""}`)}
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* ═══════ DETAILS ═══════ */}
          {activeTab === "details" && (
            <>
              {/* Contact Info */}
              <div className="bg-paper rounded-lg border border-line p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Contact Info</h3>
                <div className="space-y-2 text-sm">
                  {customer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-muted flex-shrink-0" />
                      <a href={`tel:${customer.phone}`} className="text-accent hover:underline">{customer.phone}</a>
                    </div>
                  )}
                  {customer.whatsapp && customer.whatsapp !== customer.phone && (
                    <div className="flex items-center gap-2">
                      <MessageCircle size={13} className="text-muted flex-shrink-0" />
                      <span className="text-ink">{customer.whatsapp} <span className="text-muted text-xs">(WhatsApp)</span></span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-muted flex-shrink-0" />
                      <a href={`mailto:${customer.email}`} className="text-accent hover:underline">{customer.email}</a>
                    </div>
                  )}
                  {customer.company && (
                    <div className="flex items-center gap-2">
                      <Building2 size={13} className="text-muted flex-shrink-0" />
                      <span className="text-ink">{customer.company}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="text-muted flex-shrink-0 mt-0.5" />
                      <span className="text-ink">{customer.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* CRM Details */}
              <div className="bg-paper rounded-lg border border-line p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">CRM Details</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <span className="text-xs text-muted block">Status</span>
                    <div className="mt-0.5"><StatusBadge value={customer.crm_status} /></div>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Priority</span>
                    <div className="mt-0.5"><PriorityBadge value={customer.priority} /></div>
                  </div>
                  {customer.source && (
                    <div>
                      <span className="text-xs text-muted block">Source</span>
                      <p className="text-ink">{customer.source}</p>
                    </div>
                  )}
                  {customer.interested_service && (
                    <div>
                      <span className="text-xs text-muted block">Interested Service</span>
                      <p className="text-ink">{customer.interested_service}</p>
                    </div>
                  )}
                  {customer.assigned_staff && (
                    <div>
                      <span className="text-xs text-muted block">Assigned Staff</span>
                      <p className="flex items-center gap-1 text-ink"><User size={12} />{customer.assigned_staff}</p>
                    </div>
                  )}
                  {customer.payment_status && (
                    <div>
                      <span className="text-xs text-muted block">Payment Status</span>
                      <div className="mt-0.5"><PaymentStatusBadge value={customer.payment_status} /></div>
                    </div>
                  )}
                  {customer.next_followup_date && (
                    <div>
                      <span className="text-xs text-muted block">Next Follow-up</span>
                      <p className="flex items-center gap-1 text-ink"><Clock size={12} />{fmtDate(customer.next_followup_date)}</p>
                    </div>
                  )}
                  {customer.last_followup_date && (
                    <div>
                      <span className="text-xs text-muted block">Last Follow-up</span>
                      <p className="text-ink">{fmtDate(customer.last_followup_date)}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-muted block">Customer Since</span>
                    <p className="text-ink">{fmtDate(customer.created_at)}</p>
                  </div>
                </div>
                {customer.requirement_details && (
                  <div className="mt-3 pt-3 border-t border-line">
                    <span className="text-xs text-muted flex items-center gap-1"><Tag size={11} /> Requirement</span>
                    <p className="text-sm text-ink mt-1">{customer.requirement_details}</p>
                  </div>
                )}
                {customer.notes && (
                  <div className="mt-3 pt-3 border-t border-line">
                    <span className="text-xs text-muted flex items-center gap-1"><MessageSquare size={11} /> Notes</span>
                    <p className="text-sm text-ink mt-1">{customer.notes}</p>
                  </div>
                )}
              </div>

              {/* Follow-up history (mini) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Follow-up History ({followups.length})
                  </h3>
                  {followups.length > 0 && (
                    <button onClick={() => setActiveTab("activity")}
                      className="text-xs text-accent hover:underline">View all →</button>
                  )}
                </div>
                {loading ? (
                  <p className="text-sm text-muted">Loading…</p>
                ) : followups.length === 0 ? (
                  <div className="bg-paper rounded-lg border border-line p-4 text-sm text-muted text-center">
                    No follow-ups recorded yet.
                    <button onClick={() => setShowInlineFollowup(true)}
                      className="block mx-auto mt-1.5 text-xs text-accent hover:underline">
                      Add first follow-up →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {followups.slice(0, 3).map((f, i) => {
                      const statusInfo = CRM_STATUSES.find(s => s.value === f.followup_status);
                      return (
                        <div key={f.id} className="relative pl-5">
                          {i < Math.min(followups.length, 3) - 1 && (
                            <div className="absolute left-[7px] top-5 bottom-0 w-px bg-line" />
                          )}
                          <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-accent-soft border-2 border-accent" />
                          <div className="bg-paper rounded-lg border border-line p-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-medium text-ink">{fmtMode(f.followup_mode)}</span>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo?.cls ?? "bg-zinc-100 text-zinc-500"}`}>
                                  {statusInfo?.label ?? f.followup_status}
                                </span>
                                <span className="text-xs text-muted">{fmtDate(f.created_at)}</span>
                              </div>
                            </div>
                            {f.notes && <p className="text-sm text-ink mt-1.5">{f.notes}</p>}
                            {f.next_followup_date && (
                              <p className="text-xs text-muted mt-1 flex items-center gap-1">
                                <Clock size={11} /> Next: {fmtDate(f.next_followup_date)}
                                {f.next_followup_time && ` at ${f.next_followup_time}`}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {followups.length > 3 && (
                      <button onClick={() => setActiveTab("activity")}
                        className="text-xs text-accent hover:underline w-full text-center py-1">
                        +{followups.length - 3} more follow-ups →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══════ ACTIVITY ═══════ */}
          {activeTab === "activity" && (
            <div>
              <p className="text-xs text-muted mb-4">Complete audit trail — creation and all follow-ups in order.</p>
              {loading ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : activities.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((a, i) => (
                    <div key={a.id} className="relative pl-5">
                      {i < activities.length - 1 && (
                        <div className="absolute left-[7px] top-5 bottom-0 w-px bg-line" />
                      )}
                      <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
                        a.type === "created"
                          ? "bg-blue-100 border-blue-400"
                          : a.mode === "payment"
                          ? "bg-emerald-100 border-emerald-500"
                          : "bg-accent-soft border-accent"
                      }`} />
                      <div className="bg-paper rounded-lg border border-line p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            {a.type === "created" ? (
                              <p className="text-xs font-medium text-ink flex items-center gap-1.5">
                                <Activity size={12} className="text-blue-500" /> Customer Created
                              </p>
                            ) : (
                              <p className="text-xs font-medium text-ink">{fmtMode(a.mode!)}</p>
                            )}
                            {a.status && (
                              <div className="mt-1">
                                {(() => {
                                  const s = CRM_STATUSES.find(x => x.value === a.status);
                                  return (
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s?.cls ?? "bg-zinc-100 text-zinc-500"}`}>
                                      {s?.label ?? a.status}
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                            {a.notes && <p className="text-sm text-ink mt-1.5">{a.notes}</p>}
                            {a.next_date && (
                              <p className="text-xs text-muted mt-1 flex items-center gap-1">
                                <Clock size={11} /> Next: {fmtDate(a.next_date)}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-muted whitespace-nowrap flex-shrink-0">{fmtDateTime(a.date)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════ PAYMENTS ═══════ */}
          {activeTab === "payments" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Payment Follow-up History
                </h3>
                <button onClick={() => setShowInlinePayment(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90">
                  <CreditCard size={12} /> Add Payment Follow-up
                </button>
              </div>

              {loading ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : paymentFollowups.length === 0 ? (
                <div className="bg-paper rounded-lg border border-line p-8 text-center">
                  <CreditCard size={28} className="mx-auto text-muted/30 mb-2" />
                  <p className="text-sm text-muted">No payment follow-ups recorded yet.</p>
                  <button onClick={() => setShowInlinePayment(true)}
                    className="mt-2 text-xs text-accent hover:underline">
                    Add first payment follow-up →
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentFollowups.map(pf => {
                    const balance = pf.balance_amount ?? (pf.invoice_amount - pf.paid_amount);
                    return (
                      <div key={pf.id} className={`bg-paper rounded-lg border p-4 ${balance > 0 ? "border-amber-200" : "border-emerald-200"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {pf.invoice_number && (
                              <p className="text-sm font-semibold text-ink">Invoice #{pf.invoice_number}</p>
                            )}
                            <div className="mt-2 flex items-center flex-wrap gap-3 text-xs">
                              <span className="flex items-center gap-0.5 text-ink font-medium">
                                <IndianRupee size={11} />{pf.invoice_amount.toLocaleString("en-IN")}
                                <span className="text-muted font-normal ml-1">invoiced</span>
                              </span>
                              {pf.paid_amount > 0 && (
                                <span className="text-emerald-700">
                                  ₹{pf.paid_amount.toLocaleString("en-IN")} paid
                                </span>
                              )}
                              {balance > 0 ? (
                                <span className="text-amber-700 font-semibold">
                                  ₹{balance.toLocaleString("en-IN")} due
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold">Fully paid ✓</span>
                              )}
                            </div>
                            {pf.payment_notes && (
                              <p className="text-sm text-ink mt-2">{pf.payment_notes}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <PaymentStatusBadge value={pf.payment_status} />
                              {pf.next_payment_followup_date && (
                                <span className="text-xs text-muted flex items-center gap-1">
                                  <Clock size={11} /> Next: {fmtDate(pf.next_payment_followup_date)}
                                </span>
                              )}
                              {pf.reminder_needed && (
                                <span className="text-xs text-orange-600 flex items-center gap-0.5">
                                  <AlertCircle size={10} /> Reminder set
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted whitespace-nowrap flex-shrink-0">
                            {fmtDate(pf.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════ INVOICES ═══════ */}
          {activeTab === "invoices" && (
            <div className="space-y-4">
              {unpaidInvoices.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-amber-800">
                      {unpaidInvoices.length} unpaid {unpaidInvoices.length === 1 ? "invoice" : "invoices"} — payment follow-up needed
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Outstanding: ₹{totalOutstanding.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <button onClick={() => setShowInlinePayment(true)}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700">
                    <CreditCard size={12} /> Follow-up
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {invoices.length === 0 ? "No invoices" : `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`}
                </h3>
                <button onClick={() => navigate("/billing")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line text-ink text-xs hover:bg-line/50">
                  <Receipt size={12} /> Create Invoice
                </button>
              </div>

              {loading ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : invoices.length === 0 ? (
                <div className="bg-paper rounded-lg border border-line p-6 text-center">
                  <FileText size={28} className="mx-auto text-muted/30 mb-2" />
                  <p className="text-sm text-muted">No invoices for this customer yet.</p>
                  <button onClick={() => navigate("/billing")}
                    className="mt-2 text-xs text-accent hover:underline">
                    Create first invoice →
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {invoices.map(inv => {
                    const balance = inv.total - inv.amount_paid;
                    const statusCls: Record<string, string> = {
                      paid: "bg-emerald-100 text-emerald-700",
                      sent: "bg-blue-100 text-blue-700",
                      draft: "bg-zinc-100 text-zinc-500",
                      void: "bg-red-100 text-red-600",
                    };
                    return (
                      <div key={inv.id}
                        className={`bg-paper rounded-lg border p-3 flex items-start justify-between gap-2 ${balance > 0.01 ? "border-amber-200" : "border-line"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink">{inv.invoice_number}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCls[inv.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                              {inv.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-0.5">
                            {inv.issue_date ? fmtDate(inv.issue_date) : "—"}
                            {inv.due_date ? ` · Due ${fmtDate(inv.due_date)}` : ""}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs">
                            <span className="text-ink flex items-center gap-0.5">
                              <IndianRupee size={10} />{inv.total.toLocaleString("en-IN")}
                            </span>
                            {inv.amount_paid > 0 && (
                              <span className="text-emerald-700">Paid: ₹{inv.amount_paid.toLocaleString("en-IN")}</span>
                            )}
                            {balance > 0.01 && (
                              <span className="text-amber-700 font-medium">Due: ₹{balance.toLocaleString("en-IN")}</span>
                            )}
                          </div>
                        </div>
                        {balance > 0.01 && (
                          <button onClick={() => setShowInlinePayment(true)} title="Payment Follow-up"
                            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs text-amber-700 border border-amber-300 hover:bg-amber-50">
                            <CreditCard size={11} /> Follow-up
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Inline Follow-up Modal (z-[70] — above drawer) ── */}
      {showInlineFollowup && (
        <AddFollowUpModal
          customer={customer}
          overlayClass="z-[70]"
          onClose={() => setShowInlineFollowup(false)}
          onSaved={() => {
            setShowInlineFollowup(false);
            setActiveTab("activity");
            void loadData(true);
          }}
        />
      )}

      {/* ── Inline Payment Follow-up Modal (z-[70]) ── */}
      {showInlinePayment && (
        <AddPaymentFollowupModal
          customer={customer}
          overlayClass="z-[70]"
          onClose={() => setShowInlinePayment(false)}
          onSaved={() => {
            setShowInlinePayment(false);
            setActiveTab("payments");
            void loadData(true);
          }}
        />
      )}
    </>
  );
}
