import { useEffect, useState } from "react";
import { X, Plus, Trash2, Phone, MessageCircle } from "lucide-react";
import { api, type EmployeeCallLog } from "../../../lib/api";
import { WhatsAppPreviewModal } from "./WhatsAppPreviewModal";
import { callLogWaMessage } from "./waTemplates";

interface Props {
  employeeId: string;
  employeeName: string;
  employeePhone?: string | null;
  onClose: () => void;
}

const CALL_TYPES = ["inbound", "outbound", "missed", "follow-up"];
const CALL_STATUSES = ["completed", "pending", "failed", "voicemail"];

const blank = {
  call_date: new Date().toISOString().split("T")[0],
  customer_client_name: "", phone_number: "", call_type: "outbound",
  call_status: "completed", duration: "", notes: "",
  followup_required: false, next_followup_date: "", sendWa: false,
};

export function CallRegisterModal({ employeeId, employeeName, employeePhone, onClose }: Props) {
  const [logs, setLogs] = useState<EmployeeCallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);
  const [waLog, setWaLog] = useState<EmployeeCallLog | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setLogs(await api.listCallLogs(employeeId)); } catch { /* */ }
    setLoading(false);
  }

  async function save() {
    if (!form.call_date) return;
    setSaving(true);
    try {
      const saved = await api.createCallLog(employeeId, {
        call_date: form.call_date,
        customer_client_name: form.customer_client_name || null,
        phone_number: form.phone_number || null,
        call_type: form.call_type, call_status: form.call_status,
        duration: form.duration || null, notes: form.notes || null,
        followup_required: form.followup_required,
        next_followup_date: form.next_followup_date || null,
      });
      setShowForm(false);
      setForm({ ...blank });
      await load();
      if (form.sendWa) setWaLog(saved as EmployeeCallLog);
    } catch { /* */ }
    setSaving(false);
  }

  async function del(id: string) {
    if (!confirm("Delete this call log?")) return;
    await api.deleteCallLog(employeeId, id);
    setLogs(l => l.filter(x => x.id !== id));
  }

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line">
            <div className="flex items-center gap-2">
              <Phone size={18} className="text-accent" />
              <h2 className="text-base font-semibold text-ink">Call Register — {employeeName}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent/90">
                <Plus size={14} /> Log Call
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>
          </div>

          {showForm && (
            <div className="px-6 py-4 border-b border-line bg-surface/50">
              <h3 className="text-sm font-medium text-ink mb-3">New Call Log</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted mb-1 block">Call Date *</label>
                  <input type="date" className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.call_date} onChange={e => setForm(f => ({ ...f, call_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Client / Customer</label>
                  <input className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.customer_client_name} onChange={e => setForm(f => ({ ...f, customer_client_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Phone Number</label>
                  <input className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Duration</label>
                  <input className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 5 min" />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Call Type</label>
                  <select className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.call_type} onChange={e => setForm(f => ({ ...f, call_type: e.target.value }))}>
                    {CALL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Status</label>
                  <select className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.call_status} onChange={e => setForm(f => ({ ...f, call_status: e.target.value }))}>
                    {CALL_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Notes</label>
                  <textarea className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                    rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="followup_req" checked={form.followup_required}
                    onChange={e => setForm(f => ({ ...f, followup_required: e.target.checked }))}
                    className="accent-accent w-4 h-4" />
                  <label htmlFor="followup_req" className="text-sm text-ink">Follow-up required</label>
                </div>
                {form.followup_required && (
                  <div>
                    <label className="text-xs text-muted mb-1 block">Next Follow-up Date</label>
                    <input type="date" className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                      value={form.next_followup_date} onChange={e => setForm(f => ({ ...f, next_followup_date: e.target.value }))} />
                  </div>
                )}
                {/* WhatsApp checkbox */}
                <div className="col-span-2 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <input type="checkbox" id="send_wa_call" checked={form.sendWa}
                    onChange={e => setForm(f => ({ ...f, sendWa: e.target.checked }))}
                    className="w-4 h-4" style={{ accentColor: "#16a34a" }} />
                  <label htmlFor="send_wa_call" className="flex items-center gap-1.5 text-sm text-green-800 cursor-pointer select-none">
                    <MessageCircle size={14} className="text-green-600" />
                    Send WhatsApp notification to employee after saving
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={save} disabled={saving || !form.call_date}
                  className="px-4 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent/90 disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-1.5 border border-line text-sm rounded-lg hover:bg-surface">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="text-center py-8 text-muted text-sm">Loading…</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted text-sm">No call logs yet.</div>
            ) : (
              <div className="space-y-3">
                {logs.map(l => (
                  <div key={l.id} className="border border-line rounded-xl p-4 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-ink">{l.customer_client_name || "Unknown"}</span>
                          {l.call_type && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{l.call_type}</span>}
                          {l.call_status && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{l.call_status}</span>}
                        </div>
                        <div className="flex gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-muted">📅 {l.call_date}</span>
                          {l.phone_number && <span className="text-xs text-muted">📞 {l.phone_number}</span>}
                          {l.duration && <span className="text-xs text-muted">⏱ {l.duration}</span>}
                          {l.followup_required && <span className="text-xs text-orange-600 font-medium">⚠ Follow-up{l.next_followup_date ? ` on ${l.next_followup_date}` : ""}</span>}
                        </div>
                        {l.notes && <p className="text-xs text-muted mt-1">{l.notes}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setWaLog(l)} title="Send via WhatsApp"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-muted hover:text-green-600">
                          <MessageCircle size={14} />
                        </button>
                        <button onClick={() => del(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-danger">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {waLog && (
        <WhatsAppPreviewModal
          phone={employeePhone}
          employeeId={employeeId}
          employeeName={employeeName}
          message={callLogWaMessage(employeeName, waLog)}
          subject={`Call Register: ${waLog.customer_client_name || waLog.call_date}`}
          relatedModule="call_register"
          relatedRecordId={waLog.id}
          onClose={() => setWaLog(null)}
        />
      )}
    </>
  );
}
