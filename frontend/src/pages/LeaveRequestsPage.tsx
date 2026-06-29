import { useEffect, useState } from "react";
import { Plus, X, Check, XCircle, Trash2, CalendarDays } from "lucide-react";
import { api, type Employee, type LeaveRequest } from "../lib/api";

const STATUS_CLS: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
};
const LEAVE_TYPES = ["annual", "sick", "unpaid", "maternity", "paternity", "other"];

export default function LeaveRequestsPage() {
  const [requests, setRequests]     = useState<LeaveRequest[]>([]);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError]           = useState<string | null>(null);
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

  const pending  = requests.filter(r => r.status === "pending").length;
  const approved = requests.filter(r => r.status === "approved").length;
  const rejected = requests.filter(r => r.status === "rejected").length;

  return (
    <div className="hr-scene p-4 sm:p-6 space-y-5 animate-fade-in-up">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1B1B2F]">Leave Requests</h1>
          <p className="text-sm text-[#8A8AA0] mt-0.5">Manage employee leave applications and approvals</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="hr-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-medium"
        >
          <Plus size={16} /> New Request
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Pending",  count: pending,  bg: "bg-amber-100",   text: "text-amber-700"  },
          { label: "Approved", count: approved, bg: "bg-emerald-100", text: "text-emerald-700" },
          { label: "Rejected", count: rejected, bg: "bg-red-100",     text: "text-red-600"    },
        ].map(s => (
          <div key={s.label} className="hr-card-sm px-5 py-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg} ${s.text}`}>
              <CalendarDays size={17} />
            </div>
            <div>
              <p className={`text-lg font-bold ${s.text}`}>{s.count}</p>
              <p className="text-xs text-[#8A8AA0]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={submitCreate}
            className="hr-scene w-full max-w-md p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-[#1B1B2F] text-base">New Leave Request</h2>
              <button type="button" onClick={() => setShowCreate(false)}
                className="hr-btn w-8 h-8 flex items-center justify-center text-[#8A8AA0] hover:text-[#1B1B2F]">
                <X size={16} />
              </button>
            </div>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#8A8AA0]">Employee *</span>
              <select required
                className="hr-inset w-full mt-1.5 px-3 py-2 text-sm text-[#1B1B2F]"
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">— Select employee —</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#8A8AA0]">Leave Type</span>
              <select
                className="hr-inset w-full mt-1.5 px-3 py-2 text-sm text-[#1B1B2F]"
                value={form.leave_type}
                onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#8A8AA0]">Start *</span>
                <input type="date" required
                  className="hr-inset w-full mt-1.5 px-3 py-2 text-sm text-[#1B1B2F]"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#8A8AA0]">End *</span>
                <input type="date" required
                  className="hr-inset w-full mt-1.5 px-3 py-2 text-sm text-[#1B1B2F]"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#8A8AA0]">Days</span>
                <input type="number" step="0.5" min="0.5"
                  className="hr-inset w-full mt-1.5 px-3 py-2 text-sm text-[#1B1B2F]"
                  value={form.days}
                  onChange={(e) => setForm({ ...form, days: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#8A8AA0]">Reason</span>
              <textarea rows={2}
                className="hr-inset w-full mt-1.5 px-3 py-2 text-sm text-[#1B1B2F] resize-none"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </label>
            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setShowCreate(false)}
                className="hr-btn px-4 py-2 text-sm text-[#41415C]">Cancel</button>
              <button type="submit"
                className="hr-btn-primary px-4 py-2 text-sm font-medium">Submit</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="hr-card overflow-hidden">
        {requests.length === 0 ? (
          <div className="p-10 text-center">
            <div className="hr-card-sm w-14 h-14 flex items-center justify-center mx-auto mb-3">
              <CalendarDays size={24} className="text-[#8A8AA0]" />
            </div>
            <p className="text-[#41415C] font-medium">No leave requests yet</p>
            <p className="text-sm text-[#8A8AA0] mt-1">Create a new leave request above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#DDE8F5", borderBottom: "1px solid #C4CFDD" }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#41415C] uppercase tracking-wide">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#41415C] uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#41415C] uppercase tracking-wide">Period</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#41415C] uppercase tracking-wide">Days</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#41415C] uppercase tracking-wide">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#41415C] uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}
                    style={{ borderBottom: "1px solid #D8E6F5" }}
                    className="hover:bg-[#E3EDF8] transition-colors last:border-0">
                    <td className="px-4 py-3 font-medium text-[#1B1B2F]">{r.employee_name}</td>
                    <td className="px-4 py-3 text-[#8A8AA0] capitalize">{r.leave_type}</td>
                    <td className="px-4 py-3 text-[#8A8AA0] text-xs">
                      {r.start_date} → {r.end_date}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-[#1B1B2F]">{r.days}</td>
                    <td className="px-4 py-3 text-[#8A8AA0] max-w-xs truncate">{r.reason ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLS[r.status] ?? ""}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {r.status === "pending" && (
                          <>
                            <button onClick={() => updateStatus(r.id, "approved")}
                              className="hr-btn w-8 h-8 flex items-center justify-center text-[#8A8AA0] hover:text-emerald-600"
                              title="Approve">
                              <Check size={14} />
                            </button>
                            <button onClick={() => updateStatus(r.id, "rejected")}
                              className="hr-btn w-8 h-8 flex items-center justify-center text-[#8A8AA0] hover:text-red-500"
                              title="Reject">
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                        {r.status !== "approved" && (
                          <button onClick={() => handleDelete(r.id)}
                            className="hr-btn w-8 h-8 flex items-center justify-center text-[#8A8AA0] hover:text-red-500"
                            title="Delete">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
