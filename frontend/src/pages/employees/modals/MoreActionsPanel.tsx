import { useState } from "react";
import { X, UserCheck, UserX, UserMinus, FileText, Shield, Settings, ScrollText, StickyNote, MoreHorizontal, Trash2, Send } from "lucide-react";
import { api, type Employee, type EmployeeLog, type EmployeeNote } from "../../../lib/api";

interface Props {
  employee: Employee;
  onClose: () => void;
  onStatusChanged: (emp: Employee) => void;
}

type Panel = null | "logs" | "notes" | "insurance" | "system";

export function MoreActionsPanel({ employee, onClose, onStatusChanged }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [logs, setLogs] = useState<EmployeeLog[]>([]);
  const [notes, setNotes] = useState<EmployeeNote[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  async function loadLogs() {
    setLoadingLogs(true);
    try { setLogs(await api.listEmployeeLogs(employee.id)); } catch { /* */ }
    setLoadingLogs(false);
  }

  async function loadNotes() {
    setLoadingNotes(true);
    try { setNotes(await api.listEmployeeNotes(employee.id)); } catch { /* */ }
    setLoadingNotes(false);
  }

  function openLogs() { setPanel("logs"); loadLogs(); }
  function openNotes() { setPanel("notes"); loadNotes(); }

  async function addNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const n = await api.createEmployeeNote(employee.id, { note: newNote });
      setNotes(prev => [n as EmployeeNote, ...prev]);
      setNewNote("");
    } catch { /* */ }
    setSavingNote(false);
  }

  async function deleteNote(id: string) {
    await api.deleteEmployeeNote(employee.id, id);
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  async function changeStatus(newStatus: string) {
    if (!confirm(`Change status to "${newStatus}"?`)) return;
    setStatusUpdating(true);
    try {
      const updated = await api.patchEmployeeStatus(employee.id, newStatus);
      onStatusChanged(updated as Employee);
      onClose();
    } catch { /* */ }
    setStatusUpdating(false);
  }

  const actions = [
    {
      icon: <FileText size={16} />, label: "Upload Document",
      desc: "Attach files to this employee", onClick: () => alert("Document upload coming soon"),
    },
    {
      icon: <Shield size={16} />, label: "Insurance Details",
      desc: "View insurance information", onClick: () => setPanel("insurance"),
    },
    {
      icon: <Settings size={16} />, label: "System Details",
      desc: "View system/login details", onClick: () => setPanel("system"),
    },
    {
      icon: <ScrollText size={16} />, label: "Activity Logs",
      desc: "See all employee activity", onClick: openLogs,
    },
    {
      icon: <StickyNote size={16} />, label: "Notes",
      desc: "Add or view notes", onClick: openNotes,
    },
  ];

  const statusActions = employee.status === "active"
    ? [
        { icon: <UserMinus size={15} />, label: "Suspend Employee", status: "inactive", cls: "text-orange-600 hover:bg-orange-50" },
        { icon: <UserX size={15} />, label: "Terminate Employee", status: "terminated", cls: "text-danger hover:bg-red-50" },
      ]
    : [
        { icon: <UserCheck size={15} />, label: "Activate Employee", status: "active", cls: "text-green-600 hover:bg-green-50" },
      ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            {panel ? (
              <button onClick={() => setPanel(null)} className="p-1 rounded hover:bg-surface text-muted">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            ) : <MoreHorizontal size={18} className="text-accent" />}
            <h2 className="text-base font-semibold text-ink">
              {panel === "logs" ? "Activity Logs" : panel === "notes" ? "Notes" : panel === "insurance" ? "Insurance Details" : panel === "system" ? "System Details" : `More — ${employee.full_name}`}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {panel === null && (
            <div className="p-4 space-y-1">
              {actions.map(a => (
                <button key={a.label} onClick={a.onClick}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface text-left transition-colors">
                  <span className="text-muted">{a.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-ink">{a.label}</p>
                    <p className="text-xs text-muted">{a.desc}</p>
                  </div>
                </button>
              ))}
              <div className="border-t border-line mt-2 pt-2">
                {statusActions.map(a => (
                  <button key={a.status} onClick={() => changeStatus(a.status)} disabled={statusUpdating}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors disabled:opacity-50 ${a.cls}`}>
                    {a.icon}
                    <span className="text-sm font-medium">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {panel === "logs" && (
            <div className="p-4">
              {loadingLogs ? (
                <div className="text-center py-8 text-muted text-sm">Loading…</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted text-sm">No activity logs yet.</div>
              ) : (
                <div className="space-y-2">
                  {logs.map(l => (
                    <div key={l.id} className="flex gap-3 py-2 border-b border-line/60 last:border-0">
                      <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm text-ink">{l.action.replace(/_/g, " ")}</p>
                        {l.details && <p className="text-xs text-muted">{l.details}</p>}
                        <p className="text-xs text-muted/70">{new Date(l.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {panel === "notes" && (
            <div className="p-4">
              <div className="flex gap-2 mb-4">
                <textarea className="flex-1 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                  rows={2} placeholder="Add a note…" value={newNote} onChange={e => setNewNote(e.target.value)} />
                <button onClick={addNote} disabled={savingNote || !newNote.trim()}
                  className="p-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 shrink-0">
                  <Send size={16} />
                </button>
              </div>
              {loadingNotes ? (
                <div className="text-center py-4 text-muted text-sm">Loading…</div>
              ) : notes.length === 0 ? (
                <div className="text-center py-4 text-muted text-sm">No notes yet.</div>
              ) : (
                <div className="space-y-2">
                  {notes.map(n => (
                    <div key={n.id} className="flex items-start gap-2 p-3 bg-surface rounded-xl">
                      <p className="flex-1 text-sm text-ink">{n.note}</p>
                      <button onClick={() => deleteNote(n.id)} className="p-1 rounded hover:bg-red-50 text-muted hover:text-danger shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {panel === "insurance" && (
            <div className="p-6">
              {Object.keys(employee.insurance_details || {}).length === 0 ? (
                <div className="text-center py-8 text-muted text-sm">No insurance details recorded.</div>
              ) : (
                <dl className="space-y-3">
                  {Object.entries(employee.insurance_details).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-xs text-muted capitalize">{k.replace(/_/g, " ")}</dt>
                      <dd className="text-sm text-ink text-right">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {panel === "system" && (
            <div className="p-6">
              {Object.keys(employee.system_details || {}).length === 0 ? (
                <div className="text-center py-8 text-muted text-sm">No system details recorded.</div>
              ) : (
                <dl className="space-y-3">
                  {Object.entries(employee.system_details).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-xs text-muted capitalize">{k.replace(/_/g, " ")}</dt>
                      <dd className="text-sm text-ink text-right">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
