import { useState } from "react";
import { X, CreditCard, IndianRupee, CheckCircle2 } from "lucide-react";
import { api, type Customer, PAYMENT_STATUSES } from "../../lib/api";

interface Props {
  customer: Customer;
  onClose: () => void;
  onSaved: () => void;
  overlayClass?: string;
}

export default function AddPaymentFollowupModal({ customer, onClose, onSaved, overlayClass = "z-50" }: Props) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState<string>("");
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState("payment_pending");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [reminderNeeded, setReminderNeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const inv = parseFloat(invoiceAmount) || 0;
  const paid = parseFloat(paidAmount) || 0;
  const balance = Math.max(0, inv - paid);

  const inputCls = "mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";
  const labelCls = "block";
  const spanCls = "text-xs font-medium uppercase tracking-wide text-muted";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await api.addPaymentFollowup(customer.id, {
        invoice_number: invoiceNumber.trim() || null,
        invoice_amount: inv,
        paid_amount: paid,
        balance_amount: balance,
        payment_status: paymentStatus,
        payment_notes: paymentNotes.trim() || null,
        next_payment_followup_date: nextDate || null,
        reminder_needed: reminderNeeded,
      });
      setSuccess(true);
      setTimeout(() => { onSaved(); onClose(); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payment follow-up");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`fixed inset-0 bg-black/30 flex items-center justify-center ${overlayClass} p-4`}>
      <form onSubmit={handleSubmit}
        className="bg-surface border border-line rounded-lg w-full max-w-md shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-accent" />
            <div>
              <h2 className="font-semibold text-ink">Payment Follow-up</h2>
              <p className="text-xs text-muted mt-0.5">{customer.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">

          {/* Invoice details */}
          <label className={labelCls}>
            <span className={spanCls}>Invoice Number</span>
            <input className={inputCls} value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-2025-001" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              <span className={spanCls}>Invoice Amount (₹)</span>
              <div className="relative mt-1">
                <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="number" min="0" step="0.01"
                  className={`${inputCls} mt-0 pl-8`}
                  value={invoiceAmount}
                  onChange={e => setInvoiceAmount(e.target.value)}
                  placeholder="0.00" />
              </div>
            </label>
            <label className={labelCls}>
              <span className={spanCls}>Paid Amount (₹)</span>
              <div className="relative mt-1">
                <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="number" min="0" step="0.01"
                  className={`${inputCls} mt-0 pl-8`}
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                  placeholder="0.00" />
              </div>
            </label>
          </div>

          {/* Balance — auto-calculated */}
          <div className={`rounded-md px-3 py-2 text-sm border ${balance > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Balance Amount</span>
            <p className={`text-lg font-semibold mt-0.5 ${balance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
              ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            {balance === 0 && inv > 0 && <p className="text-xs text-emerald-600 mt-0.5">Fully paid ✓</p>}
          </div>

          {/* Payment Status */}
          <label className={labelCls}>
            <span className={spanCls}>Payment Status *</span>
            <select className={inputCls} value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
              {PAYMENT_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>

          {/* Payment Notes */}
          <label className={labelCls}>
            <span className={spanCls}>Payment Notes</span>
            <textarea rows={3} className={`${inputCls} resize-none`} value={paymentNotes}
              onChange={e => setPaymentNotes(e.target.value)}
              placeholder="e.g. Customer promised to pay by Friday. Cheque is ready." />
          </label>

          {/* Next follow-up date */}
          <label className={labelCls}>
            <span className={spanCls}>Next Payment Follow-up Date</span>
            <input type="date" className={inputCls} value={nextDate} onChange={e => setNextDate(e.target.value)} />
          </label>

          {/* Reminder */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input type="checkbox" className="rounded border-line"
              checked={reminderNeeded} onChange={e => setReminderNeeded(e.target.checked)} />
            <span className="text-sm text-ink">Set reminder for next payment follow-up</span>
          </label>

          {success && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 size={14} /> Payment follow-up saved!
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-line">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50 text-ink">
            Cancel
          </button>
          <button type="submit" disabled={saving || success}
            className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium disabled:opacity-60 flex items-center gap-2">
            <CreditCard size={14} />
            {saving ? "Saving…" : "Save Payment Follow-up"}
          </button>
        </div>
      </form>
    </div>
  );
}
