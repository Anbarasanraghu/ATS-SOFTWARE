import { useEffect, useState } from "react";
import { Plus, X, Trash2, CheckCircle, DollarSign } from "lucide-react";
import { api, type Employee, type PayrollRecord } from "../lib/api";

const STATUS_CLS: Record<string, string> = {
  draft:    "bg-zinc-100 text-zinc-600",
  approved: "bg-sky-100 text-sky-700",
  paid:     "bg-emerald-100 text-emerald-700",
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const now = new Date();

export default function PayrollPage() {
  const [records, setRecords]     = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [form, setForm] = useState({
    employee_id: "", period_month: String(now.getMonth() + 1),
    period_year: String(now.getFullYear()),
    basic_salary: "", allowances: "0", deductions: "0", notes: "",
  });

  async function refresh() {
    const [r, e] = await Promise.all([api.listPayroll(), api.listEmployees()]);
    setRecords(r); setEmployees(e);
  }
  useEffect(() => { void refresh(); }, []);

  function pickEmployee(id: string) {
    const emp = employees.find((e) => e.id === id);
    setForm({ ...form, employee_id: id, basic_salary: emp?.salary ? String(emp.salary) : "" });
  }

  const net = Number(form.basic_salary || 0) + Number(form.allowances) - Number(form.deductions);

  async function submitCreate(e: { preventDefault(): void }) {
    e.preventDefault(); setError(null);
    try {
      await api.createPayroll({
        employee_id: form.employee_id,
        period_month: Number(form.period_month),
        period_year: Number(form.period_year),
        basic_salary: Number(form.basic_salary),
        allowances: Number(form.allowances),
        deductions: Number(form.deductions),
        notes: form.notes || null,
      });
      setShowCreate(false);
      setForm({ employee_id: "", period_month: String(now.getMonth() + 1), period_year: String(now.getFullYear()), basic_salary: "", allowances: "0", deductions: "0", notes: "" });
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  async function updateStatus(id: string, status: string) {
    try { await api.updatePayrollStatus(id, status); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this payroll record?")) return;
    try { await api.deletePayroll(id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  const inputCls = "mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

  const totalPayroll = records.filter((r) => r.status !== "draft").reduce((s, r) => s + r.net_salary, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Payroll</h1>
          {records.length > 0 && (
            <p className="text-sm text-muted mt-0.5">
              Total payroll (approved+paid): <span className="font-semibold text-ink">${totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </p>
          )}
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-accent text-white px-4 py-2 text-sm font-medium">
          <Plus size={16} /> New Record
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <form onSubmit={submitCreate}
            className="bg-surface border border-line rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New Payroll Record</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Employee *</span>
              <select required className={inputCls} value={form.employee_id} onChange={(e) => pickEmployee(e.target.value)}>
                <option value="">— Select employee —</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">Month</span>
                <select className={inputCls} value={form.period_month} onChange={(e) => setForm({ ...form, period_month: e.target.value })}>
                  {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">Year</span>
                <input type="number" className={inputCls} value={form.period_year} onChange={(e) => setForm({ ...form, period_year: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">Basic Salary *</span>
                <input type="number" step="0.01" required className={inputCls} value={form.basic_salary}
                  onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">Allowances</span>
                <input type="number" step="0.01" className={inputCls} value={form.allowances}
                  onChange={(e) => setForm({ ...form, allowances: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">Deductions</span>
                <input type="number" step="0.01" className={inputCls} value={form.deductions}
                  onChange={(e) => setForm({ ...form, deductions: e.target.value })} />
              </label>
              <div className="flex items-end">
                <div className="mt-1 w-full rounded-md border border-line bg-paper/60 px-3 py-2 text-sm">
                  <span className="text-xs text-muted">Net: </span>
                  <span className="font-semibold font-mono">{net.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Notes</span>
              <textarea rows={2} className={`${inputCls} resize-none`} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium">Create</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {records.length === 0 ? (
          <p className="p-6 text-sm text-muted">No payroll records yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3 text-right">Basic</th>
                <th className="px-4 py-3 text-right">Allowances</th>
                <th className="px-4 py-3 text-right">Deductions</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                  <td className="px-4 py-3 font-medium">{r.employee_name}</td>
                  <td className="px-4 py-3 text-muted">{MONTHS[r.period_month - 1]} {r.period_year}</td>
                  <td className="px-4 py-3 text-right font-mono">{Number(r.basic_salary).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700">+{Number(r.allowances).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-danger">-{Number(r.deductions).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{Number(r.net_salary).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[r.status] ?? ""}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {r.status === "draft" && (
                        <button onClick={() => updateStatus(r.id, "approved")}
                          className="text-muted hover:text-sky-600" title="Approve">
                          <CheckCircle size={15} />
                        </button>
                      )}
                      {r.status === "approved" && (
                        <button onClick={() => updateStatus(r.id, "paid")}
                          className="text-muted hover:text-emerald-600" title="Mark Paid">
                          <DollarSign size={15} />
                        </button>
                      )}
                      {r.status !== "paid" && (
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
