import { useState } from "react";
import { X, Tag } from "lucide-react";
import { api, type Customer, CRM_STATUSES, PRIORITIES, SOURCES, SERVICES } from "../../lib/api";

type Form = {
  name: string; company: string; phone: string; whatsapp: string; email: string; address: string;
  source: string; interested_service: string; requirement_details: string;
  priority: string; assigned_staff: string; crm_status: string;
  first_followup_date: string; first_followup_time: string; notes: string;
};

const blank = (): Form => ({
  name: "", company: "", phone: "", whatsapp: "", email: "", address: "",
  source: "", interested_service: "", requirement_details: "",
  priority: "medium", assigned_staff: "", crm_status: "new_lead",
  first_followup_date: "", first_followup_time: "", notes: "",
});

function fromCustomer(c: Customer): Form {
  return {
    name: c.name, company: c.company ?? "", phone: c.phone ?? "",
    whatsapp: c.whatsapp ?? "", email: c.email ?? "", address: c.address ?? "",
    source: c.source ?? "", interested_service: c.interested_service ?? "",
    requirement_details: c.requirement_details ?? "", priority: c.priority,
    assigned_staff: c.assigned_staff ?? "", crm_status: c.crm_status,
    first_followup_date: c.first_followup_date ?? "",
    first_followup_time: c.first_followup_time ?? "", notes: c.notes ?? "",
  };
}

const TAG_COLORS = [
  "bg-blue-100 text-blue-700", "bg-green-100 text-green-700",
  "bg-orange-100 text-orange-700", "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700", "bg-teal-100 text-teal-700",
];

interface Props {
  editing: Customer | null;
  existingCustomers?: Customer[];
  onClose: () => void;
  onSaved: () => void;
}

