import { useEffect, useState } from "react";
import { X, MessageSquare, Send, MessageCircle, ExternalLink } from "lucide-react";
import { api, type EmployeeTask, type EmployeeWorkReport, type EmployeeCallLog, type EmployeeProject, type LeaveRequest } from "../../../lib/api";
import {
  taskWaMessage, workReportWaMessage, callLogWaMessage, projectWaMessage, leaveWaMessage,
  hasValidPhone, buildWaUrl,
} from "./waTemplates";

interface Props {
  employeeId: string;
  employeeName: string;
  employeePhone?: string | null;
  onClose: () => void;
}

type ShareType = "custom" | "task" | "work_report" | "call_register" | "project" | "leave";
type AnyRecord = EmployeeTask | EmployeeWorkReport | EmployeeCallLog | EmployeeProject | LeaveRequest;

const SHARE_TYPES: { value: ShareType; label: string }[] = [
  { value: "custom",       label: "Custom Message" },
  { value: "task",         label: "Task Details" },
  { value: "work_report",  label: "Work Report Details" },
  { value: "call_register",label: "Call Register Details" },
  { value: "project",      label: "Project Details" },
  { value: "leave",        label: "Leave Details" },
];

const SEND_VIA = ["internal", "whatsapp", "email", "sms"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

function recordLabel(type: ShareType, rec: AnyRecord): string {
  if (type === "task") return (rec as EmployeeTask).title;
  if (type === "work_report") return (rec as EmployeeWorkReport).report_date;
  if (type === "call_register") return (rec as EmployeeCallLog).customer_client_name || (rec as EmployeeCallLog).call_date;
  if (type === "project") return (rec as EmployeeProject).project_name;
  if (type === "leave") return `${(rec as LeaveRequest).leave_type} (${(rec as LeaveRequest).start_date})`;
  return "";
}

function buildMessage(type: ShareType, name: string, rec: AnyRecord): string {
  if (type === "task")          return taskWaMessage(name, rec as EmployeeTask);
  if (type === "work_report")   return workReportWaMessage(name, rec as EmployeeWorkReport);
  if (type === "call_register") return callLogWaMessage(name, rec as EmployeeCallLog);
  if (type === "project")       return projectWaMessage(name, rec as EmployeeProject);
  if (type === "leave")         return leaveWaMessage(name, rec as LeaveRequest);
  return "";
}

export function SendMessageModal({ employeeId, employeeName, employeePhone, onClose }: Props) {
  const [shareType, setShareType]         = useState<ShareType>("custom");
  const [records, setRecords]             = useState<AnyRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [selectedId, setSelectedId]       = useState("");
  const [subject, setSubject]             = useState("");
  const [message, setMessage]             = useState("");
  const [sendVia, setSendVia]             = useState("internal");
  const [priority, setPriority]           = useState("normal");
  const [sending, setSending]             = useState(false);
  const [sent, setSent]                   = useState(false);
  const [error, setError]                 = useState("");

  // Load records when share type changes
  useEffect(() => {
    if (shareType === "custom") { setRecords([]); setSelectedId(""); return; }
    setLoadingRecords(true);
    setSelectedId("");
    setMessage("");
    const loaders: Record<Exclude<ShareType, "custom">, () => Promise<AnyRecord[]>> = {
      task:          () => api.listEmployeeTasks(employeeId),
      work_report:   () => api.listWorkReports(employeeId),
      call_register: () => api.listCallLogs(employeeId),
      project:       () => api.listEmployeeProjects(employeeId),
      leave:         () => api.listEmployeeLeaveHistory(employeeId),
    };
    loaders[shareType]()
      .then(setRecords).catch(() => setRecords([]))
      .finally(() => setLoadingRecords(false));
  }, [shareType, employeeId]);

  // Auto-fill message when record is selected
  useEffect(() => {
    if (!selectedId || shareType === "custom") return;
    const rec = records.find(r => (r as { id: string }).id === selectedId);
    if (!rec) return;
    setMessage(buildMessage(shareType, employeeName, rec));
    if (!subject) setSubject(recordLabel(shareType, rec));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, records]);

  async function send() {
    if (!message.trim()) return;
    setSending(true);
    setError("");
    try {
      await api.sendMessage(employeeId, {
        subject: subject || null,
        message,
        send_via: sendVia,
        priority,
        message_type: shareType,
        related_module: shareType !== "custom" ? shareType : null,
        related_record_id: selectedId || null,
      });
      if (sendVia === "whatsapp" && hasValidPhone(employeePhone)) {
        window.open(buildWaUrl(employeePhone!, message), "_blank", "noopener");
      }
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send");
    }
    setSending(false);
  }

  const phoneOk = hasValidPhone(employeePhone);

  if (sent) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${sendVia === "whatsapp" ? "bg-green-100" : "bg-blue-100"}`}>
            {sendVia === "whatsapp"
              ? <MessageCircle size={24} className="text-green-600" />
              : <Send size={24} className="text-blue-600" />}
          </div>
          <h3 className="text-base font-semibold text-ink mb-1">Message Sent</h3>
          <p className="text-sm text-muted mb-1">
            Message has been saved to history{sendVia === "whatsapp" && phoneOk ? " and WhatsApp opened in a new tab" : ""}.
          </p>
          {sendVia === "whatsapp" && !phoneOk && (
            <p className="text-xs text-red-600 mb-4">Phone number not found — message saved to history only.</p>
          )}
          <button onClick={onClose} className="mt-4 px-6 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent/90">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-accent" />
            <h2 className="text-base font-semibold text-ink">Send Message — {employeeName}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Share Details Type */}
          <div>
            <label className="text-xs text-muted mb-1 block">Share Details Type</label>
            <select className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              value={shareType} onChange={e => { setShareType(e.target.value as ShareType); setMessage(""); setSubject(""); }}>
              {SHARE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Record selector (non-custom types) */}
          {shareType !== "custom" && (
            <div>
              <label className="text-xs text-muted mb-1 block">Select Record</label>
              {loadingRecords ? (
                <div className="text-xs text-muted px-3 py-2">Loading records…</div>
              ) : records.length === 0 ? (
                <div className="text-xs text-muted px-3 py-2 bg-surface rounded-lg border border-line">
                  No {shareType.replace("_", " ")} records found for this employee.
                </div>
              ) : (
                <select className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                  value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                  <option value="">— Select a record —</option>
                  {records.map(r => {
                    const id = (r as { id: string }).id;
                    return <option key={id} value={id}>{recordLabel(shareType, r)}</option>;
                  })}
                </select>
              )}
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="text-xs text-muted mb-1 block">Subject</label>
            <input className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              value={subject} onChange={e => setSubject(e.target.value)} placeholder="Optional subject" />
          </div>

          {/* Message */}
          <div>
            <label className="text-xs text-muted mb-1 block">
              Message {shareType !== "custom" && selectedId && <span className="text-green-600">(auto-filled — editable)</span>}
            </label>
            <textarea
              className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none font-mono leading-relaxed"
              rows={shareType !== "custom" && selectedId ? 10 : 5}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={shareType === "custom" ? "Type your message…" : "Select a record above to auto-fill the message"}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted mb-1 block">Send Via</label>
              <select className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                value={sendVia} onChange={e => setSendVia(e.target.value)}>
                {SEND_VIA.map(v => (
                  <option key={v} value={v}>
                    {v === "whatsapp" ? "WhatsApp" : v.charAt(0).toUpperCase() + v.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Priority</label>
              <select className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                value={priority} onChange={e => setPriority(e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {sendVia === "whatsapp" && !phoneOk && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ⚠ Employee phone number not found. Message will be saved to history only.
            </div>
          )}
          {sendVia !== "internal" && sendVia !== "whatsapp" && (
            <p className="text-xs text-muted bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              External delivery (Email/SMS) requires integration configuration.
            </p>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-line">
          <button onClick={send} disabled={sending || !message.trim()}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl disabled:opacity-50 text-sm font-semibold transition-colors ${
              sendVia === "whatsapp"
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-accent text-white hover:bg-accent/90"
            }`}>
            {sendVia === "whatsapp"
              ? <><ExternalLink size={15} />{sending ? "Sending…" : "Send via WhatsApp"}</>
              : <><Send size={15} />{sending ? "Sending…" : "Send Message"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
