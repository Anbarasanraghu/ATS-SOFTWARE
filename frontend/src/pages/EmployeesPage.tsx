import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { api, type Department, type Employee, type FieldDef } from "../lib/api";
import DynamicFields from "../components/DynamicFields";

type Form = {
  employee_no: string; full_name: string; email: string; phone: string;
  department_id: string; department: string; job_title: string; hire_date: string;
  status: string; salary: string; annual_leave_balance: string; notes: string;
  custom: Record<string, unknown>;
};
const blank = (): Form => ({
  employee_no: "", full_name: "", email: "", phone: "",
  department_id: "", department: "", job_title: "", hire_date: "",
  status: "active", salary: "", annual_leave_balance: "0", notes: "", custom: {},
});

const STATUS_CLS: Record<string, string> = {
  active:     "bg-emerald-100 text-emerald-700",
  on_leave:   "bg-amber-100 text-amber-700",
  terminated: "bg-red-100 text-red-600",
};

export default function EmployeesPage() {
  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [defs, setDefs]               = useState<FieldDef[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch]           = useState("");
  const [showCreate, setShowCreate]   = useState(false);
  const [editing, setEditing]         = useState<Employee | null>(null);
  const [form, setForm]               = useState<Form>(blank());
  const [error, setError]             = useState<string | null>(null);

  // Department management state
  const [showDepts, setShowDepts] = useState(false);
  const [deptName, setDeptName]   = useState("");

  async function refresh() {
    const [e, d, depts] = await Promise.all([
      api.listEmployees(), api.fieldDefinitions("employee"), api.listDepartments(),
    ]);
    setEmployees(e); setDefs(d); setDepartments(depts);
  }
  useEffect(() => { void refresh(); }, []);

  function openCreate() { setForm(blank()); setError(null); setShowCreate(true); }
  function openEdit(e: Employee) {
    setEditing(e);
    setForm({
      employee_no: e.employee_no ?? "", full_name: e.full_name,
      email: e.email ?? "", phone: e.phone ?? "",
      department_id: e.department_id ?? "", department: e.department ?? "",
      job_title: e.job_title ?? "", hire_date: e.hire_date ?? "",
      status: e.status, salary: e.salary !== null ? String(e.salary) : "",
      annual_leave_balance: String(e.annual_leave_balance), notes: e.notes ?? "",
      custom: { ...e.custom_fields },
    });
    setError(null);
  }
  function closeModal() { setShowCreate(false); setEditing(null); setError(null); }

  function buildPayload(f: Form) {
    return {
      employee_no: f.employee_no || null, full_name: f.full_name,
      email: f.email || null, phone: f.phone || null,
      department_id: f.department_id || null,
      department: f.department || null, job_title: f.job_title || null,
      hire_date: f.hire_date || null, status: f.status,
      salary: f.salary !== "" ? Number(f.salary) : null,
      annual_leave_balance: Number(f.annual_leave_balance),
      notes: f.notes || null, custom_fields: f.custom,
    };
  }

  async function submitCreate(e: { preventDefault(): void }) {
    e.preventDefault(); setError(null);
    try { await api.createEmployee(buildPayload(form)); closeModal(); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  async function submitEdit(e: { preventDefault(): void }) {
    e.preventDefault(); if (!editing) return; setError(null);
    try { await api.updateEmployee(editing.id, buildPayload(form)); closeModal(); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  async function handleDelete(id: string) {
    if (!confirm("Delete this employee record?")) return;
    try { await api.deleteEmployee(id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }
  async function addDept(e: { preventDefault(): void }) {
    e.preventDefault();
    try { await api.createDepartment({ name: deptName }); setDeptName(""); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }
  async function deleteDept(id: string) {
    if (!confirm("Delete department?")) return;
    try { await api.deleteDepartment(id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  const filtered = employees.filter((e) =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (e.department ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.job_title ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const inputCls = "mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

  const modal = (isEdit: boolean) => (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form onSubmit={isEdit ? submitEdit : submitCreate}
        className="bg-surface border border-line rounded-lg p-6 w-full max-w-lg space-y-4 shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{isEdit ? "Edit Employee" : "New Employee"}</h2>
          <button type="button" onClick={closeModal} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Employee No</span>
            <input className={inputCls} value={form.employee_no} onChange={(e) => setForm({ ...form, employee_no: e.target.value })} /></label>
          <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Status</span>
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="terminated">Terminated</option>
            </select></label>
          <label className="block col-span-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">Full Name *</span>
            <input required className={inputCls} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
          <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Email</span>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Phone</span>
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Department</span>
            <select className={inputCls} value={form.department_id}
              onChange={(e) => {
                const d = departments.find((x) => x.id === e.target.value);
                setForm({ ...form, department_id: e.target.value, department: d?.name ?? "" });
              }}>
              <option value="">— None —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></label>
          <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Job Title</span>
            <input className={inputCls} value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></label>
          <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Hire Date</span>
            <input type="date" className={inputCls} value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></label>
          <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Salary</span>
            <input type="number" step="0.01" className={inputCls} value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></label>
          <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Leave Balance (days)</span>
            <input type="number" step="0.5" className={inputCls} value={form.annual_leave_balance} onChange={(e) => setForm({ ...form, annual_leave_balance: e.target.value })} /></label>
          <label className="block col-span-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">Notes</span>
            <textarea rows={2} className={`${inputCls} resize-none`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </div>
        <DynamicFields defs={defs} values={form.custom}
          onChange={(k, v) => setForm((f) => ({ ...f, custom: { ...f.custom, [k]: v } }))} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={closeModal} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium">
            {isEdit ? "Save changes" : "Create employee"}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Employees</h1>
        <button onClick={() => setShowDepts((v) => !v)}
          className="text-xs text-muted border border-line rounded px-2 py-1 hover:bg-line/50">
          Departments ({departments.length})
        </button>
        <div className="ml-auto flex items-center gap-3">
          <input className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent w-52"
            placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={openCreate}
            className="flex items-center gap-2 rounded-md bg-accent text-white px-4 py-2 text-sm font-medium">
            <Plus size={16} /> New Employee
          </button>
        </div>
      </div>

      {/* Departments panel */}
      {showDepts && (
        <div className="bg-surface border border-line rounded-lg p-4 space-y-3">
          <div className="font-semibold text-sm">Departments</div>
          <form onSubmit={addDept} className="flex gap-2">
            <input required className="flex-1 rounded-md border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-accent"
              placeholder="Department name…" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
            <button type="submit" className="rounded-md bg-accent text-white px-3 py-1.5 text-sm font-medium flex items-center gap-1">
              <Plus size={14} /> Add
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            {departments.map((d) => (
              <span key={d.id} className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs">
                {d.name}
                <button onClick={() => deleteDept(d.id)} className="text-muted hover:text-danger ml-1"><X size={11} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted">{employees.length === 0 ? "No employees yet." : "No match."}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">No.</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Hire Date</th>
                <th className="px-4 py-3 text-right">Salary</th>
                <th className="px-4 py-3 text-center">Leave</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                  <td className="px-4 py-3 text-muted font-mono text-xs">{e.employee_no ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{e.full_name}</td>
                  <td className="px-4 py-3 text-muted">{e.department ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{e.job_title ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{e.hire_date ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{e.salary !== null ? Number(e.salary).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-center text-xs font-semibold">{e.annual_leave_balance}d</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[e.status] ?? ""}`}>
                      {e.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(e)} className="text-muted hover:text-accent"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(e.id)} className="text-muted hover:text-danger"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && modal(false)}
      {editing && modal(true)}
    </div>
  );
}
