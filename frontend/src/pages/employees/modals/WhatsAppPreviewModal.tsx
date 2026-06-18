import { useState } from "react";
import { X, MessageCircle, Copy, Check, AlertTriangle, ExternalLink } from "lucide-react";
import { api } from "../../../lib/api";
import { hasValidPhone, buildWaUrl } from "./waTemplates";

interface Props {
  phone: string | null | undefined;
  employeeId: string;
  employeeName: string;
  message: string;
  subject?: string;
  relatedModule?: string;
  relatedRecordId?: string;
  onClose: () => void;
}

export function WhatsAppPreviewModal({
  phone, employeeId, employeeName, message, subject,
  relatedModule, relatedRecordId, onClose,
}: Props) {
  const [editedMsg, setEditedMsg] = useState(message);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const phoneOk = hasValidPhone(phone);

  async function send() {
    if (!editedMsg.trim()) return;
    setSaving(true);
    setErr("");
    try {
      await api.sendMessage(employeeId, {
        subject: subject || `WhatsApp — ${relatedModule || "message"}`,
        message: editedMsg,
        send_via: "whatsapp",
        priority: "normal",
        message_type: relatedModule || "custom",
        related_module: relatedModule || null,
        related_record_id: relatedRecordId || null,
      });
      if (phoneOk) window.open(buildWaUrl(phone!, editedMsg), "_blank", "noopener");
      setDone(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    }
    setSaving(false);
  }

  async function copy() {
    await navigator.clipboard.writeText(editedMsg).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-green-50">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-green-600" />
            <h2 className="text-sm font-semibold text-ink">WhatsApp Notification Preview</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-green-100 text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Recipient */}
          <div className="flex items-center gap-2 text-sm bg-surface rounded-xl px-4 py-2.5 border border-line">
            <span className="text-muted text-xs">To:</span>
            <span className="font-medium text-ink">{employeeName}</span>
            {phone && <span className="text-muted text-xs ml-auto">{phone}</span>}
          </div>

          {/* Phone warning */}
          {!phoneOk && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle size={15} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-700">
                Employee phone number not found. Message will be saved to history only.
              </p>
            </div>
          )}

          {/* Message editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">Message (editable)</label>
              <button onClick={copy} className="flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors">
                {copied
                  ? <><Check size={12} className="text-green-500" /> Copied!</>
                  : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <textarea
              className="w-full border border-line rounded-xl px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-green-300 resize-none bg-gray-50"
              rows={11}
              value={editedMsg}
              onChange={e => setEditedMsg(e.target.value)}
            />
          </div>

          {err && <p className="text-xs text-danger">{err}</p>}

          {done && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
              <Check size={15} className="text-green-600 shrink-0" />
              <p className="text-sm text-green-700">
                Saved to message history.{phoneOk ? " WhatsApp opened in a new tab." : ""}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-line flex gap-2">
          {!done ? (
            <>
              <button
                onClick={send}
                disabled={saving || !editedMsg.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 text-sm font-semibold transition-colors"
              >
                <ExternalLink size={14} />
                {saving ? "Saving…" : phoneOk ? "Open WhatsApp & Save" : "Save to History"}
              </button>
              <button onClick={onClose} className="px-4 py-2.5 border border-line rounded-xl text-sm text-muted hover:text-ink hover:border-ink/30">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={onClose} className="flex-1 py-2.5 border border-line rounded-xl text-sm text-ink hover:bg-surface font-medium">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
