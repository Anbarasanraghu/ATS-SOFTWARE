import { useEffect, useState, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, FileCheck, MessageCircle, Printer, Save,
  UserCircle, FileText, AlignLeft, CreditCard, ClipboardList, BarChart2,
} from "lucide-react";
import { api, type Customer, type Product } from "../lib/api";

// ── Constants ─────────────────────────────────────────────────
const DEFAULT_TERMS =
  "1. Goods once sold will not be taken back.\n" +
  "2. Payment should be completed before the due date.\n" +
  "3. Warranty / service terms apply as per company policy.";

const PAYMENT_TERMS_OPTIONS = ["Due on Receipt", "7 Days", "15 Days", "30 Days", "Custom"];
const STATUS_OPTIONS = ["draft", "sent", "paid", "void"];
const PAYMENT_METHODS = [
  { value: "cash",          label: "Cash" },
  { value: "upi",           label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card",          label: "Card" },
  { value: "cheque",        label: "Cheque" },
  { value: "other",         label: "Other" },
];

// ── Types ─────────────────────────────────────────────────────
type DiscountType = "amount" | "percent";
type Line = {
  product_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  tax_percent: string;
  discount: string;
  discount_type: DiscountType;
};

const blankLine = (): Line => ({
  product_id: "", description: "", quantity: "1",
  unit_price: "0", tax_percent: "0", discount: "0", discount_type: "amount",
});

// ── Helpers ───────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => n.toFixed(2);

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function calcDueDateFromTerms(terms: string, issueDate: string): string {
  if (!issueDate) return "";
  if (terms === "Due on Receipt") return issueDate;
  if (terms === "7 Days")  return addDays(issueDate, 7);
  if (terms === "15 Days") return addDays(issueDate, 15);
  if (terms === "30 Days") return addDays(issueDate, 30);
  return "";
}

function buildWaPhone(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 10) return "91" + d;
  if (d.length > 10) return d;
  return null;
}

function lineDiscountVal(l: Line): number {
  const qty = parseFloat(l.quantity) || 0;
  const price = parseFloat(l.unit_price) || 0;
  const disc = parseFloat(l.discount) || 0;
  return l.discount_type === "percent" ? qty * price * disc / 100 : disc;
}

function lineBaseAmt(l: Line): number {
  const qty = parseFloat(l.quantity) || 0;
  const price = parseFloat(l.unit_price) || 0;
  return qty * price - lineDiscountVal(l);
}

function lineTaxAmt(l: Line): number {
  return lineBaseAmt(l) * (parseFloat(l.tax_percent) || 0) / 100;
}

function lineTotalAmt(l: Line): number {
  return Math.max(0, lineBaseAmt(l) + lineTaxAmt(l));
}

// ── Shared input style ────────────────────────────────────────
const IC = "w-full border border-line rounded-lg px-3 py-2 text-sm bg-paper outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

