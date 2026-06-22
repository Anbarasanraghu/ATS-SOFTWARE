import { useEffect, useState } from "react";
import { X, Plus, Trash2, CheckSquare, MessageCircle } from "lucide-react";
import { api, type EmployeeTask } from "../../../lib/api";
import { WhatsAppPreviewModal } from "./WhatsAppPreviewModal";
import { taskWaMessage } from "./waTemplates";

interface Props {
  employeeId: string;
  employeeName: string;
  employeePhone?: string | null;
  onClose: () => void;
}

const PRIORITIES = ["low", "medium", "high", "urgent"];
const STATUSES = ["pending", "in_progress", "completed", "cancelled"];

const blank = {
  title: "", description: "", project_client: "", priority: "medium",
  status: "pending", due_date: "", assigned_by: "", notify_employee: false,
  employee_remarks: "", sendWa: false,
};

export function TasksModal({ employeeId, employeeName, employeePhone, onClose }: Props) {
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);
  const [waTask, setWaTask] = useState<EmployeeTask | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setTasks(await api.listEmployeeTasks(employeeId)); } catch { /* */ }
    setLoading(false);
  }

  function openNew() { setForm({ ...blank }); setEditId(null); setShowForm(true); }
  function openEdit(t: EmployeeTask) {
    setForm({
      title: t.title, description: t.description || "", project_client: t.project_client || "",
      priority: t.priority, status: t.status, due_date: t.due_date || "",
      assigned_by: t.assigned_by || "", notify_employee: t.notify_employee,
      employee_remarks: t.employee_remarks || "", sendWa: false,
    });
    setEditId(t.id);
    setShowForm(true);
  }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = {
        title: form.title, description: form.description || null,
        project_client: form.project_client || null, priority: form.priority,
        status: form.status, due_date: form.due_date || null,
        assigned_by: form.assigned_by || null, notify_employee: form.notify_employee,
        employee_remarks: form.employee_remarks || null,
      };
      let saved: EmployeeTask;
      if (editId) saved = await api.updateEmployeeTask(employeeId, editId, body);
      else saved = await api.createEmployeeTask(employeeId, body);
      setShowForm(false);
      await load();
      if (form.sendWa) setWaTask(saved);
    } catch { /* */ }
    setSaving(false);
  }

  async function del(id: string) {
    if (!confirm("Delete this task?")) return;
    await api.deleteEmployeeTask(employeeId, id);
    setTasks(t => t.filter(x => x.id !== id));
  }

  const priorityColor = (p: string) =>
    p === "urgent" ? "bg-red-100 text-red-700" : p === "high" ? "bg-orange-100 text-orange-700"
    : p === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600";
  const statusColor = (s: string) =>
    s === "completed" ? "bg-green-100 text-green-700" : s === "in_progress" ? "bg-blue-100 text-blue-700"
    : s === "cancelled" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600";

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line">
            <div className="flex items-center gap-2">
              <CheckSquare size={18} className="text-accent" />
              <h2 className="text-base font-semibold text-ink">Tasks — {employeeName}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={openNew}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent/90">
                <Plus size={14} /> Add Task
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>
          </div>

          {showForm && (
            <div className="px-6 py-4 border-b border-line bg-surface/50">
              <h3 className="text-sm font-medium text-ink mb-3">{editId ? "Edit Task" : "New Task"}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Title *</label>
                  <input className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Description</label>
                  <textarea className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                    rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Project / Client</label>
                  <input className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.project_client} onChange={e => setForm(f => ({ ...f, project_client: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Assigned By</label>
                  <input className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.assigned_by} onChange={e => setForm(f => ({ ...f, assigned_by: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Priority</label>
                  <select className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Status</label>
                  <select className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Due Date</label>
                  <input type="date" className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input type="checkbox" id="notify_emp" checked={form.notify_employee}
                    onChange={e => setForm(f => ({ ...f, notify_employee: e.target.checked }))}
                    className="accent-accent w-4 h-4" />
                  <label htmlFor="notify_emp" className="text-sm text-ink">Notify employee</label>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted mb-1 block">Employee Remarks</label>
                  <textarea className="w-full border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                    rows={2} value={form.employee_remarks} onChange={e => setForm(f => ({ ...f, employee_remarks: e.target.value }))} />
                </div>
                {/* WhatsApp checkbox */}
                <div className="col-span-2 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <input type="checkbox" id="send_wa" checked={form.sendWa}
                    onChange={e => setForm(f => ({ ...f, sendWa: e.target.checked }))}
                    className="w-4 h-4" style={{ accentColor: "#16a34a" }} />
                  <label htmlFor="send_wa" className="flex items-center gap-1.5 text-sm text-green-800 cursor-pointer select-none">
                    <MessageCircle size={14} className="text-green-600" />
                    Send WhatsApp notification to employee after saving
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={save} disabled={saving || !form.title.trim()}
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
            ) : tasks.length === 0 ? (
              <div className="text-center py-8 text-muted text-sm">No tasks yet. Click "Add Task" to create one.</div>
            ) : (
              <div className="space-y-3">
                {tasks.map(t => (
                  <div key={t.id} className="border border-line rounded-xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-ink">{t.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor(t.priority)}`}>{t.priority}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(t.status)}`}>{t.status.replace("_", " ")}</span>
                        </div>
                        {t.description && <p className="text-xs text-muted mt-1">{t.description}</p>}
                        <div className="flex gap-3 mt-1 flex-wrap">
                          {t.project_client && <span className="text-xs text-muted">📁 {t.project_client}</span>}
                          {t.due_date && <span className="text-xs text-muted">📅 {t.due_date}</span>}
                          {t.assigned_by && <span className="text-xs text-muted">👤 {t.assigned_by}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setWaTask(t)} title="Send via WhatsApp"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-muted hover:text-green-600">
                          <MessageCircle size={14} />
                        </button>
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-ink">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => del(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-danger">
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

      {waTask && (
        <WhatsAppPreviewModal
          phone={employeePhone}
          employeeId={employeeId}
          employeeName={employeeName}
          message={taskWaMessage(employeeName, waTask)}
          subject={`Task: ${waTask.title}`}
          relatedModule="task"
          relatedRecordId={waTask.id}
          onClose={() => setWaTask(null)}
        />
      )}
    </>
  );
}
