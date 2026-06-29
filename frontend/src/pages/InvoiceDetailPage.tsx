import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Printer, Download, MessageCircle, Plus, Trash2, X,
} from "lucide-react";
import { api, type Invoice, type CompanySettings, type PrintSettings } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

type PrintSize = "a4" | "half" | "small";

// ── Constants ─────────────────────────────────────────────────
const STATUS_CLS: Record<string, string> = {
  draft: "bg-surface-2 text-muted",
  sent:  "bg-sky-100 text-sky-700",
  paid:  "bg-emerald-100 text-emerald-700",
  void:  "bg-red-100 text-red-600",
};

const TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  draft: [{ label: "Mark as Sent", next: "sent" }, { label: "Void", next: "void" }],
  sent:  [{ label: "Mark as Paid", next: "paid" }, { label: "Void", next: "void" }],
  paid:  [],
  void:  [],
};

const METHODS = ["cash", "upi", "bank_transfer", "card", "cheque", "other"];

const PRINT_SIZES: { val: PrintSize; label: string }[] = [
  { val: "a4",    label: "A4 Full Sheet" },
  { val: "half",  label: "A4 Half Sheet" },
  { val: "small", label: "Small 35×55mm" },
];

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: number | string) => Number(n).toFixed(2);

function buildWaPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 10) return "91" + d;
  if (d.length > 10) return d;
  return null;
}

function invoiceWaMsg(inv: Invoice): string {
  return (
    `Hi ${inv.customer_name},\n\nYour invoice ${inv.invoice_number} has been generated.\n\n` +
    `Total Amount: ₹${fmt(inv.total)}\nPaid Amount: ₹${fmt(inv.amount_paid)}\n` +
    `Balance Amount: ₹${fmt(inv.balance_due)}\nDue Date: ${inv.due_date ?? "N/A"}\n\n` +
    `Please check and complete the payment.`
  );
}

function payStatusLabel(inv: Invoice): string {
  if (inv.status === "void") return "Void";
  if (Number(inv.balance_due) <= 0.001) return "Paid";
  if (Number(inv.amount_paid) > 0) return "Partially Paid";
  return "Unpaid";
}

// ── Dynamic @page injection ────────────────────────────────────
// Called only on Print / Download PDF button click — never on load.
function injectPrintCSS(size: PrintSize) {
  document.getElementById("__psize__")?.remove();
  const el = document.createElement("style");
  el.id = "__psize__";

  if (size === "half") {
    el.textContent = [
      "@page { size: A5 portrait; margin: 5mm; }",
      "@media print {",
      "  .print-selected { width: 138mm !important; padding: 5mm !important; }",
      "}",
    ].join("\n");
  } else if (size === "small") {
    el.textContent = [
      "@page { size: 35mm 55mm; margin: 0; }",
      "@media print {",
      "  html, body {",
      "    width: 35mm !important; height: 55mm !important;",
      "    margin: 0 !important; padding: 0 !important;",
      "    overflow: hidden !important;",
      "  }",
      "  .print-selected {",
      "    width: 35mm !important; height: 55mm !important;",
      "    margin: 0 !important; padding: 0 !important; overflow: hidden !important;",
      "  }",
      "  .small-35x55 {",
      "    width: 35mm !important; height: 55mm !important;",
      "    padding: 1.5mm !important; box-sizing: border-box !important;",
      "    overflow: hidden !important;",
      "    font-size: 6px !important; line-height: 1.15 !important;",
      "    page-break-after: avoid !important; page-break-before: avoid !important;",
      "    page-break-inside: avoid !important;",
      "  }",
      "}",
    ].join("\n");
  } else {
    el.textContent = [
      "@page { size: A4 portrait; margin: 10mm; }",
      "@media print {",
      "  .print-selected { width: 100% !important; padding: 12mm !important; }",
      "}",
    ].join("\n");
  }

  document.head.appendChild(el);
}

function removePrintCSS() {
  setTimeout(() => document.getElementById("__psize__")?.remove(), 3000);
}

