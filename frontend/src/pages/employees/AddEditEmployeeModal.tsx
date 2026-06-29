import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { api, type Employee, type Department, type Designation } from "../../lib/api";

interface Props {
  employee: Employee | null;
  departments: Department[];
  designations: Designation[];
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}

const TABS = ["Personal", "Family", "Company", "Insurance", "System"] as const;
type Tab = typeof TABS[number];

const EMPLOYEE_TYPES = ["full_time", "part_time", "contract", "intern", "consultant"];
const WORK_SHIFTS = ["morning", "afternoon", "night", "flexible"];
const GENDERS = ["male", "female", "other"];

export function AddEditEmployeeModal({ employee, departments, designations, employees, onClose, onSaved }: Props) {
  const isEdit = !!employee;
  const [tab, setTab] = useState<Tab>("Personal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Personal
  const [fullName, setFullName] = useState(employee?.full_name ?? "");
  const [employeeNo, setEmployeeNo] = useState(employee?.employee_no ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [dob, setDob] = useState(employee?.date_of_birth ?? "");
  const [gender, setGender] = useState(employee?.gender ?? "");
  const [address, setAddress] = useState(employee?.address ?? "");

  // Family
  const [spouseName, setSpouseName] = useState((employee?.family_details as Record<string, string>)?.spouse_name ?? "");
  const [spousePhone, setSpousePhone] = useState((employee?.family_details as Record<string, string>)?.spouse_phone ?? "");
  const [fatherName, setFatherName] = useState((employee?.family_details as Record<string, string>)?.father_name ?? "");
  const [motherName, setMotherName] = useState((employee?.family_details as Record<string, string>)?.mother_name ?? "");
  const [emergencyContact, setEmergencyContact] = useState((employee?.family_details as Record<string, string>)?.emergency_contact ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState((employee?.family_details as Record<string, string>)?.emergency_phone ?? "");
  const [numChildren, setNumChildren] = useState((employee?.family_details as Record<string, string>)?.num_children ?? "");

  // Company
  const [departmentId, setDepartmentId] = useState(employee?.department_id ?? "");
  const [designation, setDesignation] = useState(employee?.designation ?? "");
  const [jobTitle, setJobTitle] = useState(employee?.job_title ?? "");
  const [employeeType, setEmployeeType] = useState(employee?.employee_type ?? "full_time");
  const [workLocation, setWorkLocation] = useState(employee?.work_location ?? "");
  const [workShift, setWorkShift] = useState(employee?.work_shift ?? "");
  const [hireDate, setHireDate] = useState(employee?.hire_date ?? "");
  const [reportingManagerId, setReportingManagerId] = useState(employee?.reporting_manager_id ?? "");
  const [salary, setSalary] = useState(employee?.salary?.toString() ?? "");
  const [leaveBalance, setLeaveBalance] = useState(employee?.annual_leave_balance?.toString() ?? "0");
  const [status, setStatus] = useState(employee?.status ?? "active");
  const [notes, setNotes] = useState(employee?.notes ?? "");

  // Insurance
  const [insProvider, setInsProvider] = useState((employee?.insurance_details as Record<string, string>)?.provider ?? "");
  const [insPolicyNo, setInsPolicyNo] = useState((employee?.insurance_details as Record<string, string>)?.policy_no ?? "");
  const [insExpiry, setInsExpiry] = useState((employee?.insurance_details as Record<string, string>)?.expiry_date ?? "");
  const [insCoverage, setInsCoverage] = useState((employee?.insurance_details as Record<string, string>)?.coverage ?? "");
  const [insBeneficiary, setInsBeneficiary] = useState((employee?.insurance_details as Record<string, string>)?.beneficiary ?? "");

  // System / Hardware
  const [laptop, setLaptop] = useState((employee?.system_details as Record<string, string>)?.laptop ?? "");
  const [laptopSerial, setLaptopSerial] = useState((employee?.system_details as Record<string, string>)?.laptop_serial ?? "");
  const [systemEmail, setSystemEmail] = useState((employee?.system_details as Record<string, string>)?.system_email ?? "");
  const [systemPass, setSystemPass] = useState((employee?.system_details as Record<string, string>)?.system_pass ?? "");
  const [accessCards, setAccessCards] = useState((employee?.system_details as Record<string, string>)?.access_cards ?? "");
  const [otherEquipment, setOtherEquipment] = useState((employee?.system_details as Record<string, string>)?.other_equipment ?? "");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSave() {
    if (!fullName.trim()) { setError("Full name is required"); setTab("Personal"); return; }
    setSaving(true); setError("");
    try {
      const body = {
        full_name: fullName.trim(),
        employee_no: employeeNo.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        date_of_birth: dob || null,
        gender: gender || null,
        address: address.trim() || null,
        department_id: departmentId || null,
        designation: designation.trim() || null,
        job_title: jobTitle.trim() || null,
        employee_type: employeeType || null,
        work_location: workLocation.trim() || null,
        work_shift: workShift || null,
        hire_date: hireDate || null,
        reporting_manager_id: reportingManagerId || null,
        salary: salary ? parseFloat(salary) : null,
        annual_leave_balance: parseFloat(leaveBalance) || 0,
        status,
        notes: notes.trim() || null,
        family_details: {
          spouse_name: spouseName, spouse_phone: spousePhone,
          father_name: fatherName, mother_name: motherName,
          emergency_contact: emergencyContact, emergency_phone: emergencyPhone,
          num_children: numChildren,
        },
        insurance_details: {
          provider: insProvider, policy_no: insPolicyNo,
          expiry_date: insExpiry, coverage: insCoverage, beneficiary: insBeneficiary,
        },
        system_details: {
          laptop, laptop_serial: laptopSerial,
          system_email: systemEmail, system_pass: systemPass,
          access_cards: accessCards, other_equipment: otherEquipment,
        },
        custom_fields: employee?.custom_fields ?? {},
      };
      if (isEdit) await api.updateEmployee(employee.id, body);
      else await api.createEmployee(body);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const labelCls = "block text-xs font-medium text-muted mb-1";
  const inputCls = "w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-surface";
  const selectCls = inputCls;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-paper rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="text-lg font-semibold text-ink">
            {isEdit ? `Edit ${employee.full_name}` : "Add Employee"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                tab === t ? "bg-accent text-white" : "text-muted hover:text-ink hover:bg-line/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {error && <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

          {/* Personal */}
          {tab === "Personal" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Full Name *</label>
                <input className={inputCls} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" />
              </div>
              <div>
                <label className={labelCls}>Employee No</label>
                <input className={inputCls} value={employeeNo} onChange={e => setEmployeeNo(e.target.value)} placeholder="EMP-001" />
              </div>
              <div>
                <label className={labelCls}>Gender</label>
                <select className={selectCls} value={gender} onChange={e => setGender(e.target.value)}>
                  <option value="">Select</option>
                  {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9999999999" />
              </div>
              <div>
                <label className={labelCls}>Date of Birth</label>
                <input className={inputCls} type="date" value={dob} onChange={e => setDob(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Address</label>
                <textarea className={inputCls} rows={2} value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address..." />
              </div>
            </div>
          )}

          {/* Family */}
          {tab === "Family" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Father's Name</label>
                <input className={inputCls} value={fatherName} onChange={e => setFatherName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Mother's Name</label>
                <input className={inputCls} value={motherName} onChange={e => setMotherName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Spouse Name</label>
                <input className={inputCls} value={spouseName} onChange={e => setSpouseName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Spouse Phone</label>
                <input className={inputCls} value={spousePhone} onChange={e => setSpousePhone(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Number of Children</label>
                <input className={inputCls} type="number" min="0" value={numChildren} onChange={e => setNumChildren(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Emergency Contact Name</label>
                <input className={inputCls} value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Emergency Contact Phone</label>
                <input className={inputCls} value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} />
              </div>
            </div>
          )}

          {/* Company */}
          {tab === "Company" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Department</label>
                <select className={selectCls} value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Designation</label>
                <select className={selectCls} value={designation} onChange={e => setDesignation(e.target.value)}>
                  <option value="">Select Designation</option>
                  {designations.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Job Title</label>
                <input className={inputCls} value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Software Engineer" />
              </div>
              <div>
                <label className={labelCls}>Employee Type</label>
                <select className={selectCls} value={employeeType} onChange={e => setEmployeeType(e.target.value)}>
                  {EMPLOYEE_TYPES.map(t => (
                    <option key={t} value={t}>{t.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Work Location</label>
                <input className={inputCls} value={workLocation} onChange={e => setWorkLocation(e.target.value)} placeholder="Office / Remote" />
              </div>
              <div>
                <label className={labelCls}>Work Shift</label>
                <select className={selectCls} value={workShift} onChange={e => setWorkShift(e.target.value)}>
                  <option value="">Select Shift</option>
                  {WORK_SHIFTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Hire Date</label>
                <input className={inputCls} type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Reporting Manager</label>
                <select className={selectCls} value={reportingManagerId} onChange={e => setReportingManagerId(e.target.value)}>
                  <option value="">None</option>
                  {employees.filter(e => e.id !== employee?.id).map(e => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Salary</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={salary} onChange={e => setSalary(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className={labelCls}>Leave Balance (days)</label>
                <input className={inputCls} type="number" min="0" value={leaveBalance} onChange={e => setLeaveBalance(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select className={selectCls} value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          )}

          {/* Insurance */}
          {tab === "Insurance" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Insurance Provider</label>
                <input className={inputCls} value={insProvider} onChange={e => setInsProvider(e.target.value)} placeholder="LIC / Star Health" />
              </div>
              <div>
                <label className={labelCls}>Policy Number</label>
                <input className={inputCls} value={insPolicyNo} onChange={e => setInsPolicyNo(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Expiry Date</label>
                <input className={inputCls} type="date" value={insExpiry} onChange={e => setInsExpiry(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Coverage Amount</label>
                <input className={inputCls} value={insCoverage} onChange={e => setInsCoverage(e.target.value)} placeholder="₹5,00,000" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Beneficiary</label>
                <input className={inputCls} value={insBeneficiary} onChange={e => setInsBeneficiary(e.target.value)} placeholder="Spouse / Parent name" />
              </div>
            </div>
          )}

          {/* System */}
          {tab === "System" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Laptop / PC Model</label>
                <input className={inputCls} value={laptop} onChange={e => setLaptop(e.target.value)} placeholder="Dell XPS 15" />
              </div>
              <div>
                <label className={labelCls}>Serial Number</label>
                <input className={inputCls} value={laptopSerial} onChange={e => setLaptopSerial(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>System Email</label>
                <input className={inputCls} value={systemEmail} onChange={e => setSystemEmail(e.target.value)} placeholder="emp@company.com" />
              </div>
              <div>
                <label className={labelCls}>System Password</label>
                <input className={inputCls} value={systemPass} onChange={e => setSystemPass(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Access Cards / IDs</label>
                <input className={inputCls} value={accessCards} onChange={e => setAccessCards(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Other Equipment</label>
                <input className={inputCls} value={otherEquipment} onChange={e => setOtherEquipment(e.target.value)} placeholder="Mouse, Headset..." />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-line">
          <div className="flex gap-1">
            {TABS.map((t, i) => (
              <div
                key={t}
                className={`w-2 h-2 rounded-full transition-colors ${tab === t ? "bg-accent" : "bg-line"}`}
                onClick={() => setTab(TABS[i])}
              />
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-line rounded-lg text-muted hover:text-ink">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Employee"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
