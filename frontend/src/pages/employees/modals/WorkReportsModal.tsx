import { useEffect, useState } from "react";
import { X, Plus, Trash2, FileText, MessageCircle } from "lucide-react";
import { api, type EmployeeWorkReport } from "../../../lib/api";
import { WhatsAppPreviewModal } from "./WhatsAppPreviewModal";
import { workReportWaMessage } from "./waTemplates";

interface Props {
  employeeId: string;
  employeeName: string;
  employeePhone?: string | null;
  onClose: () => void;
}

const REPORT_TYPES = ["daily", "weekly", "monthly", "project"];
const STATUSES = ["submitted", "approved", "rejected", "pending"];

const blank = {
  report_date: new Date().toISOString().split("T")[0],
  report_type: "daily", work_type: "", project_client: "",
  work_summary: "", hours_worked: "", status: "submitted", manager_remarks: "", sendWa: false,
};

export function WorkReportsModal({ employeeId, employeeName, employeePhone, onClose }: Props) {
  const [reports, setReports] = useState<EmployeeWorkReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);
  const [waReport, setWaReport] = useState<EmployeeWorkReport | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setReports(await api.listWorkReports(employeeId)); } catch { /* */ }
    setLoading(false);
  }

  async function save() {
    if (!form.report_date) return;
    setSaving(true);
    try {
      const saved = await api.createWorkReport(employeeId, {
        report_date: form.report_date, report_type: form.report_type,
        work_type: form.work_type || null, project_client: form.project_client || null,
        work_summary: form.work_summary || null,
        hours_worked: form.hours_worked ? parseFloat(form.hours_worked) : null,
        status: form.status, manager_remarks: form.manager_remarks || null,
      });
      setShowForm(false);
      setForm({ ...blank });
      await load();
      if (form.sendWa) setWaReport(saved as EmployeeWorkReport);
    } catch { /* */ }
    setSaving(false);
  }

  async function del(id: string) {
    if (!confirm("Delete this report?")) return;
    await api.deleteWorkReport(employeeId, id);
    setReports(r => r.filter(x => x.id !== id));
  }

  const statusColor = (s: string) =>
    s === "approved" ? "bg-green-100 text-green-700" : s === "rejected" ? "bg-red-100 text-red-700"
    : s === "submitted" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600";

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-accent" />
              <h2 className="text-base font-semibold text-ink">Work Reports — {employeeName}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent/90">
                <Plus size={14} /> Add Report
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>
          </div>

          {showForm && (
            <div className="px-6 py-4 border-b border-line bg-surface/50">
              <h3 className="text-sm font-medium text-ink mb-3">New Work Report</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted mb-1 block">Report Date *</label>
                  <input type="date" className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.report_date} onChange={e => setForm(f => ({ ...f, report_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Report Type</label>
                  <select className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}>
                    {REPORT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Work Type</label>
                  <input className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.work_type} onChange={e => setForm(f => ({ ...f, work_type: e.target.value }))} placeholder="e.g. Development" />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Project / Client</label>
                  <input className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.project_client} onChange={e => setForm(f => ({ ...f, project_client: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Work Summary</label>
                  <textarea className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                    rows={3} value={form.work_summary} onChange={e => setForm(f => ({ ...f, work_summary: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Hours Worked</label>
                  <input type="number" min="0" step="0.5" className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.hours_worked} onChange={e => setForm(f => ({ ...f, hours_worked: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Status</label>
                  <select className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Manager Remarks</label>
                  <textarea className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                    rows={2} value={form.manager_remarks} onChange={e => setForm(f => ({ ...f, manager_remarks: e.target.value }))} />
                </div>
                {/* WhatsApp checkbox */}
                <div className="col-span-2 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <input type="checkbox" id="send_wa_rep" checked={form.sendWa}
                    onChange={e => setForm(f => ({ ...f, sendWa: e.target.checked }))}
                    className="w-4 h-4" style={{ accentColor: "#16a34a" }} />
                  <label htmlFor="send_wa_rep" className="flex items-center gap-1.5 text-sm text-green-800 cursor-pointer select-none">
                    <MessageCircle size={14} className="text-green-600" />
                    Send WhatsApp notification to employee after saving
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={save} disabled={saving || !form.report_date}
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
            ) : reports.length === 0 ? (
              <div className="text-center py-8 text-muted text-sm">No reports yet.</div>
            ) : (
              <div className="space-y-3">
                {reports.map(r => (
                  <div key={r.id} className="border border-line rounded-xl p-4 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-ink">{r.report_date}</span>
                          {r.report_type && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{r.report_type}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(r.status)}`}>{r.status}</span>
                        </div>
                        {r.work_summary && <p className="text-xs text-muted mt-1 line-clamp-2">{r.work_summary}</p>}
                        <div className="flex gap-3 mt-1 flex-wrap">
                          {r.project_client && <span className="text-xs text-muted">📁 {r.project_client}</span>}
                          {r.hours_worked != null && <span className="text-xs text-muted">⏱ {r.hours_worked}h</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setWaReport(r)} title="Send via WhatsApp"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-muted hover:text-green-600">
                          <MessageCircle size={14} />
                        </button>
                        <button onClick={() => del(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-danger">
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

      {waReport && (
        <WhatsAppPreviewModal
          phone={employeePhone}
          employeeId={employeeId}
          employeeName={employeeName}
          message={workReportWaMessage(employeeName, waReport)}
          subject={`Work Report: ${waReport.report_date}`}
          relatedModule="work_report"
          relatedRecordId={waReport.id}
          onClose={() => setWaReport(null)}
        />
      )}
    </>
  );
}