export default function AddCustomerModal({ editing, existingCustomers = [], onClose, onSaved }: Props) {
  const [form, setForm] = useState<Form>(editing ? fromCustomer(editing) : blank());
  const [tags, setTags] = useState<string[]>(editing?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const inputCls = "mt-1 w-full rounded-md input-3d px-3 py-2 text-sm outline-none focus:border-black";
  const labelCls = "block";
  const spanCls = "text-xs font-medium uppercase tracking-wide text-muted";

  function checkDuplicate(phone: string) {
    if (!phone.trim()) { setDuplicateWarning(null); return; }
    const match = existingCustomers.find(
      c => c.phone === phone.trim() && c.id !== editing?.id
    );
    setDuplicateWarning(match ? `⚠️ Duplicate: "${match.name}" already has this phone number.` : null);
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,$/, "");
      if (tag && !tags.includes(tag)) setTags(prev => [...prev, tag]);
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    setTags(prev => prev.filter(t => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Customer name is required"); return; }
    if (!form.phone.trim()) { setError("Phone number is required"); return; }
    setError(null); setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email || null,
        phone: form.phone.trim(),
        whatsapp: form.whatsapp || null,
        company: form.company || null,
        address: form.address || null,
        notes: form.notes || null,
        status: "active",
        crm_status: form.crm_status,
        priority: form.priority,
        source: form.source || null,
        interested_service: form.interested_service || null,
        requirement_details: form.requirement_details || null,
        assigned_staff: form.assigned_staff || null,
        first_followup_date: form.first_followup_date || null,
        first_followup_time: form.first_followup_time || null,
        tags,
        custom_fields: {},
      };
      if (editing) await api.updateCustomer(editing.id, payload);
      else await api.createCustomer(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit}
        className="card-3d w-full max-w-2xl shadow-xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line sticky top-0 bg-surface z-10">
          <div>
            <h2 className="font-semibold text-ink">{editing ? "Edit Customer" : "New Customer"}</h2>
            <p className="text-xs text-muted mt-0.5">Fill in the customer details below</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* Section 1: Personal & Company Details */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 pb-1 border-b border-line">
              Personal & Company Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className={`${labelCls} col-span-2`}>
                <span className={spanCls}>Customer Name *</span>
                <input className={inputCls} required value={form.name} onChange={e => set("name", e.target.value)} placeholder="Full name" />
              </label>
              <label className={labelCls}>
                <span className={spanCls}>Company Name</span>
                <input className={inputCls} value={form.company} onChange={e => set("company", e.target.value)} placeholder="Company" />
              </label>
              <label className={labelCls}>
                <span className={spanCls}>Phone Number *</span>
                <input className={inputCls} required value={form.phone}
                  onChange={e => { set("phone", e.target.value); setDuplicateWarning(null); }}
                  onBlur={e => checkDuplicate(e.target.value)}
                  placeholder="9876543210" />
                {duplicateWarning && (
                  <p className="mt-1 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">{duplicateWarning}</p>
                )}
              </label>
              <label className={labelCls}>
                <span className={spanCls}>WhatsApp Number</span>
                <input className={inputCls} value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} placeholder="Same as phone?" />
              </label>
              <label className={labelCls}>
                <span className={spanCls}>Email</span>
                <input type="email" className={inputCls} value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" />
              </label>
              <label className={`${labelCls} col-span-2`}>
                <span className={spanCls}>Address</span>
                <input className={inputCls} value={form.address} onChange={e => set("address", e.target.value)} placeholder="City / Full address" />
              </label>
            </div>
          </div>

          {/* Section 2: Customer Information */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 pb-1 border-b border-line">
              Customer Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className={labelCls}>
                <span className={spanCls}>Customer Source</span>
                <select className={inputCls} value={form.source} onChange={e => set("source", e.target.value)}>
                  <option value="">— Select source —</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className={labelCls}>
                <span className={spanCls}>Interested Service</span>
                <select className={inputCls} value={form.interested_service} onChange={e => set("interested_service", e.target.value)}>
                  <option value="">— Select service —</option>
                  {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className={`${labelCls} col-span-2`}>
                <span className={spanCls}>Requirement Details</span>
                <textarea rows={2} className={`${inputCls} resize-none`} value={form.requirement_details}
                  onChange={e => set("requirement_details", e.target.value)}
                  placeholder="What does the customer need?" />
              </label>

              {/* Tags Input */}
              <div className="col-span-2">
                <span className={`${spanCls} flex items-center gap-1`}><Tag size={11} /> Tags</span>
                <div className="mt-1 min-h-[38px] flex flex-wrap gap-1.5 items-center rounded-md input-3d px-3 py-2 focus-within:border-black">
                  {tags.map((tag, i) => (
                    <span key={tag}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TAG_COLORS[i % TAG_COLORS.length]}`}>
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="hover:opacity-70 leading-none">×</button>
                    </span>
                  ))}
                  <input
                    className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-muted/50"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder={tags.length === 0 ? "Type a tag, press Enter…" : "Add more…"}
                  />
                </div>
                <p className="text-xs text-muted/70 mt-0.5">Press Enter or comma to add each tag</p>
              </div>
            </div>
          </div>

          {/* Section 3: Follow-up Setup */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 pb-1 border-b border-line">
              Follow-up Setup
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className={labelCls}>
                <span className={spanCls}>Priority</span>
                <select className={inputCls} value={form.priority} onChange={e => set("priority", e.target.value)}>
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              <label className={labelCls}>
                <span className={spanCls}>Assigned Staff</span>
                <input className={inputCls} value={form.assigned_staff} onChange={e => set("assigned_staff", e.target.value)} placeholder="Staff name" />
              </label>
              <label className={labelCls}>
                <span className={spanCls}>Status</span>
                <select className={inputCls} value={form.crm_status} onChange={e => set("crm_status", e.target.value)}>
                  {CRM_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <label className={labelCls}>
                <span className={spanCls}>First Follow-up Date</span>
                <input type="date" className={inputCls} value={form.first_followup_date} onChange={e => set("first_followup_date", e.target.value)} />
              </label>
              <label className={labelCls}>
                <span className={spanCls}>Follow-up Time</span>
                <input type="time" className={inputCls} value={form.first_followup_time} onChange={e => set("first_followup_time", e.target.value)} />
              </label>
              <label className={`${labelCls} col-span-2`}>
                <span className={spanCls}>Notes</span>
                <textarea rows={2} className={`${inputCls} resize-none`} value={form.notes}
                  onChange={e => set("notes", e.target.value)} placeholder="Any additional notes…" />
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-6 py-4 border-t border-line bg-surface sticky bottom-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50 text-ink">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-black text-white font-medium disabled:opacity-60">
            {saving ? "Saving…" : editing ? "Save Changes" : "Create Customer"}
          </button>
        </div>
      </form>
    </div>
  );
}
