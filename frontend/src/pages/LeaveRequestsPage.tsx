import { useEffect, useState } from "react";
import { Plus, X, Check, XCircle, Trash2 } from "lucide-react";
import { api, type Employee, type LeaveRequest } from "../lib/api";

const STATUS_CLS: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
};
const LEAVE_TYPES = ["annual", "sick", "unpaid", "maternity", "paternity", "other"];

export default function LeaveRequestsPage() {
  const [requests, setRequests]   = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [form, setForm] = useState({
    employee_id: "", leave_type: "annual",
    start_date: "", end_date: "", days: "1", reason: "",
  });

  async function refresh() {
    const [r, e] = await Promise.all([api.listLeaveRequests(), api.listEmployees()]);
    setRequests(r); setEmployees(e);
  }
  useEffect(() => { void refresh(); }, []);

  async function submitCreate(e: { preventDefault(): void }) {
    e.preventDefault(); setError(null);
    try {
      await api.createLeaveRequest({
        employee_id: form.employee_id, leave_type: form.leave_type,
        start_date: form.start_date, end_date: form.end_date,
        days: Number(form.days), reason: form.reason || null,
      });
      setShowCreate(false);
      setForm({ employee_id: "", leave_type: "annual", start_date: "", end_date: "", days: "1", reason: "" });
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  async function updateStatus(id: string, status: string) {
    try { await api.updateLeaveStatus(id, { status }); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this leave request?")) return;
    try { await api.deleteLeaveRequest(id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  const inputCls = "mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Leave Requests</h1>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-accent text-white px-4 py-2 text-sm font-medium">
          <Plus size={16} /> New Request
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <form onSubmit={submitCreate}
            className="bg-surface border border-line rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New Leave Request</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Employee *</span>
              <select required className={inputCls} value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">— Select employee —</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Leave Type</span>
              <select className={inputCls} value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">Start *</span>
                <input type="date" required className={inputCls} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">End *</span>
                <input type="date" required className={inputCls} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">Days</span>
                <input type="number" step="0.5" min="0.5" className={inputCls} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Reason</span>
              <textarea rows={2} className={`${inputCls} resize-none`} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium">Submit</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {requests.length === 0 ? (
          <p className="p-6 text-sm text-muted">No leave requests yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3 text-center">Days</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                  <td className="px-4 py-3 font-medium">{r.employee_name}</td>
                  <td className="px-4 py-3 text-muted capitalize">{r.leave_type}</td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {r.start_date} → {r.end_date}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">{r.days}</td>
                  <td className="px-4 py-3 text-muted max-w-xs truncate">{r.reason ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[r.status] ?? ""}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {r.status === "pending" && (
                        <>
                          <button onClick={() => updateStatus(r.id, "approved")}
                            className="text-muted hover:text-emerald-600" title="Approve">
                            <Check size={15} />
                          </button>
                          <button onClick={() => updateStatus(r.id, "rejected")}
                            className="text-muted hover:text-danger" title="Reject">
                            <XCircle size={15} />
                          </button>
                        </>
                      )}
                      {r.status !== "approved" && (
                        <button onClick={() => handleDelete(r.id)} className="text-muted hover:text-danger" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