// ── Section card with icon ────────────────────────────────────
function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-5">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-line">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10 text-accent flex-shrink-0">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Label + field wrapper ─────────────────────────────────────
function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1.5">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function NewInvoicePage() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [nextNumber, setNextNumber] = useState("Auto-generated");

  // Customer
  const [customerId, setCustomerId]           = useState("");
  const [customerName, setCustomerName]       = useState("");
  const [customerPhone, setCustomerPhone]     = useState("");
  const [customerEmail, setCustomerEmail]     = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGst, setCustomerGst]         = useState("");

  // Invoice details
  const [issueDate, setIssueDate]         = useState(todayISO());
  const [paymentTerms, setPaymentTerms]   = useState("");
  const [dueDate, setDueDate]             = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("draft");

  // Line items
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [otherCharges, setOtherCharges] = useState("0");

  // Payment
  const [paidAmount, setPaidAmount] = useState("0");
  const [payMethod, setPayMethod]   = useState("cash");
  const [transactionId, setTransId] = useState("");
  const [paymentDate, setPayDate]   = useState(todayISO());
  const [paymentNotes, setPayNotes] = useState("");

  // Notes / Terms
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(DEFAULT_TERMS);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.listCustomers(),
      api.listProducts(),
      api.getNextInvoiceNumber(),
      api.getInvoiceSettings().catch(() => null),
    ]).then(([custs, prods, nn, invCfg]) => {
      setCustomers(custs);
      setProducts(prods);
      setNextNumber(nn.invoice_number);
      if (invCfg) {
        if (invCfg.default_payment_terms) setPaymentTerms(invCfg.default_payment_terms);
        if (invCfg.default_terms)         setTerms(invCfg.default_terms);
        if (invCfg.default_tax_percent != null && invCfg.default_tax_percent > 0) {
          setLines([{ ...blankLine(), tax_percent: String(invCfg.default_tax_percent) }]);
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (paymentTerms && paymentTerms !== "Custom") {
      setDueDate(calcDueDateFromTerms(paymentTerms, issueDate));
    }
  }, [paymentTerms, issueDate]);

  function pickCustomer(id: string) {
    setCustomerId(id);
    const c = customers.find(x => x.id === id);
    if (!c) return;
    setCustomerName(c.name);
    setCustomerPhone(c.phone ?? "");
    setCustomerEmail(c.email ?? "");
    setCustomerAddress(c.address ?? "");
  }

  function pickProduct(i: number, productId: string) {
    const p = products.find(x => x.id === productId);
    setLines(ls => ls.map((l, idx) => idx !== i ? l : {
      ...l,
      product_id: productId,
      description: p?.name ?? "",
      unit_price: p ? String(p.price) : "0",
      tax_percent: p ? String(p.tax_percent) : "0",
    }));
  }

  function updateLine<K extends keyof Line>(i: number, field: K, value: Line[K]) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  function addLine() { setLines(ls => [...ls, blankLine()]); }
  function removeLine(i: number) {
    if (lines.length === 1) return;
    setLines(ls => ls.filter((_, idx) => idx !== i));
  }

  const totals = useMemo(() => {
    const subtotal      = lines.reduce((s, l) => s + (parseFloat(l.quantity)||0) * (parseFloat(l.unit_price)||0), 0);
    const totalDiscount = lines.reduce((s, l) => s + lineDiscountVal(l), 0);
    const totalTax      = lines.reduce((s, l) => s + lineTaxAmt(l), 0);
    const other         = parseFloat(otherCharges) || 0;
    const grandTotal    = subtotal - totalDiscount + totalTax + other;
    const paid          = parseFloat(paidAmount) || 0;
    const balance       = Math.max(0, grandTotal - paid);
    return { subtotal, totalDiscount, totalTax, other, grandTotal, paid, balance };
  }, [lines, otherCharges, paidAmount]);

  const payStatusLabel =
    totals.paid <= 0 ? "Payment Pending" :
    totals.balance > 0.001 ? "Partially Paid" : "Paid";

  const lineCount = lines.filter(l => l.description.trim()).length;

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!customerName.trim()) errs.customerName = "Customer name is required";
    if (!customerPhone.trim()) errs.customerPhone = "Customer phone is required";
    if (!issueDate) errs.issueDate = "Issue date is required";
    const validLines = lines.filter(l => l.description.trim());
    if (validLines.length === 0) errs.lines = "At least one line item is required";
    validLines.forEach((l, i) => {
      if ((parseFloat(l.quantity)||0) <= 0) errs[`qty_${i}`] = "Qty must be > 0";
      if ((parseFloat(l.unit_price)||0) < 0) errs[`price_${i}`] = "Price must be ≥ 0";
    });
    if (totals.paid > totals.grandTotal + 0.001) errs.paidAmount = "Paid amount cannot exceed grand total";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function saveInvoice(targetStatus: string): Promise<string | null> {
    if (!validate()) return null;
    setSaving(true);
    try {
      const body = {
        customer_id: customerId || null,
        customer_name: customerName.trim(),
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        customer_address: customerAddress || null,
        customer_gst: customerGst || null,
        payment_terms: paymentTerms || null,
        issue_date: issueDate,
        due_date: dueDate || null,
        status: targetStatus,
        notes: notes || null,
        terms: terms || null,
        other_charges: parseFloat(otherCharges) || 0,
        items: lines
          .filter(l => l.description.trim())
          .map(l => ({
            product_id: l.product_id || null,
            description: l.description.trim(),
            quantity: parseFloat(l.quantity) || 1,
            unit_price: parseFloat(l.unit_price) || 0,
            tax_percent: parseFloat(l.tax_percent) || 0,
            discount: parseFloat(l.discount) || 0,
            discount_type: l.discount_type,
          })),
        initial_payment: (parseFloat(paidAmount) || 0) > 0 ? {
          amount: parseFloat(paidAmount),
          method: payMethod,
          reference: transactionId || null,
          payment_date: paymentDate || issueDate,
          notes: paymentNotes || null,
        } : null,
      };
      const inv = await api.createInvoice(body);
      return (inv as { id: string }).id;
    } catch (e: unknown) {
      setErrors({ submit: e instanceof Error ? e.message : "Failed to create invoice" });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    const id = await saveInvoice(invoiceStatus);
    if (id) navigate(`/billing/${id}`);
  }

  async function handleDraft() {
    const id = await saveInvoice("draft");
    if (id) navigate("/billing");
  }

  async function handlePrint() {
    const id = await saveInvoice(invoiceStatus);
    if (id) {
      window.open(`/billing/${id}`, "_blank");
      navigate("/billing");
    }
  }

  async function handleWhatsApp() {
    const id = await saveInvoice(invoiceStatus);
    if (!id) return;
    const wa = buildWaPhone(customerPhone);
    if (wa) {
      const msg =
        `Hi ${customerName},\n\n` +
        `Your invoice ${nextNumber} has been generated.\n\n` +
        `Total Amount: ₹${fmt(totals.grandTotal)}\n` +
        `Paid Amount: ₹${fmt(totals.paid)}\n` +
        `Balance Amount: ₹${fmt(totals.balance)}\n` +
        `Due Date: ${dueDate || "N/A"}\n\n` +
        `Please check and complete the payment.\n\nThank you.`;
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    }
    navigate("/billing");
  }

  // ── Shared table cell input style ─────────────────────────────
  const TI = "w-full border border-line rounded-md px-2 py-1.5 text-sm bg-paper outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/billing")}
          className="p-2 rounded-lg hover:bg-surface text-muted hover:text-ink transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <nav className="text-xs text-muted mb-0.5">
            Dashboard &rsaquo; Invoices &rsaquo; <span className="text-ink">New Invoice</span>
          </nav>
          <h1 className="text-xl font-semibold text-ink">New Invoice</h1>
        </div>
      </div>

      {/* ── Main body ── */}
      <div className="flex-1 space-y-5 pb-28">

        {/* ── Row 1: Customer Details + Invoice Details (2-col) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Left: Customer Details */}
          <Section icon={<UserCircle size={15} />} title="Customer Details">
            <div className="space-y-4">
              <Field label="Select Customer from CRM">
                <select className={IC} value={customerId} onChange={e => pickCustomer(e.target.value)}>
                  <option value="">— Select customer (or fill manually below) —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.phone ? ` · ${c.phone}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Customer Name" required error={errors.customerName}>
                  <input className={IC} value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Full name or company" />
                </Field>
                <Field label="Customer Phone" required error={errors.customerPhone}>
                  <input type="tel" className={IC} value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="10-digit mobile number" />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Customer Email">
                  <input type="email" className={IC} value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                    placeholder="email@example.com" />
                </Field>
                <Field label="GST Number (Optional)">
                  <input className={IC} value={customerGst}
                    onChange={e => setCustomerGst(e.target.value)}
                    placeholder="33ABCDE1234F1Z5" />
                </Field>
              </div>

              <Field label="Customer Address">
                <textarea className={`${IC} resize-none`} rows={2} value={customerAddress}
                  onChange={e => setCustomerAddress(e.target.value)}
                  placeholder="Billing / shipping address" />
              </Field>
            </div>
          </Section>

          {/* Right: Invoice Details */}
          <Section icon={<FileText size={15} />} title="Invoice Details">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Invoice Number">
                  <div className={`${IC} bg-surface/60 text-muted cursor-default select-none`}>
                    {nextNumber}
                  </div>
                </Field>
                <Field label="Invoice Status">
                  <select className={IC} value={invoiceStatus} onChange={e => setInvoiceStatus(e.target.value)}>
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Issue Date" required error={errors.issueDate}>
                  <input type="date" className={IC} value={issueDate}
                    onChange={e => setIssueDate(e.target.value)} />
                </Field>
                <Field label="Payment Terms">
                  <select className={IC} value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
                    <option value="">— None —</option>
                    {PAYMENT_TERMS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Due Date">
                {paymentTerms && paymentTerms !== "Custom" ? (
                  <div className={`${IC} bg-surface/60 text-muted cursor-default select-none`}>
                    {dueDate || "—"}
                  </div>
                ) : (
                  <input type="date" className={IC} value={dueDate}
                    onChange={e => setDueDate(e.target.value)} />
                )}
              </Field>
            </div>
          </Section>
        </div>

        {/* ── Row 2: Line Items (full width) ── */}
        <Section icon={<AlignLeft size={15} />} title="Line Items">
          {errors.lines && (
            <p className="text-xs text-danger mb-3 -mt-1">{errors.lines}</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2.5 pr-2 text-left font-medium w-7">#</th>
                  <th className="pb-2.5 pr-2 text-left font-medium w-36">Product / Service</th>
                  <th className="pb-2.5 pr-2 text-left font-medium">Description</th>
                  <th className="pb-2.5 pr-2 text-right font-medium w-16">Qty</th>
                  <th className="pb-2.5 pr-2 text-right font-medium w-28">Unit Price (₹)</th>
                  <th className="pb-2.5 pr-2 text-right font-medium w-20">Tax %</th>
                  <th className="pb-2.5 pr-2 text-right font-medium w-32">Discount (₹)</th>
                  <th className="pb-2.5 pr-2 text-right font-medium w-26">Total (₹)</th>
                  <th className="pb-2.5 w-8 text-center font-medium">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {lines.map((l, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-2 pr-2 pt-3 text-xs text-muted text-center">{i + 1}</td>
                    <td className="py-2 pr-2">
                      <select className={`${TI} text-xs`} value={l.product_id}
                        onChange={e => pickProduct(i, e.target.value)}>
                        <option value="">— Select —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input className={TI} placeholder="Item description"
                        value={l.description}
                        onChange={e => updateLine(i, "description", e.target.value)} />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" min="0.001" step="0.001"
                        className={`${TI} text-right`}
                        value={l.quantity}
                        onChange={e => updateLine(i, "quantity", e.target.value)} />
                      {errors[`qty_${i}`] && (
                        <p className="text-xs text-danger mt-0.5">{errors[`qty_${i}`]}</p>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" min="0" step="0.01"
                        className={`${TI} text-right`}
                        value={l.unit_price}
                        onChange={e => updateLine(i, "unit_price", e.target.value)} />
                      {errors[`price_${i}`] && (
                        <p className="text-xs text-danger mt-0.5">{errors[`price_${i}`]}</p>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <select className={`${TI} text-xs`} value={l.tax_percent}
                        onChange={e => updateLine(i, "tax_percent", e.target.value)}>
                        {["0", "5", "12", "18", "28"].map(t => (
                          <option key={t} value={t}>{t}%</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex gap-1">
                        <input type="number" min="0" step="0.01"
                          className={`${TI} text-right`}
                          value={l.discount}
                          onChange={e => updateLine(i, "discount", e.target.value)} />
                        <select
                          className="border border-line rounded-md px-1 py-1 text-xs bg-paper outline-none focus:border-accent w-10 flex-shrink-0"
                          value={l.discount_type}
                          onChange={e => updateLine(i, "discount_type", e.target.value as DiscountType)}>
                          <option value="amount">₹</option>
                          <option value="percent">%</option>
                        </select>
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <span className="font-mono text-sm font-semibold text-ink">
                        ₹{fmt(lineTotalAmt(l))}
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      <button type="button" onClick={() => removeLine(i)}
                        className="p-1.5 text-muted hover:text-danger hover:bg-red-50 rounded-md transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-line">
            <button type="button" onClick={addLine}
              className="flex items-center gap-1.5 text-sm text-accent hover:underline font-medium">
              <Plus size={14} /> Add Line Item
            </button>
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted whitespace-nowrap">Other Charges (₹)</label>
              <input type="number" min="0" step="0.01"
                className="w-32 border border-line rounded-lg px-3 py-1.5 text-sm text-right bg-paper outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                value={otherCharges}
                onChange={e => setOtherCharges(e.target.value)} />
            </div>
          </div>
        </Section>

        {/* ── Row 3: Payment Details + Notes & Terms (2-col) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Left: Payment Details */}
          <Section icon={<CreditCard size={15} />} title="Payment Details">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Payment Status">
                  <div className={`${IC} bg-surface/60 cursor-default font-medium ${
                    payStatusLabel === "Paid"           ? "text-emerald-600" :
                    payStatusLabel === "Partially Paid" ? "text-amber-600"   : "text-muted"
                  }`}>{payStatusLabel}</div>
                </Field>
                <Field label="Paid Amount (₹)" error={errors.paidAmount}>
                  <input type="number" min="0" step="0.01" className={IC}
                    placeholder="0.00" value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Payment Method">
                  <select className={IC} value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Transaction ID / Reference No">
                  <input className={IC} placeholder="UTR / Ref No."
                    value={transactionId} onChange={e => setTransId(e.target.value)} />
                </Field>
              </div>

              <Field label="Payment Date">
                <input type="date" className={IC} value={paymentDate}
                  onChange={e => setPayDate(e.target.value)} />
              </Field>

              <Field label="Payment Notes">
                <textarea className={`${IC} resize-none`} rows={3}
                  placeholder="Optional notes about this payment"
                  value={paymentNotes} onChange={e => setPayNotes(e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* Right: Notes & Terms */}
          <Section icon={<ClipboardList size={15} />} title="Notes & Terms">
            <div className="space-y-4">
              <Field label="Invoice Notes">
                <textarea className={`${IC} resize-none`} rows={3}
                  placeholder="Additional information for this invoice…"
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </Field>
              <Field label="Terms & Conditions">
                <textarea className={`${IC} resize-none font-mono text-xs leading-relaxed`} rows={6}
                  value={terms} onChange={e => setTerms(e.target.value)} />
              </Field>
            </div>
          </Section>
        </div>

        {/* ── Row 4: Invoice Summary (full width, bottom) ── */}
        <div className="bg-surface border border-line rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-line">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10 text-accent flex-shrink-0">
              <BarChart2 size={15} />
            </span>
            <h3 className="text-sm font-semibold text-ink">Invoice Summary</h3>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-start gap-6">
            {/* Amount columns */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-x-6 gap-y-5">
              <div>
                <p className="text-xs text-muted mb-1">Subtotal</p>
                <p className="text-sm font-semibold text-ink font-mono">₹{fmt(totals.subtotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Tax</p>
                <p className="text-sm font-semibold text-ink font-mono">₹{fmt(totals.totalTax)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Discount</p>
                <p className={`text-sm font-semibold font-mono ${totals.totalDiscount > 0 ? "text-amber-600" : "text-ink"}`}>
                  {totals.totalDiscount > 0 ? `−₹${fmt(totals.totalDiscount)}` : `₹${fmt(totals.totalDiscount)}`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Other Charges</p>
                <p className="text-sm font-semibold text-ink font-mono">₹{fmt(totals.other)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Grand Total</p>
                <p className="text-lg font-bold text-ink font-mono">₹{fmt(totals.grandTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Paid Amount</p>
                <p className={`text-sm font-semibold font-mono ${totals.paid > 0 ? "text-emerald-600" : "text-ink"}`}>
                  ₹{fmt(totals.paid)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Balance Due</p>
                <p className={`text-sm font-bold font-mono ${totals.balance > 0.001 ? "text-danger" : "text-emerald-600"}`}>
                  ₹{fmt(totals.balance)}
                </p>
              </div>
            </div>

            {/* Right meta panel */}
            <div className="lg:border-l lg:border-line lg:pl-6 flex flex-wrap lg:flex-col gap-4 lg:gap-3 min-w-[180px]">
              <div>
                <p className="text-xs text-muted mb-1.5">Payment Status</p>
                <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                  payStatusLabel === "Paid"
                    ? "bg-emerald-100 text-emerald-700"
                    : payStatusLabel === "Partially Paid"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-surface-2 text-muted"
                }`}>{payStatusLabel}</span>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Due Date</p>
                <p className="text-sm font-medium text-ink">{dueDate || "Not set"}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Line Items</p>
                <p className="text-sm font-medium text-ink">
                  {lineCount} {lineCount === 1 ? "Item" : "Items"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit error */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {errors.submit}
          </div>
        )}
      </div>

      {/* ── Sticky Footer: Action Buttons ── */}
      <div className="sticky bottom-0 left-0 right-0 -mx-6 px-6 py-4 bg-paper border-t border-line z-10">
        <div className="flex flex-wrap gap-2 justify-between items-center">
          <button type="button" onClick={() => navigate("/billing")}
            className="px-4 py-2 text-sm border border-line rounded-lg hover:bg-surface text-ink transition-colors">
            Cancel
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving} onClick={handleDraft}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-line rounded-lg hover:bg-surface text-ink disabled:opacity-50 transition-colors">
              <Save size={14} /> Save as Draft
            </button>
            <button type="button" disabled={saving} onClick={handleCreate}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 font-medium disabled:opacity-50 transition-colors">
              <FileCheck size={14} />
              {saving ? "Creating…" : "Create Invoice"}
            </button>
            <button type="button" disabled={saving} onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-accent text-accent rounded-lg hover:bg-accent/5 disabled:opacity-50 transition-colors">
              <Printer size={14} /> Create & Print
            </button>
            <button type="button" disabled={saving} onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
              <MessageCircle size={14} /> {saving ? "Saving…" : "Create & Send WhatsApp"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
