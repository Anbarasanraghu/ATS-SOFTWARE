import * as XLSX from "xlsx";
import type { Employee, Department } from "../../lib/api";

function fmtDate(v: string | null | undefined) {
  if (!v) return "";
  try { return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return v; }
}

function col(ws: XLSX.WorkSheet, width: number[]) {
  ws["!cols"] = width.map(w => ({ wch: w }));
}

export function exportEmployees(employees: Employee[], departments: Department[]) {
  const data = employees.map(e => ({
    "Employee ID":    e.employee_no ?? "",
    "Employee Name":  e.full_name,
    "Phone":          e.phone ?? "",
    "Email":          e.email ?? "",
    "Department":     departments.find(d => d.id === e.department_id)?.name ?? e.department ?? "",
    "Designation":    e.designation ?? e.job_title ?? "",
    "Work Location":  e.work_location ?? "",
    "Hire Date":      fmtDate(e.hire_date),
    "Salary":         e.salary ?? "",
    "Leave Balance":  e.annual_leave_balance,
    "Status":         e.status,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  col(ws, [14, 22, 14, 28, 18, 20, 16, 14, 10, 14, 12]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Employees");
  XLSX.writeFile(wb, `employees-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportEmployeeReport(employees: Employee[], departments: Department[]) {
  const data = employees.map(e => ({
    "Employee ID":     e.employee_no ?? "",
    "Employee Name":   e.full_name,
    "Department":      departments.find(d => d.id === e.department_id)?.name ?? e.department ?? "",
    "Designation":     e.designation ?? e.job_title ?? "",
    "Work Location":   e.work_location ?? "",
    "Status":          e.status,
    "Total Leave":     e.annual_leave_balance,
    "Used Leave":      0,
    "Remaining Leave": e.annual_leave_balance,
    "Salary":          e.salary ?? "",
    "Hire Date":       fmtDate(e.hire_date),
    "Created Date":    fmtDate(e.created_at),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  col(ws, [14, 22, 18, 20, 16, 12, 12, 12, 16, 10, 14, 14]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Employee Report");
  XLSX.writeFile(wb, `employee-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
