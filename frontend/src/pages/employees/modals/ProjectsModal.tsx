import { useEffect, useState } from "react";
import { X, Plus, Trash2, Briefcase, MessageCircle } from "lucide-react";
import { api, type EmployeeProject } from "../../../lib/api";
import { WhatsAppPreviewModal } from "./WhatsAppPreviewModal";
import { projectWaMessage } from "./waTemplates";

interface Props {
  employeeId: string;
  employeeName: string;
  employeePhone?: string | null;
  onClose: () => void;
}

const STATUSES = ["active", "completed", "on_hold", "cancelled"];

const blank = {
  project_name: "", client_name: "", employee_role: "",
  start_date: "", end_date: "", status: "active", project_notes: "", sendWa: false,
};

export function ProjectsModal({ employeeId, employeeName, employeePhone, onClose }: Props) {
  const [projects, setProjects] = useState<EmployeeProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);
  const [waProject, setWaProject] = useState<EmployeeProject | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setProjects(await api.listEmployeeProjects(employeeId)); } catch { /* */ }
    setLoading(false);
  }

  async function save() {
    if (!form.project_name.trim()) return;
    setSaving(true);
    try {
      const saved = await api.createEmployeeProject(employeeId, {
        project_name: form.project_name, client_name: form.client_name || null,
        employee_role: form.employee_role || null, start_date: form.start_date || null,
        end_date: form.end_date || null, status: form.status,
        project_notes: form.project_notes || null,
      });
      setShowForm(false);
      setForm({ ...blank });
      await load();
      if (form.sendWa) setWaProject(saved as EmployeeProject);
    } catch { /* */ }
    setSaving(false);
  }

  async function del(id: string) {
    if (!confirm("Delete this project?")) return;
    await api.deleteEmployeeProject(employeeId, id);
    setProjects(p => p.filter(x => x.id !== id));
  }

  const statusColor = (s: string) =>
    s === "completed" ? "bg-green-100 text-green-700" : s === "active" ? "bg-blue-100 text-blue-700"
    : s === "on_hold" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line">
            <div className="flex items-center gap-2">
              <Briefcase size={18} className="text-accent" />
              <h2 className="text-base font-semibold text-ink">Projects — {employeeName}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent/90">
                <Plus size={14} /> Add Project
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>
          </div>

          {showForm && (
            <div className="px-6 py-4 border-b border-line bg-surface/50">
              <h3 className="text-sm font-medium text-ink mb-3">New Project</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Project Name *</label>
                  <input className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.project_name} onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Client</label>
                  <input className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Role</label>
                  <input className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.employee_role} onChange={e => setForm(f => ({ ...f, employee_role: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Start Date</label>
                  <input type="date" className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">End Date</label>
                  <input type="date" className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Status</label>
                  <select className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Project Notes</label>
                  <textarea className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                    rows={2} value={form.project_notes} onChange={e => setForm(f => ({ ...f, project_notes: e.target.value }))} />
                </div>
                {/* WhatsApp checkbox */}
                <div className="col-span-2 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <input type="checkbox" id="send_wa_proj" checked={form.sendWa}
                    onChange={e => setForm(f => ({ ...f, sendWa: e.target.checked }))}
                    className="w-4 h-4" style={{ accentColor: "#16a34a" }} />
                  <label htmlFor="send_wa_proj" className="flex items-center gap-1.5 text-sm text-green-800 cursor-pointer select-none">
                    <MessageCircle size={14} className="text-green-600" />
                    Send WhatsApp notification to employee after saving
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={save} disabled={saving || !form.project_name.trim()}
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
            ) : projects.length === 0 ? (
              <div className="text-center py-8 text-muted text-sm">No projects yet.</div>
            ) : (
              <div className="space-y-3">
                {projects.map(p => (
                  <div key={p.id} className="border border-line rounded-xl p-4 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-ink">{p.project_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(p.status)}`}>
                            {p.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="flex gap-3 mt-1 flex-wrap">
                          {p.client_name && <span className="text-xs text-muted">🏢 {p.client_name}</span>}
                          {p.employee_role && <span className="text-xs text-muted">👤 {p.employee_role}</span>}
                          {p.start_date && <span className="text-xs text-muted">📅 {p.start_date}{p.end_date ? ` → ${p.end_date}` : ""}</span>}
                        </div>
                        {p.project_notes && <p className="text-xs text-muted mt-1">{p.project_notes}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setWaProject(p)} title="Send via WhatsApp"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-muted hover:text-green-600">
                          <MessageCircle size={14} />
                        </button>
                        <button onClick={() => del(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-danger">
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

      {waProject && (
        <WhatsAppPreviewModal
          phone={employeePhone}
          employeeId={employeeId}
          employeeName={employeeName}
          message={projectWaMessage(employeeName, waProject)}
          subject={`Project: ${waProject.project_name}`}
          relatedModule="project"
          relatedRecordId={waProject.id}
          onClose={() => setWaProject(null)}
        />
      )}
    </>
  );
}
