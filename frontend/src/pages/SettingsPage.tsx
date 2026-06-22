import { useEffect, useRef, useState } from "react";
import { Building2, FileText, Printer, Users, Bell, Plug, CreditCard, Upload, X, Clock } from "lucide-react";
import {
  api,
  type CompanySettings,
  type InvoiceSettings,
  type PrintSettings,
} from "../lib/api";

type Tab = "company" | "invoice" | "print" | "users" | "notifications" | "integrations" | "billing";

const TABS: { id: Tab; label: string; icon: React.ElementType; comingSoon?: boolean }[] = [
  { id: "company",       label: "Company",        icon: Building2 },
  { id: "invoice",       label: "Invoice",         icon: FileText },
  { id: "print",         label: "Print",           icon: Printer },
  { id: "users",         label: "Users & Roles",   icon: Users,        comingSoon: true },
  { id: "notifications", label: "Notifications",   icon: Bell,         comingSoon: true },
  { id: "integrations",  label: "Integrations",    icon: Plug,         comingSoon: true },
  { id: "billing",       label: "Billing & Plan",  icon: CreditCard,   comingSoon: true },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4">
      <label className="text-sm font-medium text-ink pt-2">{label}</label>
      <div>{children}</div>
    </div>
  );
}

const INPUT = "w-full border border-line rounded-lg px-3 py-2 text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent";
const TEXTAREA = `${INPUT} resize-none`;

// ── Company Settings Tab ───────────────────────────────────────

function CompanyTab() {
  const [form, setForm] = useState<CompanySettings>({
    company_name: "", company_logo: null, email: "", phone: "",
    address: "", gst_number: "", website: "", upi_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getCompanySettings().then(d => setForm(f => ({ ...f, ...d })));
  }, []);

  function set(k: keyof CompanySettings, v: string | null) {
    setForm(f => ({ ...f, [k]: v }));
    setSaved(false);
  }

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("company_logo", reader.result as string);
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      await api.saveCompanySettings(form);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <Field label="Company Logo">
        <div className="flex items-center gap-4">
          {form.company_logo ? (
            <div className="relative">
              <img src={form.company_logo} alt="logo" className="h-16 w-auto max-w-[160px] object-contain border border-line rounded-lg p-1 bg-white" />
              <button
                onClick={() => { set("company_logo", null); if (fileRef.current) fileRef.current.value = ""; }}
                className="absolute -top-2 -right-2 bg-white border border-line rounded-full p-0.5 text-muted hover:text-danger">
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="h-16 w-40 border-2 border-dashed border-line rounded-lg flex items-center justify-center text-muted text-xs">
              No logo
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 border border-line rounded-lg text-sm text-muted hover:text-ink hover:bg-line/40 transition-colors">
            <Upload size={14} /> Upload
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
        </div>
      </Field>

      <Field label="Company Name">
        <input className={INPUT} value={form.company_name ?? ""} onChange={e => set("company_name", e.target.value)} placeholder="Your Company Name" />
      </Field>
      <Field label="Email">
        <input className={INPUT} type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} placeholder="contact@company.com" />
      </Field>
      <Field label="Phone">
        <input className={INPUT} value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} placeholder="+91 98765 43210" />
      </Field>
      <Field label="Address">
        <textarea className={TEXTAREA} rows={3} value={form.address ?? ""} onChange={e => set("address", e.target.value)} placeholder="Street, City, State, PIN" />
      </Field>
      <Field label="GST Number">
        <input className={INPUT} value={form.gst_number ?? ""} onChange={e => set("gst_number", e.target.value)} placeholder="22AAAAA0000A1Z5" />
      </Field>
      <Field label="Website">
        <input className={INPUT} value={form.website ?? ""} onChange={e => set("website", e.target.value)} placeholder="https://yourcompany.com" />
      </Field>
      <Field label="UPI ID">
        <input className={INPUT} value={form.upi_id ?? ""} onChange={e => set("upi_id", e.target.value)} placeholder="yourname@upi" />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-60 transition-colors">
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
      </div>
    </div>
  );
}

// ── Invoice Settings Tab ──────────────────────────────────────

const DEFAULT_TERMS = `1. Payment is due within the specified payment terms from the invoice date.
2. Late payments may incur additional charges.
3. Goods once sold will not be taken back.
4. All disputes subject to local jurisdiction.`;

