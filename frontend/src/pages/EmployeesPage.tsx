import { useEffect, useState, useMemo } from "react";
import {
  Plus, Search, Users, UserCheck, UserX,
  Building2, ChevronDown, MoreVertical, Eye, Pencil, Trash2, Power,
  Upload, Download, FileBarChart2,
} from "lucide-react";
import { api, type Department, type Designation, type Employee } from "../lib/api";
import { AddEditEmployeeModal } from "./employees/AddEditEmployeeModal";
import { EmployeeDrawer } from "./employees/EmployeeDrawer";
import { ImportExcelModal } from "./employees/ImportExcelModal";
import { exportEmployees, exportEmployeeReport } from "./employees/excelUtils";

const STATUS_BADGE: Record<string, string> = {
  active:     "bg-emerald-100 text-emerald-700",
  on_leave:   "bg-amber-100 text-amber-700",
  inactive:   "bg-gray-100 text-gray-600",
  terminated: "bg-red-100 text-red-600",
};

type MainTab = "employees" | "departments" | "designations";

function StatCard({ label, value, icon: Icon, color, active, onClick }: {
  label: string; value: number; icon: React.ElementType; color: string;
  active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-surface border rounded-xl p-4 flex items-center gap-4 transition-all w-full
        ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "cursor-default"}
        ${active ? "border-accent ring-2 ring-accent/20 shadow-sm" : "border-line hover:border-line/80"}
      `}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-ink">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </button>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [departments, setDepartments]   = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [tab, setTab]                   = useState<MainTab>("employees");
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter]     = useState("all");

  // Modals
  const [showAddEdit, setShowAddEdit]       = useState(false);
  const [editTarget, setEditTarget]         = useState<Employee | null>(null);
  const [drawerEmployee, setDrawerEmployee] = useState<Employee | null>(null);
  const [showImport, setShowImport]         = useState(false);

  // Dept management
  const [deptName, setDeptName]         = useState("");
  const [deptDesc, setDeptDesc]         = useState("");
  const [editingDept, setEditingDept]   = useState<Department | null>(null);

  // Designation management
  const [desigName, setDesigName]       = useState("");
  const [desigDeptId, setDesigDeptId]   = useState("");
  const [editingDesig, setEditingDesig] = useState<Designation | null>(null);

  async function refresh() {
    const [emps, depts, desigs] = await Promise.all([
      api.listEmployees(), api.listDepartments(), api.listDesignations(),
    ]);
    setEmployees(emps); setDepartments(depts); setDesignations(desigs);
  }
  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => {
    let list = employees;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.full_name.toLowerCase().includes(q) ||
        (e.email ?? "").toLowerCase().includes(q) ||
        (e.phone ?? "").toLowerCase().includes(q) ||
        (e.employee_no ?? "").toLowerCase().includes(q) ||
        (e.job_title ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") list = list.filter(e => e.status === statusFilter);
    if (deptFilter !== "all") list = list.filter(e => e.department_id === deptFilter);
    return list;
  }, [employees, search, statusFilter, deptFilter]);

  const stats = useMemo(() => ({
    total:      employees.length,
    active:     employees.filter(e => e.status === "active").length,
    on_leave:   employees.filter(e => e.status === "on_leave").length,
    inactive:   employees.filter(e => e.status === "inactive").length,
    terminated: employees.filter(e => e.status === "terminated").length,
    depts:      departments.length,
  }), [employees, departments]);

  function openCreate() { setEditTarget(null); setShowAddEdit(true); }
  function openEdit(e: Employee) { setEditTarget(e); setShowAddEdit(true); }

  async function deleteEmployee(id: string) {
    if (!confirm("Delete this employee? This cannot be undone.")) return;
    await api.deleteEmployee(id);
    refresh();
  }

  async function toggleStatus(e: Employee) {
    const next = e.status === "active" ? "inactive" : "active";
    await api.patchEmployeeStatus(e.id, next);
    refresh();
  }

  // Dept CRUD
  async function saveDept() {
    if (!deptName.trim()) return;
    if (editingDept) {
      await api.updateDepartment(editingDept.id, { name: deptName, description: deptDesc || null });
      setEditingDept(null);
    } else {
      await api.createDepartment({ name: deptName, description: deptDesc || null });
    }
    setDeptName(""); setDeptDesc(""); refresh();
  }
  async function deleteDept(id: string) {
    if (!confirm("Delete this department?")) return;
    await api.deleteDepartment(id); refresh();
  }

  // Desig CRUD
  async function saveDesig() {
    if (!desigName.trim()) return;
    if (editingDesig) {
      await api.updateDesignation(editingDesig.id, { name: desigName, department_id: desigDeptId || null });
      setEditingDesig(null);
    } else {
      await api.createDesignation({ name: desigName, department_id: desigDeptId || null });
    }
    setDesigName(""); setDesigDeptId(""); refresh();
  }
  async function deleteDesig(id: string) {
    if (!confirm("Delete this designation?")) return;
    await api.deleteDesignation(id); refresh();
  }

  const inputCls = "border border-line rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30";

  return (
    <div className="flex flex-col h-full bg-paper">
      {/* Header */}
      <div className="px-6 py-4 border-b border-line flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-ink">Employees</h1>
          <p className="text-sm text-muted mt-0.5">Manage your team, departments &amp; designations</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-2 border border-line rounded-xl text-sm text-muted hover:text-ink hover:border-ink/30 bg-paper transition-colors"
          >
            <Upload size={15} /> Import Excel
          </button>
          <button
            onClick={() => exportEmployees(filtered, departments)}
            className="flex items-center gap-2 px-3 py-2 border border-line rounded-xl text-sm text-muted hover:text-ink hover:border-ink/30 bg-paper transition-colors"
          >
            <Download size={15} /> Export Employees
          </button>
          <button
            onClick={() => exportEmployeeReport(filtered, departments)}
            className="flex items-center gap-2 px-3 py-2 border border-line rounded-xl text-sm text-muted hover:text-ink hover:border-ink/30 bg-paper transition-colors"
          >
            <FileBarChart2 size={15} /> Export Report
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90"
          >
            <Plus size={16} /> New Employee
          </button>
        </div>
      </div>

      {/* Stats — clickable filter buttons */}
      <div className="px-6 py-4 grid grid-cols-6 gap-3 shrink-0">
        <StatCard
          label="Total Employees" value={stats.total} icon={Users} color="bg-blue-100 text-blue-600"
          active={tab === "employees" && statusFilter === "all"}
          onClick={() => { setTab("employees"); setStatusFilter("all"); setDeptFilter("all"); }}
        />
        <StatCard
          label="Active" value={stats.active} icon={UserCheck} color="bg-green-100 text-green-600"
          active={tab === "employees" && statusFilter === "active"}
          onClick={() => { setTab("employees"); setStatusFilter("active"); }}
        />
        <StatCard
          label="On Leave" value={stats.on_leave} icon={UserX} color="bg-amber-100 text-amber-600"
          active={tab === "employees" && statusFilter === "on_leave"}
          onClick={() => { setTab("employees"); setStatusFilter("on_leave"); }}
        />
        <StatCard
          label="Inactive" value={stats.inactive} icon={UserX} color="bg-gray-100 text-gray-500"
          active={tab === "employees" && statusFilter === "inactive"}
          onClick={() => { setTab("employees"); setStatusFilter("inactive"); }}
        />
        <StatCard
          label="Terminated" value={stats.terminated} icon={UserX} color="bg-red-100 text-red-600"
          active={tab === "employees" && statusFilter === "terminated"}
          onClick={() => { setTab("employees"); setStatusFilter("terminated"); }}
        />
        <StatCard
          label="Departments" value={stats.depts} icon={Building2} color="bg-purple-100 text-purple-600"
          active={tab === "departments"}
          onClick={() => setTab("departments")}
        />
      </div>

      {/* Main Tabs */}
      <div className="px-6 flex gap-1 shrink-0 border-b border-line">
        {(["employees", "departments", "designations"] as MainTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t === "designations" ? "Designations" : t === "departments" ? "Departments" : "Employees"}
          </button>
        ))}
      </div>

      {/* Employees Tab */}
      {tab === "employees" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Filters */}
          <div className="px-6 py-3 flex gap-3 items-center shrink-0 border-b border-line/60">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className={`${inputCls} pl-9 w-full`}
                placeholder="Search employees…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <select
                className={`${inputCls} pr-8 appearance-none`}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
                <option value="terminated">Terminated</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>
            <div className="relative">
              <select
                className={`${inputCls} pr-8 appearance-none`}
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>
            <span className="text-sm text-muted ml-auto">{filtered.length} employee{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-surface border-b border-line">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Emp. No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Department</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Designation / Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Hire Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted">Salary</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const dept = departments.find(d => d.id === e.department_id);
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-line/60 hover:bg-surface/60 transition-colors cursor-pointer"
                      onClick={() => setDrawerEmployee(e)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent font-semibold text-sm shrink-0">
                            {e.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-ink leading-tight">{e.full_name}</p>
                            {e.email && <p className="text-xs text-muted truncate max-w-[180px]">{e.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{e.employee_no ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{dept?.name ?? e.department ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{e.designation || e.job_title || "—"}</td>
                      <td className="px-4 py-3 text-muted">{e.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">
                        {e.hire_date ? new Date(e.hire_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[e.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {e.status.replace("_", " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {e.salary ? `₹${e.salary.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                        <ActionMenu
                          onView={() => setDrawerEmployee(e)}
                          onEdit={() => openEdit(e)}
                          onToggleStatus={() => toggleStatus(e)}
                          onDelete={() => deleteEmployee(e.id)}
                          status={e.status}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Users size={40} className="text-muted/40 mb-3" />
                <p className="text-muted font-medium">No employees found</p>
                <p className="text-sm text-muted/70 mt-1">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {tab === "departments" && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl space-y-4">
            {/* Add form */}
            <div className="bg-surface border border-line rounded-xl p-4">
              <h3 className="text-sm font-semibold text-ink mb-3">
                {editingDept ? `Edit: ${editingDept.name}` : "Add Department"}
              </h3>
              <div className="flex gap-3">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Department name *"
                  value={deptName}
                  onChange={e => setDeptName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveDept(); }}
                />
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Description (optional)"
                  value={deptDesc}
                  onChange={e => setDeptDesc(e.target.value)}
                />
                <button onClick={saveDept} className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90">
                  {editingDept ? "Update" : "Add"}
                </button>
                {editingDept && (
                  <button onClick={() => { setEditingDept(null); setDeptName(""); setDeptDesc(""); }}
                    className="px-4 py-2 text-sm border border-line rounded-lg text-muted hover:text-ink">
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="space-y-2">
              {departments.map(d => {
                const empCount = employees.filter(e => e.department_id === d.id).length;
                return (
                  <div key={d.id} className="bg-surface border border-line rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">{d.name}</p>
                      <p className="text-xs text-muted">{d.description || "No description"} · {empCount} employee{empCount !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingDept(d); setDeptName(d.name); setDeptDesc(d.description ?? ""); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-accent hover:border-accent/40"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteDept(d.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-danger hover:border-danger/40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {departments.length === 0 && (
                <p className="text-sm text-muted text-center py-8">No departments yet. Add one above.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Designations Tab */}
      {tab === "designations" && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl space-y-4">
            {/* Add form */}
            <div className="bg-surface border border-line rounded-xl p-4">
              <h3 className="text-sm font-semibold text-ink mb-3">
                {editingDesig ? `Edit: ${editingDesig.name}` : "Add Designation"}
              </h3>
              <div className="flex gap-3">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Designation name *"
                  value={desigName}
                  onChange={e => setDesigName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveDesig(); }}
                />
                <select
                  className={`${inputCls} flex-1`}
                  value={desigDeptId}
                  onChange={e => setDesigDeptId(e.target.value)}
                >
                  <option value="">Department (optional)</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button onClick={saveDesig} className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90">
                  {editingDesig ? "Update" : "Add"}
                </button>
                {editingDesig && (
                  <button onClick={() => { setEditingDesig(null); setDesigName(""); setDesigDeptId(""); }}
                    className="px-4 py-2 text-sm border border-line rounded-lg text-muted hover:text-ink">
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="space-y-2">
              {designations.map(d => {
                const dept = departments.find(dep => dep.id === d.department_id);
                const empCount = employees.filter(e => e.designation === d.name).length;
                return (
                  <div key={d.id} className="bg-surface border border-line rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">{d.name}</p>
                      <p className="text-xs text-muted">
                        {dept ? dept.name : "All departments"} · {empCount} employee{empCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingDesig(d); setDesigName(d.name); setDesigDeptId(d.department_id ?? ""); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-accent hover:border-accent/40"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteDesig(d.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-danger hover:border-danger/40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {designations.length === 0 && (
                <p className="text-sm text-muted text-center py-8">No designations yet. Add one above.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportExcelModal
          existingEmployees={employees}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); refresh(); }}
        />
      )}

      {/* Add/Edit Modal */}
      {showAddEdit && (
        <AddEditEmployeeModal
          employee={editTarget}
          departments={departments}
          designations={designations}
          employees={employees}
          onClose={() => setShowAddEdit(false)}
          onSaved={() => { setShowAddEdit(false); refresh(); }}
        />
      )}

      {/* Drawer */}
      {drawerEmployee && (
        <EmployeeDrawer
          employee={drawerEmployee}
          departments={departments}
          designations={designations}
          onClose={() => setDrawerEmployee(null)}
          onEdit={() => { openEdit(drawerEmployee); setDrawerEmployee(null); }}
        />
      )}
    </div>
  );
}

// ── Action menu ───────────────────────────────────────────────
function ActionMenu({ onView, onEdit, onToggleStatus, onDelete, status }: {
  onView: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-line/60 text-muted hover:text-ink hover:border-ink/30"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-44 bg-paper border border-line rounded-xl shadow-lg py-1 text-sm">
            <button onClick={() => { setOpen(false); onView(); }} className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-surface text-ink">
              <Eye size={14} className="text-muted" /> View Details
            </button>
            <button onClick={() => { setOpen(false); onEdit(); }} className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-surface text-ink">
              <Pencil size={14} className="text-muted" /> Edit
            </button>
            <button onClick={() => { setOpen(false); onToggleStatus(); }} className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-surface text-ink">
              <Power size={14} className="text-muted" /> {status === "active" ? "Deactivate" : "Activate"}
            </button>
            <div className="border-t border-line my-1" />
            <button onClick={() => { setOpen(false); onDelete(); }} className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-surface text-danger">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
