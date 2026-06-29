import { useState } from "react";
import {
  X, User, Users, Building2, ShieldCheck, Monitor,
  CheckSquare, FileText, Phone, Briefcase, Calendar, Lock,
  MessageSquare, MoreHorizontal, Mail, MapPin, Edit2,
} from "lucide-react";
import { type Employee, type Department, type Designation } from "../../lib/api";
import { TasksModal }        from "./modals/TasksModal";
import { WorkReportsModal }  from "./modals/WorkReportsModal";
import { CallRegisterModal } from "./modals/CallRegisterModal";
import { ProjectsModal }     from "./modals/ProjectsModal";
import { LeaveHistoryModal } from "./modals/LeaveHistoryModal";
import { PermissionsModal }  from "./modals/PermissionsModal";
import { SendMessageModal }  from "./modals/SendMessageModal";
import { MoreActionsPanel }  from "./modals/MoreActionsPanel";

// ── Types ─────────────────────────────────────────────────────
type ProfileTab = "profile" | "family" | "company" | "insurance" | "system";
type OpenModal  = null | "tasks" | "work_reports" | "call_logs" | "projects"
                | "leave" | "permissions" | "message" | "more";

interface Props {
  employee: Employee;
  departments: Department[];
  designations: Designation[];
  onClose: () => void;
  onEdit: () => void;
}

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return v; }
}
function fmt(v: string | null | undefined) { return v?.trim() || "—"; }

const STATUS_CLS: Record<string, string> = {
  active:     "bg-emerald-100 text-emerald-700",
  on_leave:   "bg-amber-100 text-amber-700",
  inactive:   "bg-surface-2 text-muted",
  terminated: "bg-red-100 text-red-700",
};

// ── Sub-components ────────────────────────────────────────────
function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-2 border-b border-line/40 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xs font-medium text-ink text-right">{value || "—"}</span>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-paper/60">
        <span className="text-xs font-semibold text-ink uppercase tracking-wide">{title}</span>
        {action}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

// ── Profile Tabs ──────────────────────────────────────────────
const PROFILE_TABS: { key: ProfileTab; label: string; icon: React.ElementType }[] = [
  { key: "profile",   label: "Profile",   icon: User },
  { key: "family",    label: "Family",    icon: Users },
  { key: "company",   label: "Company",   icon: Building2 },
  { key: "insurance", label: "Insurance", icon: ShieldCheck },
  { key: "system",    label: "System",    icon: Monitor },
];

// ── Action Grid ───────────────────────────────────────────────
const ACTIONS: { key: OpenModal; label: string; icon: React.ElementType; color: string }[] = [
  { key: "tasks",        label: "Tasks",         icon: CheckSquare,    color: "text-blue-600 bg-blue-50 border-blue-200" },
  { key: "work_reports", label: "Work Reports",  icon: FileText,       color: "text-purple-600 bg-purple-50 border-purple-200" },
  { key: "call_logs",    label: "Call Register", icon: Phone,          color: "text-green-600 bg-green-50 border-green-200" },
  { key: "projects",     label: "Projects",      icon: Briefcase,      color: "text-orange-600 bg-orange-50 border-orange-200" },
  { key: "leave",        label: "Leave History", icon: Calendar,       color: "text-amber-600 bg-amber-50 border-amber-200" },
  { key: "permissions",  label: "Permissions",   icon: Lock,           color: "text-red-600 bg-red-50 border-red-200" },
  { key: "message",      label: "Send Message",  icon: MessageSquare,  color: "text-teal-600 bg-teal-50 border-teal-200" },
  { key: "more",         label: "More",          icon: MoreHorizontal, color: "text-muted bg-line/40 border-line" },
];

