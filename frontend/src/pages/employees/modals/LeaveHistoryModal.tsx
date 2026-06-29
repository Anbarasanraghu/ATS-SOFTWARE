import { useEffect, useState } from "react";
import { X, Calendar, MessageCircle } from "lucide-react";
import { api, type LeaveRequest } from "../../../lib/api";
import { WhatsAppPreviewModal } from "./WhatsAppPreviewModal";
import { leaveWaMessage } from "./waTemplates";

interface Props {
  employeeId: string;
  employeeName: string;
  employeePhone?: string | null;
  onClose: () => void;
}

export function LeaveHistoryModal({ employeeId, employeeName, employeePhone, onClose }: Props) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [waLeave, setWaLeave] = useState<LeaveRequest | null>(null);

  useEffect(() => {
    api.listEmployeeLeaveHistory(employeeId)
      .then(setLeaves).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) =>
    s === "approved" ? "bg-green-100 text-green-700" : s === "rejected" ? "bg-red-100 text-red-700"
    : s === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-surface-2 text-muted";

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
        <div className="bg-surface rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-accent" />
              <h2 className="text-base font-semibold text-ink">Leave History — {employeeName}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-ink">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="text-center py-8 text-muted text-sm">Loading…</div>
            ) : leaves.length === 0 ? (
              <div className="text-center py-8 text-muted text-sm">No leave records found.</div>
            ) : (
              <div className="space-y-3">
                {leaves.map(l => (
                  <div key={l.id} className="border border-line rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-ink">{l.leave_type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(l.status)}`}>{l.status}</span>
                        </div>
                        <div className="flex gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-muted">📅 {l.start_date} → {l.end_date}</span>
                          <span className="text-xs text-muted">{l.days} day{l.days !== 1 ? "s" : ""}</span>
                        </div>
                        {l.reason && <p className="text-xs text-muted mt-1">{l.reason}</p>}
                        {l.notes && <p className="text-xs text-ink/60 mt-1 italic">{l.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setWaLeave(l)} title="Send via WhatsApp"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-muted hover:text-green-600">
                          <MessageCircle size={14} />
                        </button>
                        <span className="text-xs text-muted">
                          {new Date(l.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {waLeave && (
        <WhatsAppPreviewModal
          phone={employeePhone}
          employeeId={employeeId}
          employeeName={employeeName}
          message={leaveWaMessage(employeeName, waLeave)}
          subject={`Leave: ${waLeave.leave_type} (${waLeave.status})`}
          relatedModule="leave"
          relatedRecordId={waLeave.id}
          onClose={() => setWaLeave(null)}
        />
      )}
    </>
  );
}
