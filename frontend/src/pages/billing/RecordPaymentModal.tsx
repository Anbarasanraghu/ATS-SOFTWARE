import { useState } from "react";
import { X, CreditCard } from "lucide-react";
import { api, type Invoice } from "../../lib/api";

interface Props {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}

const METHODS = [
  { value: "cash",          label: "Cash" },
  { value: "upi",           label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card",          label: "Card" },
  { value: "cheque",        label: "Cheque" },
  { value: "other",         label: "Other" },
];

const fmt = (n: number) => Number(n).toFixed(2);

export function RecordPaymentModal({ invoice, onClose, onSuccess }: Props) {
  const [amount, setAmount]           = useState("");
  const [method, setMethod]           = useState("cash");
  const [transactionId, setTransId]   = useState("");
  const [paymentDate, setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]             = useState("");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  const newAmt       = parseFloat(amount) || 0;
  const balanceDue   = Number(invoice.balance_due);
  const newBalance   = Math.max(0, balanceDue - newAmt);
  const totalPaidNow = Number(invoice.amount_paid) + newAmt;
  const newPayStatus =
    totalPaidNow >= Number(invoice.total) - 0.001 ? "Paid" :
    totalPaidNow > 0 ? "Partially Paid" : "Unpaid";

  async function save() {
    if (newAmt <= 0)              { setError("Enter a valid payment amount"); return; }
    if (newAmt > balanceDue + 0.001) { setError(`Exceeds balance due (₹${fmt(balanceDue)})`); return; }
    setSaving(true);
    setError("");
    try {
      await api.recordPayment(invoice.id, {
        amount: newAmt,
        payment_date: paymentDate,
        method,
        reference: transactionId || null,
        notes: notes || null,
      });
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to record payment");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-accent" />
            <h2 className="text-base font-semibold text-ink">Record Payment</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Invoice summary */}
          <div className="bg-surface rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Invoice No</span>
              <span className="font-mono font-medium text-ink">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Customer</span>
              <span className="font-medium text-ink">{invoice.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Total Amount</span>
              <span className="font-semibold text-ink">₹{fmt(invoice.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Already Paid</span>
              <span className="text-emerald-600 font-medium">₹{fmt(invoice.amount_paid)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2">
              <span className="font-medium text-muted">Balance Due</span>
              <span className="text-danger font-bold">₹{fmt(invoice.balance_due)}</span>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs text-muted mb-1 block">New Payment Amount *</label>
            <input
              type="number" min="0.01" step="0.01"
              className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder={`Max ₹${fmt(balanceDue)}`}
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          {/* Method */}
          <div>
            <label className="text-xs text-muted mb-1 block">Payment Method</label>
            <select
              className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              value={method} onChange={e => setMethod(e.target.value)}>
              {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Transaction ID */}
          <div>
            <label className="text-xs text-muted mb-1 block">Transaction ID / Reference</label>
            <input
              className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Optional"
              value={transactionId} onChange={e => setTransId(e.target.value)}
            />
          </div>

          {/* Date */}
          <div>
            <label className="text-xs text-muted mb-1 block">Payment Date</label>
            <input
              type="date"
              className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              value={paymentDate} onChange={e => setDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-muted mb-1 block">Notes</label>
            <textarea
              className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
              rows={2} placeholder="Optional"
              value={notes} onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Live balance preview */}
          {newAmt > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted">Balance After Payment</span>
                <span className={`font-bold ${newBalance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  ₹{fmt(newBalance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Payment Status</span>
                <span className={`font-semibold ${
                  newPayStatus === "Paid" ? "text-emerald-600" :
                  newPayStatus === "Partially Paid" ? "text-amber-600" : "text-muted"
                }`}>{newPayStatus}</span>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-line rounded-xl text-sm hover:bg-surface">
            Cancel
          </button>
          <button onClick={save} disabled={saving || newAmt <= 0}
            className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent/90 disabled:opacity-50">
            {saving ? "Saving…" : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