// ── Main Component ────────────────────────────────────────────
export function EmployeeDrawer({ employee, departments, onClose, onEdit }: Props) {
  const [profileTab, setProfileTab] = useState<ProfileTab>("profile");
  const [openModal, setOpenModal]   = useState<OpenModal>(null);
  const [currentEmp, setCurrentEmp] = useState<Employee>(employee);

  const fd  = (currentEmp.family_details    ?? {}) as Record<string, string>;
  const ins = (currentEmp.insurance_details ?? {}) as Record<string, string>;
  const sys = (currentEmp.system_details    ?? {}) as Record<string, string>;
  const dept = departments.find(d => d.id === currentEmp.department_id);

  // ── Profile Tab Content ──────────────────────────────────────
  function renderProfileContent() {
    if (profileTab === "profile") return (
      <div className="space-y-3">
        <Card title="Personal Details" action={
          <button onClick={onEdit} className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-medium">
            <Edit2 size={11} /> Edit
          </button>
        }>
          <InfoItem label="Full Name"         value={fmt(currentEmp.full_name)} />
          <InfoItem label="Date of Birth"     value={fmtDate(currentEmp.date_of_birth)} />
          <InfoItem label="Gender"            value={fmt(currentEmp.gender)} />
          <InfoItem label="Email"             value={fmt(currentEmp.email)} />
          <InfoItem label="Phone"             value={fmt(currentEmp.phone)} />
          <InfoItem label="Address"           value={fmt(currentEmp.address)} />
          <InfoItem label="Emergency Contact" value={fmt(fd.emergency_contact)} />
          <InfoItem label="Emergency Phone"   value={fmt(fd.emergency_phone)} />
        </Card>

        <Card title="Job Information">
          <InfoItem label="Department"        value={fmt(dept?.name ?? currentEmp.department)} />
          <InfoItem label="Designation"       value={fmt(currentEmp.designation ?? currentEmp.job_title)} />
          <InfoItem label="Work Location"     value={fmt(currentEmp.work_location)} />
          <InfoItem label="Join Date"         value={fmtDate(currentEmp.hire_date)} />
          <InfoItem label="Salary"            value={currentEmp.salary ? `₹${currentEmp.salary.toLocaleString("en-IN")}` : "—"} />
        </Card>

        <Card title="Leave Summary">
          <div className="grid grid-cols-3 gap-3 py-2">
            {[
              { label: "Total",     val: currentEmp.annual_leave_balance, cls: "text-blue-600" },
              { label: "Used",      val: 0,                               cls: "text-red-500" },
              { label: "Remaining", val: currentEmp.annual_leave_balance, cls: "text-green-600" },
            ].map(({ label, val, cls }) => (
              <div key={label} className="text-center bg-surface border border-line rounded-lg py-3">
                <p className={`text-xl font-bold ${cls}`}>{val}</p>
                <p className="text-xs text-muted mt-1">{label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );

    if (profileTab === "family") return (
      <Card title="Family Details">
        <InfoItem label="Father's Name"     value={fmt(fd.father_name)} />
        <InfoItem label="Mother's Name"     value={fmt(fd.mother_name)} />
        <InfoItem label="Spouse Name"       value={fmt(fd.spouse_name)} />
        <InfoItem label="Spouse Phone"      value={fmt(fd.spouse_phone)} />
        <InfoItem label="Children"          value={fmt(fd.num_children)} />
        <InfoItem label="Emergency Contact" value={fmt(fd.emergency_contact)} />
        <InfoItem label="Emergency Phone"   value={fmt(fd.emergency_phone)} />
      </Card>
    );

    if (profileTab === "company") return (
      <Card title="Company Information">
        <InfoItem label="Department"        value={fmt(dept?.name ?? currentEmp.department)} />
        <InfoItem label="Designation"       value={fmt(currentEmp.designation ?? currentEmp.job_title)} />
        <InfoItem label="Employee Type"     value={fmt(currentEmp.employee_type)} />
        <InfoItem label="Joining Date"      value={fmtDate(currentEmp.hire_date)} />
        <InfoItem label="Work Location"     value={fmt(currentEmp.work_location)} />
        <InfoItem label="Reporting Manager" value={fmt(currentEmp.reporting_manager_id)} />
        <InfoItem label="Shift"             value={fmt(currentEmp.work_shift)} />
        <InfoItem label="Salary"            value={currentEmp.salary ? `₹${currentEmp.salary.toLocaleString("en-IN")}` : "—"} />
        <InfoItem label="Status" value={
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CLS[currentEmp.status] ?? "bg-surface-2 text-muted"}`}>
            {currentEmp.status.replace("_", " ").toUpperCase()}
          </span>
        } />
      </Card>
    );

    if (profileTab === "insurance") return (
      <Card title="Insurance Details">
        <InfoItem label="Provider"      value={fmt(ins.provider)} />
        <InfoItem label="Policy Number" value={fmt(ins.policy_no)} />
        <InfoItem label="Coverage"      value={fmt(ins.coverage)} />
        <InfoItem label="Start Date"    value={fmtDate(ins.start_date)} />
        <InfoItem label="Expiry Date"   value={fmtDate(ins.expiry_date)} />
        <InfoItem label="Nominee"       value={fmt(ins.beneficiary)} />
        <InfoItem label="Status"        value={ins.expiry_date && new Date(ins.expiry_date) > new Date() ? "Active" : ins.expiry_date ? "Expired" : "—"} />
      </Card>
    );

    if (profileTab === "system") return (
      <Card title="System & Hardware">
        <InfoItem label="Laptop / PC"        value={fmt(sys.laptop)} />
        <InfoItem label="System ID / Serial" value={fmt(sys.laptop_serial)} />
        <InfoItem label="Processor"          value={fmt(sys.processor)} />
        <InfoItem label="RAM"                value={fmt(sys.ram)} />
        <InfoItem label="Storage"            value={fmt(sys.storage)} />
        <InfoItem label="Operating System"   value={fmt(sys.os)} />
        <InfoItem label="Backup Enabled"     value={sys.backup_enabled === "true" ? "Yes" : sys.backup_enabled === "false" ? "No" : "—"} />
        <InfoItem label="Last Backup Date"   value={fmtDate(sys.last_backup_date)} />
        <InfoItem label="Asset Condition"    value={fmt(sys.asset_condition)} />
        <InfoItem label="System Email"       value={fmt(sys.system_email)} />
      </Card>
    );

    return null;
  }

  return (
    <>
      {/* ── Drawer ──────────────────────────────────────────── */}
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="flex-1 bg-black/20" onClick={onClose} />

        <div className="w-[460px] bg-paper flex flex-col h-full shadow-2xl border-l border-line">

          {/* Profile Header */}
          <div className="bg-gradient-to-b from-accent/8 to-transparent px-5 pt-5 pb-4 border-b border-line shrink-0">
            <div className="flex items-start justify-between mb-4">
              <div />
              <button onClick={onClose} className="text-muted hover:text-ink p-1 rounded-lg hover:bg-line/40">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent/30 flex items-center justify-center text-accent font-bold text-2xl shrink-0">
                {currentEmp.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-ink leading-tight truncate">{currentEmp.full_name}</h2>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLS[currentEmp.status] ?? "bg-surface-2 text-muted"}`}>
                    {currentEmp.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">{currentEmp.designation || currentEmp.job_title || "No designation"}</p>
                {currentEmp.employee_no && (
                  <p className="text-xs text-muted/60 mt-0.5 font-mono">{currentEmp.employee_no}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-2">
                  {currentEmp.email && (
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Mail size={11} /> <span className="truncate max-w-[140px]">{currentEmp.email}</span>
                    </span>
                  )}
                  {currentEmp.phone && (
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Phone size={11} /> {currentEmp.phone}
                    </span>
                  )}
                  {(currentEmp.work_location || dept) && (
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <MapPin size={11} /> {currentEmp.work_location || dept?.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button onClick={onEdit}
              className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 border border-line rounded-lg text-xs text-muted hover:text-ink hover:border-ink/30 bg-paper/60 transition-colors">
              <Edit2 size={12} /> Edit Profile
            </button>
          </div>

          {/* Profile Tab Bar */}
          <div className="flex border-b border-line shrink-0 bg-paper/60">
            {PROFILE_TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setProfileTab(key)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors border-b-2 ${
                  profileTab === key ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
                }`}>
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {renderProfileContent()}
          </div>

          {/* Quick Actions */}
          <div className="border-t border-line p-4 shrink-0 bg-surface/60">
            <p className="text-[10px] text-muted font-semibold uppercase tracking-wide mb-3">Quick Actions</p>
            <div className="grid grid-cols-4 gap-2">
              {ACTIONS.map(({ key, label, icon: Icon, color }) => (
                <button key={key} onClick={() => setOpenModal(key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all hover:scale-[1.03] hover:shadow-sm ${color}`}>
                  <Icon size={18} />
                  <span className="text-[10px] font-medium leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}
      {openModal === "tasks" && (
        <TasksModal employeeId={currentEmp.id} employeeName={currentEmp.full_name} employeePhone={currentEmp.phone} onClose={() => setOpenModal(null)} />
      )}
      {openModal === "work_reports" && (
        <WorkReportsModal employeeId={currentEmp.id} employeeName={currentEmp.full_name} employeePhone={currentEmp.phone} onClose={() => setOpenModal(null)} />
      )}
      {openModal === "call_logs" && (
        <CallRegisterModal employeeId={currentEmp.id} employeeName={currentEmp.full_name} employeePhone={currentEmp.phone} onClose={() => setOpenModal(null)} />
      )}
      {openModal === "projects" && (
        <ProjectsModal employeeId={currentEmp.id} employeeName={currentEmp.full_name} employeePhone={currentEmp.phone} onClose={() => setOpenModal(null)} />
      )}
      {openModal === "leave" && (
        <LeaveHistoryModal employeeId={currentEmp.id} employeeName={currentEmp.full_name} employeePhone={currentEmp.phone} onClose={() => setOpenModal(null)} />
      )}
      {openModal === "permissions" && (
        <PermissionsModal employeeId={currentEmp.id} employeeName={currentEmp.full_name} onClose={() => setOpenModal(null)} />
      )}
      {openModal === "message" && (
        <SendMessageModal employeeId={currentEmp.id} employeeName={currentEmp.full_name} employeePhone={currentEmp.phone} onClose={() => setOpenModal(null)} />
      )}
      {openModal === "more" && (
        <MoreActionsPanel
          employee={currentEmp}
          onClose={() => setOpenModal(null)}
          onStatusChanged={(updated) => { setCurrentEmp(updated); setOpenModal(null); }}
        />
      )}
    </>
  );
}
