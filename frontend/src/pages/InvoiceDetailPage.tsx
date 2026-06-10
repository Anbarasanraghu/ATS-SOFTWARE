import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { api, type Invoice } from "../lib/api";

const STATUS_CLS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  sent:  "bg-sky-100 text-sky-700",
  paid:  "bg-emerald-100 text-emerald-700",
  void:  "bg-red-100 text-red-600",
};

const TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  draft: [{ label: "Mark as Sent", next: "sent" }, { label: "Void", next: "void" }],
  sent:  [{ label: "Mark as Paid", next: "paid" }, { label: "Void",   next: "void" }],
  paid:  [],
  void:  [],
};

const METHODS = ["cash", "bank_transfer", "card", "cheque", "other"];

export default function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice]       = useState<Invoice | null>(null);
  const [notFound, setNotFound]     = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [pmtForm, setPmtForm]       = useState({ amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "cash", reference: "", notes: "" });
  const [pmtError, setPmtError]     = useState<string | null>(null);

  async function load() {
    try { setInvoice(await api.getInvoice(id)); }
    catch { setNotFound(true); }
  }
  useEffect(() => { void load(); }, [id]);

  async function changeStatus(next: string) {
    try { setInvoice(await api.updateInvoiceStatus(id, next)); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleDelete() {
    if (!confirm("Delete this draft invoice?")) return;
    try { await api.deleteInvoice(id); navigate("/billing"); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  async function submitPayment(e: { preventDefault(): void }) {
    e.preventDefault(); setPmtError(null);
    try {
      await api.recordPayment(id, {
        amount: Number(pmtForm.amount),
        payment_date: pmtForm.payment_date,
        method: pmtForm.method,
        reference: pmtForm.reference || null,
        notes: pmtForm.notes || null,
      });
      setShowPayment(false);
      await load();
    } catch (err) { setPmtError(err instanceof Error ? err.message : "Failed"); }
  }

  async function deletePayment(paymentId: string) {
    if (!confirm("Remove this payment?")) return;
    try { await api.deletePayment(id, paymentId); await load(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  if (notFound) return (
    <div className="space-y-4">
      <button onClick={() => navigate("/billing")} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Invoices
      </button>
      <p className="text-danger">Invoice not found.</p>
    </div>
  );
  if (!invoice) return <div className="text-muted text-sm p-4">Loading…</div>;

  const transitions = TRANSITIONS[invoice.status] ?? [];
  const inputCls = "mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/billing")} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Invoices
      </button>

      <div className="bg-surface border border-line rounded-lg p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-muted uppercase tracking-wide">Invoice</div>
            <div className="text-2xl font-bold font-mono mt-1">{invoice.invoice_number}</div>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_CLS[invoice.status] ?? ""}`}>
            {invoice.status}
          </span>
        </div>

        {/* Customer & dates */}
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Customer</div>
            <div className="font-medium">{invoice.customer_name}</div>
            {invoice.customer_email && <div className="text-muted">{invoice.customer_email}</div>}
          </div>
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Issue Date</div>
            <div>{invoice.issue_date}</div>
          </div>
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Due Date</div>
            <div>{invoice.due_date ?? "—"}</div>
          </div>
        </div>

        {/* Line items */}
        {invoice.items && invoice.items.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Line Items</div>
            <div className="rounded-lg border border-line overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-paper border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-right w-20">Qty</th>
                    <th className="px-4 py-2 text-right w-28">Unit Price</th>
                    <th className="px-4 py-2 text-right w-20">Tax %</th>
                    <th className="px-4 py-2 text-right w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono">{Number(item.unit_price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">{item.tax_percent}%</td>
                      <td className="px-4 py-3 text-right font-mono">{Number(item.line_total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between text-muted"><span>Subtotal</span><span>{Number(invoice.subtotal).toFixed(2)}</span></div>
            <div className="flex justify-between text-muted"><span>Tax</span><span>{Number(invoice.tax_total).toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold border-t border-line pt-1 text-base"><span>Total</span><span>{Number(invoice.total).toFixed(2)}</span></div>
            <div className="flex justify-between text-emerald-700"><span>Paid</span><span>{Number(invoice.amount_paid).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-line pt-1">
              <span>Balance Due</span><span className={invoice.balance_due > 0 ? "text-danger" : "text-emerald-700"}>{Number(invoice.balance_due).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payments */}
        {(invoice.payments && invoice.payments.length > 0 || invoice.status !== "void") && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Payments</div>
              {invoice.status !== "void" && invoice.status !== "paid" && (
                <button onClick={() => { setShowPayment(true); setPmtError(null); setPmtForm({ amount: String(invoice.balance_due), payment_date: new Date().toISOString().slice(0, 10), method: "cash", reference: "", notes: "" }); }}
                  className="flex items-center gap-1 text-xs text-accent hover:underline">
                  <Plus size={12} /> Record payment
                </button>
              )}
            </div>
            {(!invoice.payments || invoice.payments.length === 0) ? (
              <p className="text-sm text-muted">No payments yet.</p>
            ) : (
              <div className="rounded-lg border border-line divide-y divide-line">
                {invoice.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <span className="font-mono font-semibold">{Number(p.amount).toFixed(2)}</span>
                      <span className="text-muted ml-2">{p.method.replace("_", " ")}</span>
                      {p.reference && <span className="text-muted ml-2">· {p.reference}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-muted">
                      <span>{p.payment_date}</span>
                      <button onClick={() => deletePayment(p.id)} className="hover:text-danger"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Notes</div>
            <p className="text-sm whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-line flex-wrap">
          {transitions.map((t) => (
            <button key={t.next} onClick={() => changeStatus(t.next)}
              className="rounded-md border border-line px-4 py-2 text-sm hover:bg-line/50">
              {t.label}
            </button>
          ))}
          {invoice.status === "draft" && (
            <button onClick={handleDelete}
              className="ml-auto flex items-center gap-2 text-sm text-danger hover:underline">
              <Trash2 size={15} /> Delete Invoice
            </button>
          )}
        </div>
      </div>

      {/* Payment modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <form onSubmit={submitPayment}
            className="bg-surface border border-line rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Record Payment</h2>
              <button type="button" onClick={() => setShowPayment(false)} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Amount *</span>
              <input type="number" step="0.01" min="0.01" required className={inputCls}
                value={pmtForm.amount} onChange={(e) => setPmtForm({ ...pmtForm, amount: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Date *</span>
              <input type="date" required className={inputCls}
                value={pmtForm.payment_date} onChange={(e) => setPmtForm({ ...pmtForm, payment_date: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Method</span>
              <select className={inputCls} value={pmtForm.method} onChange={(e) => setPmtForm({ ...pmtForm, method: e.target.value })}>
                {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Reference</span>
              <input className={inputCls} value={pmtForm.reference} onChange={(e) => setPmtForm({ ...pmtForm, reference: e.target.value })} />
            </label>
            {pmtError && <p className="text-sm text-danger">{pmtError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowPayment(false)} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
