import { useState } from "react";
import { X } from "lucide-react";
import { api, type Customer, type CustomerFollowup, CRM_STATUSES, FOLLOWUP_MODES } from "../../lib/api";

interface Props {
  customer: Customer;
  onClose: () => void;
  onSaved: (followup: CustomerFollowup) => void;
  overlayClass?: string;
}

type Form = {
  followup_mode: string;
  followup_status: string;
  notes: string;
  next_followup_date: string;
  next_followup_time: string;
  reminder_needed: boolean;
};

const blank = (currentStatus: string): Form => ({
  followup_mode: "call",
  followup_status: currentStatus,
  notes: "",
  next_followup_date: "",
  next_followup_time: "",
  reminder_needed: false,
});

const FOLLOWUP_STATUSES = CRM_STATUSES.filter(s => s.value !== "new_lead");

const MODE_LABELS: Record<string, string> = {
  call: "📞 Call", whatsapp: "💬 WhatsApp", email: "📧 Email",
  meeting: "🤝 Meeting", payment: "💰 Payment Follow-up",
};

export default function AddFollowUpModal({ customer, onClose, onSaved, overlayClass = "z-50" }: Props) {
  const [form, setForm] = useState<Form>(blank(customer.crm_status));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  const inputCls = "mt-1 w-full rounded-md input-3d px-3 py-2 text-sm outline-none focus:border-black";
  const labelCls = "block";
  const spanCls = "text-xs font-medium uppercase tracking-wide text-muted";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.followup_status) { setError("Follow-up status is required"); return; }
    setError(null); setSaving(true);
    try {
      const result = await api.addFollowup(customer.id, {
        followup_mode: form.followup_mode,
        followup_status: form.followup_status,
        notes: form.notes || null,
        next_followup_date: form.next_followup_date || null,
        next_followup_time: form.next_followup_time || null,
        reminder_needed: form.reminder_needed,
      });
      onSaved(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`fixed inset-0 bg-black/30 flex items-center justify-center ${overlayClass} p-4`}>
      <form onSubmit={handleSubmit}
        className="card-3d w-full max-w-md shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <h2 className="font-semibold text-ink">Add Follow-up</h2>
            <p className="text-xs text-muted mt-0.5">{customer.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              <span className={spanCls}>Follow-up Mode</span>
              <select className={inputCls} value={form.followup_mode} onChange={e => set("followup_mode", e.target.value)}>
                {FOLLOWUP_MODES.map(m => (
                  <option key={m} value={m.toLowerCase()}>
                    {MODE_LABELS[m.toLowerCase()] ?? m}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              <span className={spanCls}>Follow-up Status *</span>
              <select className={inputCls} value={form.followup_status} onChange={e => set("followup_status", e.target.value)}>
                <option value="">— Select —</option>
                {FOLLOWUP_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className={labelCls}>
            <span className={spanCls}>Notes / Conversation Details</span>
            <textarea rows={3} className={`${inputCls} resize-none`}
              value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="What was discussed? Any updates?" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              <span className={spanCls}>Next Follow-up Date</span>
              <input type="date" className={inputCls} value={form.next_followup_date}
                onChange={e => set("next_followup_date", e.target.value)} />
            </label>
            <label className={labelCls}>
              <span className={spanCls}>Next Follow-up Time</span>
              <input type="time" className={inputCls} value={form.next_followup_time}
                onChange={e => set("next_followup_time", e.target.value)} />
            </label>
          </div>

          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" className="rounded border-line"
              checked={form.reminder_needed} onChange={e => set("reminder_needed", e.target.checked)} />
            <span className="text-sm text-ink">Set reminder for next follow-up</span>
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-line">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50 text-ink">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-black text-white font-medium disabled:opacity-60">
            {saving ? "Saving…" : "Save Follow-up"}
          </button>
        </div>
      </form>
    </div>
  );
}