// ── Component ─────────────────────────────────────────────────
export default function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const navigate    = useNavigate();
  const { me }      = useAuth();

  const [invoice, setInvoice]             = useState<Invoice | null>(null);
  const [notFound, setNotFound]           = useState(false);
  const [printSize, setPrintSize]         = useState<PrintSize>("a4");
  const [companyCfg, setCompanyCfg]       = useState<CompanySettings | null>(null);
  const [printCfg, setPrintCfg]           = useState<PrintSettings | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [pmtForm, setPmtForm]         = useState({
    amount: "", payment_date: new Date().toISOString().slice(0, 10),
    method: "cash", reference: "", notes: "",
  });
  const [pmtError, setPmtError] = useState<string | null>(null);

  // Load invoice + settings in parallel — NO auto-print on load
  useEffect(() => {
    async function load() {
      try { setInvoice(await api.getInvoice(id)); }
      catch { setNotFound(true); }
    }
    async function loadSettings() {
      const [cs, ps] = await Promise.all([
        api.getCompanySettings().catch(() => null),
        api.getPrintSettings().catch(() => null),
      ]);
      setCompanyCfg(cs);
      setPrintCfg(ps);
      if (ps?.default_print_size) setPrintSize(ps.default_print_size as PrintSize);
    }
    void load();
    void loadSettings();
  }, [id]);

  // ── Handlers ────────────────────────────────────────────────
  async function changeStatus(next: string) {
    try { setInvoice(await api.updateInvoiceStatus(id, next)); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleDelete() {
    if (!confirm("Delete this draft invoice?")) return;
    try { await api.deleteInvoice(id); navigate("/billing"); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  async function submitPayment(e: { preventDefault(): void }) {
    e.preventDefault();
    setPmtError(null);
    try {
      await api.recordPayment(id, {
        amount: Number(pmtForm.amount),
        payment_date: pmtForm.payment_date,
        method: pmtForm.method,
        reference: pmtForm.reference || null,
        notes: pmtForm.notes || null,
      });
      setShowPayment(false);
      setInvoice(await api.getInvoice(id));
    } catch (err) { setPmtError(err instanceof Error ? err.message : "Failed"); }
  }

  async function deletePayment(paymentId: string) {
    if (!confirm("Remove this payment?")) return;
    try { await api.deletePayment(id, paymentId); setInvoice(await api.getInvoice(id)); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  // Print only on user button click
  function handlePrint() {
    injectPrintCSS(printSize);
    setTimeout(() => { window.print(); removePrintCSS(); }, 150);
  }

  function handleDownloadPdf() {
    if (!invoice) return;
    const suffix = printSize === "half" ? "Half-A4" : printSize === "small" ? "35x55mm" : "A4";
    const prev   = document.title;
    document.title = `Invoice-${invoice.invoice_number}-${suffix}`;
    injectPrintCSS(printSize);
    setTimeout(() => {
      window.print();
      setTimeout(() => { removePrintCSS(); document.title = prev; }, 3000);
    }, 150);
  }

  function handleWhatsApp() {
    if (!invoice) return;
    const wa = buildWaPhone(invoice.customer_phone);
    if (!wa) { alert("Customer phone not available for this invoice."); return; }
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(invoiceWaMsg(invoice))}`, "_blank", "noopener");
  }

  // ── Guard renders ────────────────────────────────────────────
  if (notFound) return (
    <div className="space-y-4">
      <button onClick={() => navigate("/billing")} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Invoices
      </button>
      <p className="text-danger">Invoice not found.</p>
    </div>
  );
  if (!invoice) return <div className="text-muted text-sm p-4">Loading…</div>;

  // ── Derived values ───────────────────────────────────────────
  const transitions  = TRANSITIONS[invoice.status] ?? [];
  const pStatus      = payStatusLabel(invoice);
  const companyName  = companyCfg?.company_name || me?.tenant.name || "Company";
  const companyEmail = companyCfg?.email || me?.user.email || "";
  const companyPhone = companyCfg?.phone || null;
  const companyAddr  = companyCfg?.address || null;
  const companyGst   = companyCfg?.gst_number || null;
  const companyLogo  = companyCfg?.company_logo || null;

  const availableSizes = PRINT_SIZES.filter(s => {
    if (!printCfg) return true;
    if (s.val === "a4"    && !printCfg.enable_a4_full) return false;
    if (s.val === "half"  && !printCfg.enable_a4_half) return false;
    if (s.val === "small" && !printCfg.enable_33x55)   return false;
    return true;
  });
  const inputCls     = "mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

  function chipStyle(status: string): React.CSSProperties {
    const map: Record<string, React.CSSProperties> = {
      draft: { background: "#f3f4f6", color: "#374151" },
      sent:  { background: "#e0f2fe", color: "#0369a1" },
      paid:  { background: "#d1fae5", color: "#065f46" },
      void:  { background: "#fee2e2", color: "#991b1b" },
    };
    return {
      display: "inline-block", borderRadius: "999px", padding: "1px 8px",
      fontSize: "8px", fontWeight: 700, letterSpacing: "0.5px",
      ...(map[status] ?? {}),
    };
  }

  function pStatusColor(): string {
    if (pStatus === "Paid") return "#059669";
    if (pStatus === "Partially Paid") return "#d97706";
    if (pStatus === "Void") return "#dc2626";
    return "#6b7280";
  }

  // ── POS Thermal Receipt content (35×55mm) ─────────────────────
  const smallReceiptContent = (
    <>
      {/* ── Company header ── */}
      <div style={{ textAlign: "center", lineHeight: 1.25 }}>
        <div style={{ fontWeight: 900, fontSize: "7px", letterSpacing: "0.3px" }}>{companyName}</div>
        {companyAddr && (
          <div style={{ fontSize: "5px", color: "#222", marginTop: "0.2mm" }}>
            {companyAddr.split("\n")[0]}
          </div>
        )}
        {(companyPhone || companyEmail) && (
          <div style={{ fontSize: "5px", color: "#333" }}>
            {[companyPhone, companyEmail].filter(Boolean).join(" | ")}
          </div>
        )}
        {companyGst && (
          <div style={{ fontSize: "5px", color: "#333" }}>GSTIN: {companyGst}</div>
        )}
      </div>

      {/* ── Divider ── */}
      <div style={{ borderTop: "1px solid #000", margin: "0.8mm 0 0.5mm" }} />

      {/* ── Bill info ── */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "5.5px" }}>
        <span style={{ fontWeight: 700 }}>Bill: {invoice.invoice_number}</span>
        <span>{invoice.issue_date}</span>
      </div>
      <div style={{ fontSize: "5.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        Cust: {invoice.customer_name}
        {invoice.customer_phone ? ` (${invoice.customer_phone})` : ""}
      </div>

      {/* ── Items header ── */}
      <div style={{ borderTop: "1px dashed #000", margin: "0.5mm 0 0.2mm" }} />
      <div style={{ display: "flex", fontSize: "4.5px", fontWeight: 700, color: "#555", lineHeight: 1.2 }}>
        <span style={{ flex: 1 }}>ITEM</span>
        <span style={{ width: "14px", textAlign: "center" }}>QTY</span>
        <span style={{ width: "24px", textAlign: "right" }}>AMT</span>
      </div>
      <div style={{ borderTop: "1px solid #000", margin: "0.2mm 0 0.3mm" }} />

      {/* ── Line items ── */}
      {invoice.items?.slice(0, 7).map((item, i) => (
        <div key={i} style={{ display: "flex", fontSize: "5.5px", lineHeight: 1.15, marginBottom: "0.2mm" }}>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "1mm" }}>
            {item.description}
          </span>
          <span style={{ width: "14px", textAlign: "center" }}>{item.quantity}</span>
          <span style={{ width: "24px", textAlign: "right", fontWeight: 600 }}>₹{fmt(item.line_total)}</span>
        </div>
      ))}
      {(invoice.items?.length ?? 0) > 7 && (
        <div style={{ fontSize: "5px", color: "#666", fontStyle: "italic" }}>
          +{(invoice.items?.length ?? 0) - 7} more…
        </div>
      )}

      {/* ── Totals ── */}
      <div style={{ borderTop: "1px dashed #000", margin: "0.5mm 0 0.3mm" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "5.5px" }}>
        <span>Sub-Total:</span><span>₹{fmt(invoice.subtotal)}</span>
      </div>
      {Number(invoice.discount_total ?? 0) > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "5.5px", color: "#15803d" }}>
          <span>Discount:</span><span>-₹{fmt(invoice.discount_total ?? 0)}</span>
        </div>
      )}
      {Number(invoice.tax_total) > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "5.5px" }}>
          <span>Tax:</span><span>₹{fmt(invoice.tax_total)}</span>
        </div>
      )}
      {Number(invoice.other_charges ?? 0) > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "5.5px" }}>
          <span>Other Charges:</span><span>₹{fmt(invoice.other_charges ?? 0)}</span>
        </div>
      )}
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: "6.5px", fontWeight: 900,
        borderTop: "1px solid #000", marginTop: "0.4mm", paddingTop: "0.4mm",
      }}>
        <span>NET PAYABLE:</span><span>₹{fmt(invoice.total)}</span>
      </div>

      {/* ── Payment ── */}
      {Number(invoice.amount_paid) > 0 && (
        <>
          <div style={{ borderTop: "1px dashed #000", margin: "0.5mm 0 0.3mm" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "5.5px" }}>
            <span>Pay ({(invoice.payments?.[0]?.method ?? "cash").replace("_", " ")}):</span>
            <span style={{ fontWeight: 700 }}>₹{fmt(invoice.amount_paid)}</span>
          </div>
          {Number(invoice.balance_due) > 0.001 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "5.5px", fontWeight: 700, color: "#b91c1c" }}>
              <span>Balance Due:</span><span>₹{fmt(invoice.balance_due)}</span>
            </div>
          )}
        </>
      )}

      {/* ── Status ── */}
      <div style={{ borderTop: "1px solid #000", margin: "0.5mm 0 0.3mm" }} />
      <div style={{ textAlign: "center", fontWeight: 900, fontSize: "6px", color: pStatusColor(), letterSpacing: "0.5px" }}>
        ** {pStatus.toUpperCase()} **
      </div>

      {/* ── Savings ── */}
      {Number(invoice.discount_total ?? 0) > 0 && (
        <div style={{ textAlign: "center", fontSize: "5px", color: "#15803d", marginTop: "0.3mm" }}>
          You Saved ₹{fmt(invoice.discount_total ?? 0)}!
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ borderTop: "1px dashed #000", margin: "0.5mm 0 0.3mm" }} />
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: "5.5px" }}>Thank You! Visit Again!</div>
      {companyEmail && (
        <div style={{ textAlign: "center", fontSize: "4.5px", color: "#666", marginTop: "0.2mm" }}>
          {companyEmail}
        </div>
      )}
    </>
  );

  // ════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* ── Top bar (no-print) ── */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate("/billing")}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors">
          <ArrowLeft size={16} /> Back to Invoices
        </button>

        {/* Print size selector */}
        <div className="flex items-center gap-1 bg-paper border border-line rounded-lg p-1">
          {availableSizes.map(({ val, label }) => (
            <button key={val} onClick={() => setPrintSize(val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                printSize === val ? "bg-accent text-white shadow-sm" : "text-muted hover:text-ink"
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleWhatsApp}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <MessageCircle size={14} /> Send WhatsApp
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-accent text-accent rounded-lg hover:bg-accent/5 transition-colors">
            <Printer size={14} /> Print Invoice
          </button>
          <button onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors">
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      <p className="no-print text-xs text-muted italic">
        Select print size first, then click <strong>Print Invoice</strong>.
        To save as PDF choose &ldquo;Save as PDF&rdquo; in the print dialog.
      </p>

      {/* ════════════════════════════════════════════════════════
          LAYOUT 1 — A4 Full Sheet
      ════════════════════════════════════════════════════════ */}
      {printSize === "a4" && (
        <div className="print-selected bg-white border border-line rounded-xl shadow-sm overflow-hidden">

          {/* Header */}
          <div className="flex items-start justify-between p-8 pb-6 border-b border-line">
            <div>
              {companyLogo && <img src={companyLogo} alt="logo" style={{ maxHeight: "56px", maxWidth: "160px", objectFit: "contain", marginBottom: "8px" }} />}
              <div className="text-2xl font-bold text-ink">{companyName}</div>
              {companyEmail && <div className="text-sm text-muted mt-1">{companyEmail}</div>}
              {companyPhone && <div className="text-sm text-muted">{companyPhone}</div>}
              {companyAddr  && <div className="text-xs text-muted mt-1 whitespace-pre-line leading-snug">{companyAddr}</div>}
              {companyGst   && <div className="text-xs text-muted mt-1">GST: {companyGst}</div>}
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-[#0F6E56] tracking-wide">INVOICE</div>
              <div className="font-mono font-bold text-ink text-lg mt-1">{invoice.invoice_number}</div>
              <div className="mt-2">
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLS[invoice.status] ?? ""}`}>
                  {invoice.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Bill To + Invoice Details */}
          <div className="grid grid-cols-2 gap-8 px-8 py-6 border-b border-line">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Bill To</div>
              <div className="font-semibold text-ink text-base">{invoice.customer_name}</div>
              {invoice.customer_phone   && <div className="text-sm text-muted mt-1">{invoice.customer_phone}</div>}
              {invoice.customer_email   && <div className="text-sm text-muted">{invoice.customer_email}</div>}
              {invoice.customer_address && <div className="text-sm text-muted mt-1 whitespace-pre-line leading-snug">{invoice.customer_address}</div>}
              {invoice.customer_gst     && <div className="text-xs text-muted mt-1">GST: {invoice.customer_gst}</div>}
            </div>
            <div className="text-sm space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Invoice Details</div>
              {[
                ["Invoice No",  invoice.invoice_number, true],
                ["Issue Date",  invoice.issue_date,     false],
                ["Due Date",    invoice.due_date ?? "—", false],
                ...(invoice.payment_terms ? [["Payment Terms", invoice.payment_terms, false]] : []),
              ].map(([k, v, mono]) => (
                <div key={String(k)} className="flex justify-between">
                  <span className="text-muted">{k}</span>
                  <span className={`text-ink ${mono ? "font-mono font-semibold text-ink" : ""}`}>{v}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1">
                <span className="text-muted">Payment Status</span>
                <span className={`font-semibold text-xs ${
                  pStatus === "Paid" ? "text-emerald-600" : pStatus === "Partially Paid" ? "text-amber-600" :
                  pStatus === "Void" ? "text-red-600" : "text-muted"
                }`}>{pStatus}</span>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="px-8 py-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Line Items</div>
            {invoice.items && invoice.items.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-line text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 text-left font-semibold w-8">S.No</th>
                    <th className="pb-2 text-left font-semibold">Description / Product</th>
                    <th className="pb-2 text-right font-semibold w-16">Qty</th>
                    <th className="pb-2 text-right font-semibold w-28">Unit Price</th>
                    <th className="pb-2 text-right font-semibold w-16">Tax %</th>
                    <th className="pb-2 text-right font-semibold w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 text-muted text-xs">{idx + 1}</td>
                      <td className="py-2.5 text-ink">{item.description}</td>
                      <td className="py-2.5 text-right text-ink-soft">{item.quantity}</td>
                      <td className="py-2.5 text-right font-mono text-ink-soft">₹{fmt(item.unit_price)}</td>
                      <td className="py-2.5 text-right text-muted">{item.tax_percent}%</td>
                      <td className="py-2.5 text-right font-mono font-semibold text-ink">₹{fmt(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-sm text-muted">No line items.</p>}
          </div>

          {/* Totals */}
          <div className="px-8 py-5 border-t border-line bg-surface-2/50">
            <div className="flex justify-end">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span><span className="font-mono">₹{fmt(invoice.subtotal)}</span>
                </div>
                {Number(invoice.discount_total ?? 0) > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Discount</span><span className="font-mono">−₹{fmt(invoice.discount_total ?? 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted">
                  <span>Tax</span><span className="font-mono">₹{fmt(invoice.tax_total)}</span>
                </div>
                {Number(invoice.other_charges ?? 0) > 0 && (
                  <div className="flex justify-between text-muted">
                    <span>Other Charges</span><span className="font-mono">₹{fmt(invoice.other_charges ?? 0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t-2 border-line pt-2 text-ink">
                  <span>Grand Total</span><span className="font-mono">₹{fmt(invoice.total)}</span>
                </div>
                {Number(invoice.amount_paid) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Amount Paid</span><span className="font-mono">₹{fmt(invoice.amount_paid)}</span>
                  </div>
                )}
                <div className={`flex justify-between font-bold text-base border-t border-line pt-2 ${
                  Number(invoice.balance_due) > 0.001 ? "text-red-600" : "text-emerald-600"
                }`}>
                  <span>Balance Due</span><span className="font-mono">₹{fmt(invoice.balance_due)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="px-8 py-5 border-t border-line">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Payment History</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 text-left font-semibold">Date</th>
                    <th className="pb-2 text-left font-semibold">Method</th>
                    <th className="pb-2 text-left font-semibold">Reference</th>
                    <th className="pb-2 text-right font-semibold">Amount</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="py-2 text-ink-soft">{p.payment_date}</td>
                      <td className="py-2 text-muted capitalize">{p.method.replace("_", " ")}</td>
                      <td className="py-2 text-muted">{p.reference ?? "—"}</td>
                      <td className="py-2 text-right font-mono font-semibold text-emerald-700">₹{fmt(p.amount)}</td>
                      <td className="py-2 text-right no-print">
                        <button onClick={() => deletePayment(p.id)} className="text-danger hover:underline text-xs">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <div className="px-8 py-5 border-t border-line space-y-4">
              {invoice.notes && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">Notes</div>
                  <p className="text-sm text-muted whitespace-pre-line">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">Terms &amp; Conditions</div>
                  <p className="text-sm text-muted whitespace-pre-line leading-relaxed">{invoice.terms}</p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-6 border-t border-line flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0F6E56]">Thank you for your business!</p>
              <p className="text-xs text-muted mt-0.5">{companyName}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted mb-8">Authorized Signature</div>
              <div className="border-b border-gray-400 w-40"></div>
              <div className="text-xs text-muted mt-1">{companyName}</div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          LAYOUT 2 — A4 Half Sheet (A5 portrait, compact)
      ════════════════════════════════════════════════════════ */}
      {printSize === "half" && (
        <>
          <p className="no-print text-xs text-muted">Preview: A5 / Half A4 (148×210mm)</p>
          <div style={{ maxWidth: "560px" }}>
            <div className="print-selected bg-white border border-line rounded-xl shadow-sm overflow-hidden"
                 style={{ fontSize: "10px", lineHeight: "1.3", color: "#111" }}>

              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
                            padding:"14px 18px 10px", borderBottom:"1px solid #e5e7eb", gap:"10px" }}>
                <div>
                  {companyLogo && <img src={companyLogo} alt="logo" style={{ maxHeight:"36px", maxWidth:"100px", objectFit:"contain", marginBottom:"4px" }} />}
                  <div style={{ fontSize:"15px", fontWeight:700 }}>{companyName}</div>
                  {companyEmail && <div style={{ fontSize:"9px", color:"#6b7280", marginTop:"2px" }}>{companyEmail}</div>}
                  {companyPhone && <div style={{ fontSize:"9px", color:"#6b7280" }}>{companyPhone}</div>}
                  {companyGst   && <div style={{ fontSize:"8.5px", color:"#9ca3af", marginTop:"1px" }}>GST: {companyGst}</div>}
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:"20px", fontWeight:800, color:"#0F6E56", letterSpacing:"2px" }}>INVOICE</div>
                  <div style={{ fontFamily:"monospace", fontWeight:700, fontSize:"12px", marginTop:"1px" }}>{invoice.invoice_number}</div>
                  <div style={{ marginTop:"4px" }}><span style={chipStyle(invoice.status)}>{invoice.status.toUpperCase()}</span></div>
                </div>
              </div>

              {/* Bill To + Invoice Details */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px",
                            padding:"10px 18px 8px", borderBottom:"1px solid #e5e7eb" }}>
                <div>
                  <div style={{ fontSize:"7.5px", textTransform:"uppercase", letterSpacing:"1px", color:"#9ca3af", marginBottom:"3px" }}>Bill To</div>
                  <div style={{ fontWeight:700, fontSize:"12px" }}>{invoice.customer_name}</div>
                  {invoice.customer_phone && <div style={{ color:"#6b7280", fontSize:"9.5px", marginTop:"2px" }}>{invoice.customer_phone}</div>}
                  {(invoice.customer_email || invoice.customer_address) && (
                    <div style={{ color:"#9ca3af", fontSize:"8.5px", marginTop:"1px",
                                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"140px" }}>
                      {invoice.customer_email || (invoice.customer_address ?? "").split("\n")[0]}
                    </div>
                  )}
                  {invoice.customer_gst && <div style={{ color:"#9ca3af", fontSize:"8px", marginTop:"1px" }}>GST: {invoice.customer_gst}</div>}
                </div>
                <div style={{ fontSize:"9px" }}>
                  <div style={{ fontSize:"7.5px", textTransform:"uppercase", letterSpacing:"1px", color:"#9ca3af", marginBottom:"3px" }}>Invoice Details</div>
                  {[
                    ["Invoice No", invoice.invoice_number, true],
                    ["Issue Date", invoice.issue_date, false],
                    ["Due Date",   invoice.due_date ?? "—", false],
                    ...(invoice.payment_terms ? [["Terms", invoice.payment_terms, false]] : []),
                  ].map(([k, v, mono]) => (
                    <div key={String(k)} style={{ display:"flex", justifyContent:"space-between", marginBottom:"2px" }}>
                      <span style={{ color:"#9ca3af" }}>{k}</span>
                      <span style={{ fontFamily: mono ? "monospace" : undefined, fontWeight: mono ? 600 : 400 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display:"flex", justifyContent:"space-between", paddingTop:"3px", borderTop:"1px solid #f3f4f6" }}>
                    <span style={{ color:"#9ca3af" }}>Status</span>
                    <span style={{ fontWeight:700, color: pStatusColor() }}>{pStatus}</span>
                  </div>
                </div>
              </div>

              {/* Items compact */}
              <div style={{ padding:"8px 18px" }}>
                <div style={{ fontSize:"7.5px", textTransform:"uppercase", letterSpacing:"1px", color:"#9ca3af", marginBottom:"5px" }}>Items</div>
                {invoice.items && invoice.items.length > 0 ? (
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"9px" }}>
                    <thead>
                      <tr style={{ borderBottom:"1.5px solid #e5e7eb" }}>
                        {["Description","Qty","Rate","Tax%","Total"].map((h, i) => (
                          <th key={h} style={{ textAlign: i===0 ? "left" : "right", paddingBottom:"3px",
                                              color:"#9ca3af", fontWeight:600, fontSize:"8px",
                                              width: i===0 ? undefined : i===1 ? "28px" : "54px" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item) => (
                        <tr key={item.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                          <td style={{ padding:"3px 0", color:"#374151" }}>{item.description}</td>
                          <td style={{ padding:"3px 0", textAlign:"right", color:"#6b7280" }}>{item.quantity}</td>
                          <td style={{ padding:"3px 0", textAlign:"right", fontFamily:"monospace" }}>₹{fmt(item.unit_price)}</td>
                          <td style={{ padding:"3px 0", textAlign:"right", color:"#9ca3af" }}>{item.tax_percent}%</td>
                          <td style={{ padding:"3px 0", textAlign:"right", fontFamily:"monospace", fontWeight:600 }}>₹{fmt(item.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div style={{ color:"#9ca3af", fontSize:"9px" }}>No items.</div>}
              </div>

              {/* Totals compact */}
              <div style={{ padding:"6px 18px 8px", borderTop:"1px solid #e5e7eb", background:"#fafaf9" }}>
                <div style={{ display:"flex", justifyContent:"flex-end" }}>
                  <div style={{ width:"165px", fontSize:"9px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", color:"#6b7280", marginBottom:"2px" }}>
                      <span>Subtotal</span><span style={{ fontFamily:"monospace" }}>₹{fmt(invoice.subtotal)}</span>
                    </div>
                    {Number(invoice.discount_total ?? 0) > 0 && (
                      <div style={{ display:"flex", justifyContent:"space-between", color:"#d97706", marginBottom:"2px" }}>
                        <span>Discount</span><span style={{ fontFamily:"monospace" }}>−₹{fmt(invoice.discount_total ?? 0)}</span>
                      </div>
                    )}
                    <div style={{ display:"flex", justifyContent:"space-between", color:"#6b7280", marginBottom:"2px" }}>
                      <span>Tax</span><span style={{ fontFamily:"monospace" }}>₹{fmt(invoice.tax_total)}</span>
                    </div>
                    {Number(invoice.other_charges ?? 0) > 0 && (
                      <div style={{ display:"flex", justifyContent:"space-between", color:"#6b7280", marginBottom:"2px" }}>
                        <span>Other Charges</span><span style={{ fontFamily:"monospace" }}>₹{fmt(invoice.other_charges ?? 0)}</span>
                      </div>
                    )}
                    <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:"11px",
                                  borderTop:"1.5px solid #374151", paddingTop:"3px", marginTop:"2px", marginBottom:"2px" }}>
                      <span>Grand Total</span><span style={{ fontFamily:"monospace" }}>₹{fmt(invoice.total)}</span>
                    </div>
                    {Number(invoice.amount_paid) > 0 && (
                      <div style={{ display:"flex", justifyContent:"space-between", color:"#059669", fontWeight:600, marginBottom:"2px" }}>
                        <span>Paid</span><span style={{ fontFamily:"monospace" }}>₹{fmt(invoice.amount_paid)}</span>
                      </div>
                    )}
                    <div style={{ display:"flex", justifyContent:"space-between", fontWeight:700,
                                  borderTop:"1px solid #e5e7eb", paddingTop:"2px",
                                  color: Number(invoice.balance_due) > 0.001 ? "#dc2626" : "#059669" }}>
                      <span>Balance</span><span style={{ fontFamily:"monospace" }}>₹{fmt(invoice.balance_due)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes (1 line) */}
              {invoice.notes && (
                <div style={{ padding:"5px 18px", borderTop:"1px solid #e5e7eb", fontSize:"8px", color:"#9ca3af",
                              overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                  <span style={{ fontWeight:600, color:"#6b7280" }}>Notes: </span>
                  {invoice.notes.slice(0, 120)}{invoice.notes.length > 120 ? "…" : ""}
                </div>
              )}

              {/* Footer */}
              <div style={{ padding:"8px 18px", borderTop:"1px solid #e5e7eb",
                            display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                <div>
                  <div style={{ color:"#0F6E56", fontWeight:700, fontSize:"10px" }}>Thank you for your business!</div>
                  <div style={{ color:"#9ca3af", fontSize:"8px", marginTop:"1px" }}>{companyName}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ color:"#9ca3af", fontSize:"8px", marginBottom:"14px" }}>Authorized Signature</div>
                  <div style={{ borderBottom:"1px solid #6b7280", width:"72px" }}></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          LAYOUT 3 — POS Thermal Receipt 35×55mm
          Screen: scaled preview (no-print) + hidden print div
      ════════════════════════════════════════════════════════ */}
      {printSize === "small" && (
        <>
          <p className="no-print text-xs text-muted">
            POS Thermal Receipt Preview (scaled 2.5×) — Actual print: 35mm × 55mm
          </p>

          {/* Screen-only scaled preview — hidden in print via no-print */}
          <div className="no-print" style={{ width: "332px", height: "520px", overflow: "hidden" }}>
            <div style={{ transform: "scale(2.5)", transformOrigin: "top left", display: "inline-block" }}>
              <div style={{
                width: "35mm", height: "55mm", padding: "1.5mm", boxSizing: "border-box",
                overflow: "hidden", background: "white", color: "black",
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: "6px", lineHeight: "1.15",
                border: "1px solid #d1d5db",
              }}>
                {smallReceiptContent}
              </div>
            </div>
          </div>

          {/* Hidden print div — position fixed off-screen on screen,
              moved to 0,0 by print CSS; no transform ancestor so position:fixed works */}
          <div
            className="print-selected small-35x55"
            style={{
              position: "fixed", left: "-9999px", top: "-9999px",
              width: "35mm", height: "55mm", padding: "1.5mm",
              boxSizing: "border-box", overflow: "hidden",
              background: "white", color: "black",
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "6px", lineHeight: "1.15",
            }}
          >
            {smallReceiptContent}
          </div>
        </>
      )}

      {/* ── Invoice Management (no-print) ── */}
      <div className="no-print bg-surface border border-line rounded-xl p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Invoice Management</div>
        <div className="flex flex-wrap items-center gap-2">
          {transitions.map((t) => (
            <button key={t.next} onClick={() => changeStatus(t.next)}
              className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface/80 transition-colors">
              {t.label}
            </button>
          ))}

          {invoice.status !== "void" && invoice.status !== "paid" && (
            <button
              onClick={() => {
                setShowPayment(true);
                setPmtError(null);
                setPmtForm({
                  amount: String(invoice.balance_due),
                  payment_date: new Date().toISOString().slice(0, 10),
                  method: "cash", reference: "", notes: "",
                });
              }}
              className="flex items-center gap-1.5 rounded-lg border border-accent text-accent px-4 py-2 text-sm hover:bg-accent/5 transition-colors">
              <Plus size={14} /> Record Payment
            </button>
          )}

          {invoice.status === "draft" && (
            <button onClick={handleDelete}
              className="ml-auto flex items-center gap-1.5 text-sm text-danger hover:underline">
              <Trash2 size={14} /> Delete Invoice
            </button>
          )}
        </div>
      </div>

      {/* ── Record Payment Modal (no-print) ── */}
      {showPayment && (
        <div className="no-print fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <form onSubmit={submitPayment}
            className="bg-surface border border-line rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink">Record Payment</h2>
              <button type="button" onClick={() => setShowPayment(false)} className="text-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Amount *</span>
              <input type="number" step="0.01" min="0.01" required className={inputCls}
                value={pmtForm.amount}
                onChange={(e) => setPmtForm({ ...pmtForm, amount: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Date *</span>
              <input type="date" required className={inputCls}
                value={pmtForm.payment_date}
                onChange={(e) => setPmtForm({ ...pmtForm, payment_date: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Method</span>
              <select className={inputCls} value={pmtForm.method}
                onChange={(e) => setPmtForm({ ...pmtForm, method: e.target.value })}>
                {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Reference / UTR</span>
              <input className={inputCls} placeholder="Optional"
                value={pmtForm.reference}
                onChange={(e) => setPmtForm({ ...pmtForm, reference: e.target.value })} />
            </label>
            {pmtError && <p className="text-sm text-danger">{pmtError}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setShowPayment(false)}
                className="px-4 py-2 text-sm rounded-lg border border-line hover:bg-surface transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="px-4 py-2 text-sm rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors">
                Save Payment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
