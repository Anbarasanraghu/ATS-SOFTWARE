import type { EmployeeTask, EmployeeWorkReport, EmployeeCallLog, EmployeeProject, LeaveRequest } from "../../../lib/api";

export function buildWaPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function hasValidPhone(phone: string | null | undefined): boolean {
  return buildWaPhone(phone).length >= 10;
}

export function buildWaUrl(phone: string, message: string): string {
  return `https://wa.me/${buildWaPhone(phone)}?text=${encodeURIComponent(message)}`;
}

export function taskWaMessage(name: string, t: EmployeeTask): string {
  return `Hi ${name},

New task assigned to you.

Task: ${t.title}
Project / Client: ${t.project_client || "—"}
Priority: ${t.priority}
Status: ${t.status}
Due Date: ${t.due_date || "—"}
Assigned By: ${t.assigned_by || "—"}

Please check and update your task status.`;
}

export function workReportWaMessage(name: string, r: EmployeeWorkReport): string {
  return `Hi ${name},

Your work report details have been added.

Report Date: ${r.report_date}
Report Type: ${r.report_type || "—"}
Project / Client: ${r.project_client || "—"}
Hours Worked: ${r.hours_worked != null ? `${r.hours_worked}h` : "—"}
Status: ${r.status}

Summary:
${r.work_summary || "—"}`;
}

export function callLogWaMessage(name: string, c: EmployeeCallLog): string {
  return `Hi ${name},

New call register details added.

Customer / Client: ${c.customer_client_name || "—"}
Phone: ${c.phone_number || "—"}
Call Type: ${c.call_type || "—"}
Call Status: ${c.call_status || "—"}
Duration: ${c.duration || "—"}
Next Follow-up: ${c.next_followup_date || "—"}

Notes:
${c.notes || "—"}`;
}

export function projectWaMessage(name: string, p: EmployeeProject): string {
  return `Hi ${name},

You have been assigned/updated in a project.

Project: ${p.project_name}
Client: ${p.client_name || "—"}
Role: ${p.employee_role || "—"}
Start Date: ${p.start_date || "—"}
End Date: ${p.end_date || "—"}
Status: ${p.status}

Notes:
${p.project_notes || "—"}`;
}

export function leaveWaMessage(name: string, l: LeaveRequest): string {
  return `Hi ${name},

Your leave details have been updated.

Leave Type: ${l.leave_type}
From Date: ${l.start_date}
To Date: ${l.end_date}
Total Days: ${l.days}
Status: ${l.status}

Remarks:
${l.notes || l.reason || "—"}`;
}
