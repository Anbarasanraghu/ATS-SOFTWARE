import { useEffect, useRef, useState, useMemo } from "react";
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
  inactive:   "bg-[#DDE8F5] text-[#41415C]",
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
      className={`hr-card-sm p-4 flex items-center gap-3 w-full text-left transition-all duration-200
        ${onClick ? "cursor-pointer" : "cursor-default"}
        ${active ? "ring-2 ring-blue-400/40" : ""}
      `}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#1B1B2F]">{value}</p>
        <p className="text-xs text-[#8A8AA0]">{label}</p>
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

  const _loaded = useRef(false);

  async function refresh() {
    const [emps, depts, desigs] = await Promise.all([
      api.listEmployees().catch(() => [] as Employee[]),
      api.listDepartments().catch(() => [] as Department[]),
      api.listDesignations().catch(() => [] as Designation[]),
    ]);
    setEmployees(emps); setDepartments(depts); setDesignations(desigs);
  }

  useEffect(() => {
    if (_loaded.current) return;
    _loaded.current = true;
    void refresh();
  }, []);

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

  return (
    <div className="hr-scene flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3 shrink-0"
        style={{ borderBottom: "1px solid #D8E6F5" }}>
        <div>
          <h1 className="text-xl font-bold text-[#1B1B2F]">Employees</h1>
          <p className="text-sm text-[#8A8AA0] mt-0.5">Manage your team, departments &amp; designations</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="hr-btn flex items-center gap-2 px-3 py-2 text-sm text-[#41415C]"
          >
            <Upload size={15} /> Import Excel
          </button>
          <button
            onClick={() => exportEmployees(filtered, departments)}
            className="hr-btn flex items-center gap-2 px-3 py-2 text-sm text-[#41415C]"
          >
            <Download size={15} /> Export Employees
          </button>
          <button
            onClick={() => exportEmployeeReport(filtered, departments)}
            className="hr-btn flex items-center gap-2 px-3 py-2 text-sm text-[#41415C]"
          >
            <FileBarChart2 size={15} /> Export Report
          </button>
          <button
            onClick={openCreate}
            className="hr-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-medium"
          >
            <Plus size={16} /> New Employee
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
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
          label="Inactive" value={stats.inactive} icon={UserX} color="bg-[#DDE8F5] text-[#41415C]"
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

      {/* Tabs */}
      <div className="px-6 shrink-0" style={{ borderBottom: "1px solid #D8E6F5" }}>
        <div className="flex gap-1 p-1 w-fit hr-card-sm">
          {(["employees", "departments", "designations"] as MainTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm capitalize transition-all ${
                tab === t ? "hr-tab-active" : "hr-tab"
              }`}
            >
              {t === "designations" ? "Designations" : t === "departments" ? "Departments" : "Employees"}
            </button>
          ))}
        </div>
      </div>

      {/* Employees Tab */}
      {tab === "employees" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Filters */}
          <div className="px-4 sm:px-6 py-3 flex flex-wrap gap-2 sm:gap-3 items-center shrink-0" style={{ borderBottom: "1px solid #D8E6F5" }}>
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8AA0]" />
              <input
                className="hr-inset pl-9 pr-3 py-2 text-sm text-[#1B1B2F] w-full"
                placeholder="Search employees…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <select
                className="hr-inset pl-3 pr-8 py-2 text-sm text-[#1B1B2F] appearance-none"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
                <option value="terminated">Terminated</option>
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A8AA0] pointer-events-none" />
            </div>
            <div className="relative">
              <select
                className="hr-inset pl-3 pr-8 py-2 text-sm text-[#1B1B2F] appearance-none"
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A8AA0] pointer-events-none" />
            </div>
            <span className="text-sm text-[#8A8AA0] ml-auto">{filtered.length} employee{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto" style={{ background: "#EEF4FA" }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: "#DDE8F5", borderBottom: "1px solid #C4CFDD" }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#41415C]">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#41415C]">Emp. No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#41415C]">Department</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#41415C]">Designation / Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#41415C]">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#41415C]">Hire Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#41415C]">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#41415C]">Salary</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const dept = departments.find(d => d.id === e.department_id);
                  return (
                    <tr
                      key={e.id}
                      style={{ borderBottom: "1px solid #D8E6F5" }}
                      className="hover:bg-[#E3EDF8] transition-colors cursor-pointer"
                      onClick={() => setDrawerEmployee(e)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                            style={{ background: "linear-gradient(135deg, #3B82F6, #2563EB)", boxShadow: "2px 2px 6px #C4CFDD, -1px -1px 4px #FFFFFF" }}>
                            {e.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-[#1B1B2F] leading-tight">{e.full_name}</p>
                            {e.email && <p className="text-xs text-[#8A8AA0] truncate max-w-[180px]">{e.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#8A8AA0]">{e.employee_no ?? "—"}</td>
                      <td className="px-4 py-3 text-[#8A8AA0]">{dept?.name ?? e.department ?? "—"}</td>
                      <td className="px-4 py-3 text-[#8A8AA0]">{e.designation || e.job_title || "—"}</td>
                      <td className="px-4 py-3 text-[#8A8AA0]">{e.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-[#8A8AA0]">
                        {e.hire_date ? new Date(e.hire_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[e.status] ?? "bg-[#DDE8F5] text-[#41415C]"}`}>
                          {e.status.replace("_", " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#41415C]">
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
                <div className="hr-card-sm w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Users size={28} className="text-[#8A8AA0]" />
                </div>
                <p className="text-[#41415C] font-medium">No employees found</p>
                <p className="text-sm text-[#8A8AA0] mt-1">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {tab === "departments" && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl space-y-4">
            <div className="hr-card p-5">
              <h3 className="text-sm font-semibold text-[#1B1B2F] mb-4">
                {editingDept ? `Edit: ${editingDept.name}` : "Add Department"}
              </h3>
              <div className="flex gap-3">
                <input
                  className="hr-inset flex-1 px-3 py-2 text-sm text-[#1B1B2F]"
                  placeholder="Department name *"
                  value={deptName}
                  onChange={e => setDeptName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveDept(); }}
                />
                <input
                  className="hr-inset flex-1 px-3 py-2 text-sm text-[#1B1B2F]"
                  placeholder="Description (optional)"
                  value={deptDesc}
                  onChange={e => setDeptDesc(e.target.value)}
                />
                <button onClick={saveDept} className="hr-btn-primary px-4 py-2 text-sm font-medium">
                  {editingDept ? "Update" : "Add"}
                </button>
                {editingDept && (
                  <button onClick={() => { setEditingDept(null); setDeptName(""); setDeptDesc(""); }}
                    className="hr-btn px-4 py-2 text-sm text-[#41415C]">
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {departments.map(d => {
                const empCount = employees.filter(e => e.department_id === d.id).length;
                return (
                  <div key={d.id} className="hr-card-sm px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#1B1B2F]">{d.name}</p>
                      <p className="text-xs text-[#8A8AA0] mt-0.5">{d.description || "No description"} · {empCount} employee{empCount !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingDept(d); setDeptName(d.name); setDeptDesc(d.description ?? ""); }}
                        className="hr-btn w-8 h-8 flex items-center justify-center text-[#8A8AA0] hover:text-blue-600"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteDept(d.id)}
                        className="hr-btn w-8 h-8 flex items-center justify-center text-[#8A8AA0] hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {departments.length === 0 && (
                <p className="text-sm text-[#8A8AA0] text-center py-8">No departments yet. Add one above.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Designations Tab */}
      {tab === "designations" && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl space-y-4">
            <div className="hr-card p-5">
              <h3 className="text-sm font-semibold text-[#1B1B2F] mb-4">
                {editingDesig ? `Edit: ${editingDesig.name}` : "Add Designation"}
              </h3>
              <div className="flex gap-3">
                <input
                  className="hr-inset flex-1 px-3 py-2 text-sm text-[#1B1B2F]"
                  placeholder="Designation name *"
                  value={desigName}
                  onChange={e => setDesigName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveDesig(); }}
                />
                <select
                  className="hr-inset flex-1 px-3 py-2 text-sm text-[#1B1B2F]"
                  value={desigDeptId}
                  onChange={e => setDesigDeptId(e.target.value)}
                >
                  <option value="">Department (optional)</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button onClick={saveDesig} className="hr-btn-primary px-4 py-2 text-sm font-medium">
                  {editingDesig ? "Update" : "Add"}
                </button>
                {editingDesig && (
                  <button onClick={() => { setEditingDesig(null); setDesigName(""); setDesigDeptId(""); }}
                    className="hr-btn px-4 py-2 text-sm text-[#41415C]">
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {designations.map(d => {
                const dept = departments.find(dep => dep.id === d.department_id);
                const empCount = employees.filter(e => e.designation === d.name).length;
                return (
                  <div key={d.id} className="hr-card-sm px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#1B1B2F]">{d.name}</p>
                      <p className="text-xs text-[#8A8AA0] mt-0.5">
                        {dept ? dept.name : "All departments"} · {empCount} employee{empCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingDesig(d); setDesigName(d.name); setDesigDeptId(d.department_id ?? ""); }}
                        className="hr-btn w-8 h-8 flex items-center justify-center text-[#8A8AA0] hover:text-blue-600"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteDesig(d.id)}
                        className="hr-btn w-8 h-8 flex items-center justify-center text-[#8A8AA0] hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {designations.length === 0 && (
                <p className="text-sm text-[#8A8AA0] text-center py-8">No designations yet. Add one above.</p>
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
        className="hr-btn w-8 h-8 flex items-center justify-center text-[#8A8AA0] hover:text-[#1B1B2F]"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-44 hr-card py-1 text-sm animate-fade-in-up">
            <button onClick={() => { setOpen(false); onView(); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[#E3EDF8] text-[#1B1B2F] transition-colors">
              <Eye size={14} className="text-[#8A8AA0]" /> View Details
            </button>
            <button onClick={() => { setOpen(false); onEdit(); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[#E3EDF8] text-[#1B1B2F] transition-colors">
              <Pencil size={14} className="text-[#8A8AA0]" /> Edit
            </button>
            <button onClick={() => { setOpen(false); onToggleStatus(); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[#E3EDF8] text-[#1B1B2F] transition-colors">
              <Power size={14} className="text-[#8A8AA0]" /> {status === "active" ? "Deactivate" : "Activate"}
            </button>
            <div style={{ borderTop: "1px solid #D8E6F5", margin: "4px 0" }} />
            <button onClick={() => { setOpen(false); onDelete(); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-red-50 text-red-500 transition-colors">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
