import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { api, type Customer, type CustomerPaymentFollowup } from "../../lib/api";
import { useAuth } from "../../auth/AuthContext";

// ── WhatsApp SVG icon ─────────────────────────────────────────
function WhatsAppSvg({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

// ── Message types ─────────────────────────────────────────────
type MsgType =
  | "service_intro"
  | "followup_reminder"
  | "quotation_followup"
  | "payment_followup"
  | "meeting_reminder"
  | "thank_you"
  | "custom";

const MSG_TYPES: { value: MsgType; label: string; emoji: string }[] = [
  { value: "service_intro",     label: "Service Introduction",    emoji: "👋" },
  { value: "followup_reminder", label: "Follow-up Reminder",      emoji: "📅" },
  { value: "quotation_followup",label: "Quotation Follow-up",     emoji: "📋" },
  { value: "payment_followup",  label: "Payment Follow-up",       emoji: "💰" },
  { value: "meeting_reminder",  label: "Meeting / Call Reminder", emoji: "📞" },
  { value: "thank_you",         label: "Thank You Message",       emoji: "🙏" },
  { value: "custom",            label: "Custom Message",          emoji: "✏️" },
];

// ── Variable chips ────────────────────────────────────────────
const VARIABLES = [
  { key: "{{customerName}}",  label: "customerName"  },
  { key: "{{serviceName}}",   label: "serviceName"   },
  { key: "{{companyName}}",   label: "companyName"   },
  { key: "{{staffName}}",     label: "staffName"     },
  { key: "{{followUpDate}}",  label: "followUpDate"  },
  { key: "{{invoiceNumber}}", label: "invoiceNumber" },
  { key: "{{invoiceAmount}}", label: "invoiceAmount" },
  { key: "{{paidAmount}}",    label: "paidAmount"    },
  { key: "{{balanceAmount}}", label: "balanceAmount" },
];

// ── Template builder ──────────────────────────────────────────
function buildTemplate(
  type: MsgType,
  customer: Customer,
  payment: CustomerPaymentFollowup | null,
  companyName: string,
): string {
  const name    = customer.name || "Customer";
  const service = customer.interested_service || "our services";
  const co      = companyName || "our company";
  const staff   = customer.assigned_staff || "our team";
  const date    = customer.next_followup_date
    ? new Date(customer.next_followup_date + "T00:00:00").toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : null;

  const rupee = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  switch (type) {
    case "service_intro":
      return [
        `Hi ${name},`,
        ``,
        `Greetings from ${co}.`,
        ``,
        `We provide ${service} services for businesses. Our team can help you with complete setup, support, and future improvements.`,
        ``,
        `Please let us know your requirement. We will be happy to assist you.`,
        ``,
        `Thank you.`,
      ].join("\n");

    case "followup_reminder":
      return [
        `Hi ${name},`,
        ``,
        `This is a reminder regarding your follow-up for ${service}.`,
        ``,
        date ? `Your next follow-up date is ${date}.` : `Please let us know a convenient time for a follow-up.`,
        ``,
        `Please let us know a convenient time to discuss further.`,
        ``,
        `Thank you,`,
        staff,
      ].join("\n");

    case "quotation_followup":
      return [
        `Hi ${name},`,
        ``,
        `This is a follow-up regarding the quotation we shared for ${service}.`,
        ``,
        `Please check and let us know if you have any questions or changes required.`,
        ``,
        `We are ready to proceed once you confirm.`,
        ``,
        `Thank you.`,
      ].join("\n");

    case "payment_followup": {
      const lines: string[] = [
        `Hi ${name},`,
        ``,
        `This is a gentle payment reminder.`,
        ``,
      ];
      if (payment?.invoice_number)       lines.push(`Invoice Number: ${payment.invoice_number}`);
      if (payment && payment.invoice_amount > 0) lines.push(`Invoice Amount: ₹${rupee(payment.invoice_amount)}`);
      if (payment && payment.paid_amount > 0)    lines.push(`Paid Amount: ₹${rupee(payment.paid_amount)}`);
      if (payment && payment.balance_amount > 0) lines.push(`Balance Amount: ₹${rupee(payment.balance_amount)}`);
      if (!payment) {
        lines.push(`Invoice Number: —`);
        lines.push(`Balance Amount: —`);
      }
      lines.push(``, `Please make the pending payment at your convenience and let us know once completed.`, ``, `Thank you.`);
      return lines.join("\n");
    }

    case "meeting_reminder":
      return [
        `Hi ${name},`,
        ``,
        `This is a reminder for our scheduled discussion regarding ${service}.`,
        ``,
        date ? `Scheduled date: ${date}.` : ``,
        date ? `` : undefined,
        `Please let us know if the scheduled time is convenient for you.`,
        ``,
        `Thank you,`,
        staff,
      ].filter(l => l !== undefined).join("\n");

    case "thank_you":
      return [
        `Hi ${name},`,
        ``,
        `Thank you for your interest in ${service}.`,
        ``,
        `We appreciate your time and look forward to working with you.`,
        ``,
        `Thank you.`,
      ].join("\n");

    case "custom":
      return `Hi ${name},\n\n`;
  }
}

// ── Modal props ───────────────────────────────────────────────
interface Props {
  customer: Customer;
  onClose: () => void;
}

// ── Main component ────────────────────────────────────────────
export default function WhatsAppMessageModal({ customer, onClose }: Props) {
  const { me } = useAuth();
  const companyName  = me?.tenant.name ?? "our company";
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  const rawPhone = customer.whatsapp ?? customer.phone ?? "";

  const [msgType,       setMsgType]       = useState<MsgType>("service_intro");
  const [message,       setMessage]       = useState("");
  const [payment,       setPayment]       = useState<CustomerPaymentFollowup | null>(null);
  const [loadingData,   setLoadingData]   = useState(true);
  const [sending,       setSending]       = useState(false);

  // Load latest payment followup for payment template
  useEffect(() => {
    api.listPaymentFollowups(customer.id)
      .then(list => setPayment(list[0] ?? null))
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [customer.id]);

  // Rebuild message when type or data changes
  useEffect(() => {
    if (!loadingData) {
      setMessage(buildTemplate(msgType, customer, payment, companyName));
    }
  }, [msgType, payment, loadingData]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Insert variable at cursor position
  function insertVariable(variable: string) {
    const ta = textareaRef.current;
    if (!ta) { setMessage(m => m + variable); return; }
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const next  = message.slice(0, start) + variable + message.slice(end);
    setMessage(next);
    setTimeout(() => {
      ta.focus();
      const pos = start + variable.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

  function handleSend() {
    if (!rawPhone.trim()) {
      alert("No phone number found. Please update the customer profile first.");
      return;
    }
    if (!message.trim()) {
      alert("Message cannot be empty.");
      return;
    }
    setSending(true);
    const cleaned = rawPhone.replace(/\D/g, "");
    const final   = cleaned.startsWith("91") && cleaned.length >= 12 ? cleaned : `91${cleaned}`;
    window.open(`https://wa.me/${final}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    setSending(false);
    onClose();
  }

  const charCount    = message.length;
  const selectedType = MSG_TYPES.find(t => t.value === msgType);
  const hasPhone     = !!rawPhone.trim();

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      {/* Click backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative card-3d rounded-2xl w-full max-w-[660px] shadow-2xl flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center shadow-sm flex-shrink-0">
              <WhatsAppSvg size={20} />
            </div>
            <div>
              <h2 className="font-bold text-ink text-[15px] leading-tight">Send WhatsApp Message</h2>
              <p className="text-xs text-muted mt-0.5">
                {customer.name}{customer.company ? ` · ${customer.company}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-line/60 transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Customer info — readonly */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
                Customer Name
              </label>
              <div className="flex items-center gap-2 rounded-lg input-3d/60 px-3 py-2.5 text-sm">
                <span className="flex-1 truncate text-ink font-medium">{customer.name}</span>
                <span className="text-[10px] text-muted bg-surface-2 px-1.5 py-0.5 rounded flex-shrink-0">readonly</span>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
                Phone Number
              </label>
              <div className="flex items-center gap-2 rounded-lg input-3d/60 px-3 py-2.5 text-sm">
                {hasPhone
                  ? <span className="flex-1 font-mono text-ink">{rawPhone}</span>
                  : <span className="flex-1 text-danger text-xs">No phone number</span>}
                <span className="text-[10px] text-muted bg-surface-2 px-1.5 py-0.5 rounded flex-shrink-0">readonly</span>
              </div>
            </div>
          </div>

          {/* Message Type */}
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
              Select Message Type
            </label>
            <select
              className="w-full rounded-lg input-3d px-3 py-2.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all cursor-pointer"
              value={msgType}
              onChange={e => setMsgType(e.target.value as MsgType)}>
              {MSG_TYPES.map(t => (
                <option key={t.value} value={t.value}>
                  {t.emoji}  {t.label}
                </option>
              ))}
            </select>
            {selectedType && msgType !== "custom" && (
              <p className="text-[11px] text-muted mt-1.5">
                Template auto-filled from customer data. You can edit before sending.
              </p>
            )}
          </div>

          {/* Payment info hint */}
          {msgType === "payment_followup" && !loadingData && (
            <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs ${
              payment
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-surface-2 border-line text-muted"
            }`}>
              <span className="text-base leading-none mt-0.5">{payment ? "💰" : "ℹ️"}</span>
              <span>
                {payment
                  ? <>
                      Using latest payment record{payment.invoice_number ? <> · Invoice <strong>{payment.invoice_number}</strong></> : ""}.
                      {payment.balance_amount > 0 && <> Balance: <strong>₹{payment.balance_amount.toLocaleString("en-IN")}</strong></>}
                    </>
                  : "No payment follow-up records found. Add a payment record first to auto-fill invoice details."}
              </span>
            </div>
          )}

          {/* Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
                Message Preview
              </label>
              <span className={`text-[11px] font-medium tabular-nums ${
                charCount > 1000 ? "text-danger" : charCount > 700 ? "text-amber-600" : "text-muted"
              }`}>
                {charCount} characters
              </span>
            </div>

            {loadingData ? (
              <div className="rounded-xl input-3d/60 px-4 py-10 flex flex-col items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-muted">Loading customer data…</p>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                rows={11}
                className="w-full rounded-xl input-3d px-4 py-3.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 resize-none leading-relaxed transition-all"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={msgType === "custom" ? "Type your custom message here…" : ""}
              />
            )}
          </div>

          {/* Insert Variable chips */}
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
              Insert Variable{" "}
              <span className="normal-case font-normal">— click to insert at cursor position</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  disabled={loadingData}
                  className="inline-flex items-center px-2.5 py-1 rounded-md input-3d text-[11px] text-muted hover:text-black hover:border-black/50 hover:bg-neutral-100 transition-colors font-mono disabled:opacity-40 disabled:cursor-not-allowed">
                  {"{{"}{v.label}{"}}"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-line flex-shrink-0 bg-paper/50 rounded-b-2xl">
          <div className="text-xs text-muted min-w-0 flex-1">
            {hasPhone ? (
              <span>
                Sending to{" "}
                <span className="font-mono font-semibold text-ink">{rawPhone}</span>
                {" "}via WhatsApp
              </span>
            ) : (
              <span className="text-danger font-medium">⚠ No phone number on this customer profile</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-line text-muted hover:text-ink hover:bg-line/50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!hasPhone || !message.trim() || sending || loadingData}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 active:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
              <WhatsAppSvg size={15} />
              {sending ? "Opening…" : "Send WhatsApp"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