function InvoiceTab() {
  const [form, setForm] = useState<InvoiceSettings>({
    invoice_prefix: "INV", next_invoice_number: 1, default_tax_percent: 0,
    default_payment_terms: "", default_terms: DEFAULT_TERMS, invoice_footer_note: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getInvoiceSettings().then(d => setForm(f => ({ ...f, ...d })));
  }, []);

  function set(k: keyof InvoiceSettings, v: string | number | null) {
    setForm(f => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      await api.saveInvoiceSettings(form);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <Field label="Invoice Prefix">
        <input className={INPUT} value={form.invoice_prefix ?? "INV"} onChange={e => set("invoice_prefix", e.target.value)} placeholder="INV" maxLength={10} />
        <p className="text-xs text-muted mt-1">Invoice numbers will appear as INV-0001, INV-0002…</p>
      </Field>
      <Field label="Next Invoice #">
        <input className={INPUT} type="number" min={1} value={form.next_invoice_number ?? 1} onChange={e => set("next_invoice_number", parseInt(e.target.value) || 1)} />
        <p className="text-xs text-muted mt-1">The sequence number for the next invoice created.</p>
      </Field>
      <Field label="Default Tax %">
        <input className={INPUT} type="number" min={0} max={100} step={0.01} value={form.default_tax_percent ?? 0} onChange={e => set("default_tax_percent", parseFloat(e.target.value) || 0)} />
      </Field>
      <Field label="Default Payment Terms">
        <input className={INPUT} value={form.default_payment_terms ?? ""} onChange={e => set("default_payment_terms", e.target.value)} placeholder="e.g. Net 30 days" />
      </Field>
      <Field label="Default Terms & Conditions">
        <textarea className={TEXTAREA} rows={5} value={form.default_terms ?? ""} onChange={e => set("default_terms", e.target.value)} />
      </Field>
      <Field label="Footer Note">
        <input className={INPUT} value={form.invoice_footer_note ?? ""} onChange={e => set("invoice_footer_note", e.target.value)} placeholder="e.g. Thank you for your business!" />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-60 transition-colors">
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
      </div>
    </div>
  );
}

// ── Print Settings Tab ────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${checked ? "bg-accent" : "bg-line"}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

function PrintTab() {
  const [form, setForm] = useState<PrintSettings>({
    default_print_size: "a4", enable_a4_full: true, enable_a4_half: true,
    enable_33x55: true, show_logo: true, show_gst: true, show_terms: true, show_signature: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getPrintSettings().then(d => setForm(f => ({ ...f, ...d })));
  }, []);

  function set<K extends keyof PrintSettings>(k: K, v: PrintSettings[K]) {
    setForm(f => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      await api.savePrintSettings(form);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Default Print Size</h3>
        <div className="flex gap-3">
          {[
            { value: "a4",   label: "A4 Full Sheet" },
            { value: "half", label: "A4 Half Sheet" },
            { value: "small",label: "35mm × 55mm" },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => set("default_print_size", opt.value)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                form.default_print_size === opt.value
                  ? "bg-accent text-white border-accent"
                  : "border-line text-muted hover:text-ink hover:bg-line/40"
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Enable Print Sizes</h3>
        <div className="space-y-3">
          {[
            { key: "enable_a4_full" as const,  label: "A4 Full Sheet" },
            { key: "enable_a4_half" as const,  label: "A4 Half Sheet" },
            { key: "enable_33x55"  as const,   label: "35mm × 55mm (POS Thermal)" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-line/60 last:border-0">
              <span className="text-sm text-ink">{label}</span>
              <Toggle checked={form[key]} onChange={v => set(key, v)} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Show on Invoice</h3>
        <div className="space-y-3">
          {[
            { key: "show_logo"      as const, label: "Company Logo" },
            { key: "show_gst"       as const, label: "GST Number" },
            { key: "show_terms"     as const, label: "Terms & Conditions" },
            { key: "show_signature" as const, label: "Signature Line" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-line/60 last:border-0">
              <span className="text-sm text-ink">{label}</span>
              <Toggle checked={form[key]} onChange={v => set(key, v)} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-60 transition-colors">
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
      </div>
    </div>
  );
}

// ── Coming Soon Placeholder ───────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-line/60 flex items-center justify-center mb-4">
        <Clock size={28} className="text-muted" />
      </div>
      <p className="text-base font-semibold text-ink">{label}</p>
      <p className="text-sm text-muted mt-1">This section is coming soon.</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("company");

  return (
    <div>
      <h1 className="text-xl font-bold text-ink mb-1">Settings</h1>
      <p className="text-sm text-muted mb-6">Configure your company profile, invoice defaults, and print options.</p>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-0.5">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                    tab === t.id
                      ? "bg-accent text-white"
                      : "text-muted hover:text-ink hover:bg-line/60"
                  }`}>
                  <Icon size={15} className="flex-shrink-0" />
                  <span className="flex-1">{t.label}</span>
                  {t.comingSoon && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tab === t.id ? "bg-white/20 text-white" : "bg-line text-muted"}`}>
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content area */}
        <div className="flex-1 bg-surface border border-line rounded-xl p-6 min-h-[500px]">
          {tab === "company"       && <CompanyTab />}
          {tab === "invoice"       && <InvoiceTab />}
          {tab === "print"         && <PrintTab />}
          {tab === "users"         && <ComingSoon label="Users & Roles" />}
          {tab === "notifications" && <ComingSoon label="Notifications" />}
          {tab === "integrations"  && <ComingSoon label="Integrations" />}
          {tab === "billing"       && <ComingSoon label="Billing & Plan" />}
        </div>
      </div>
    </div>
  );
}
