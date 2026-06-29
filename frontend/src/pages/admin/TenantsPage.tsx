import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { api, type AdminTenant } from "../../lib/api";

const VERTICALS = [
  { value: "generic", label: "General business" },
  { value: "retail", label: "Retail / POS" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "services", label: "Services" },
];

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [showForm, setShowForm] = useState(false);

  function refresh() { void api.adminTenants().then(setTenants); }
  useEffect(() => { refresh(); }, []);

  return (
    <div className="ws-scene p-5 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold font-display bg-gradient-to-r from-ink to-info bg-clip-text text-transparent">Tenants</h1>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-md bg-accent text-white px-3 py-2 text-sm font-medium hover:opacity-90">
          <Plus size={16} /> Create tenant
        </button>
      </div>

      <div className="ws-card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Name</th><th className="px-4 py-3">Slug</th>
            <th className="px-4 py-3">Vertical</th><th className="px-4 py-3">Seats</th>
            <th className="px-4 py-3">Revenue/mo</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3">{t.name}</td>
                <td className="px-4 py-3 text-muted">{t.slug}</td>
                <td className="px-4 py-3">{t.vertical}</td>
                <td className="px-4 py-3">{t.active_users} / {t.max_users}</td>
                <td className="px-4 py-3">${t.monthly_total.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/admin/tenants/${t.id}`} className="text-accent hover:underline">Configure →</Link>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No tenants yet. Create the first one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <CreateTenantModal
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); refresh(); }}
        />
      )}
    </div>
  );
}

function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [tenantName, setTenantName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [vertical, setVertical] = useState("generic");
  const [maxUsers, setMaxUsers] = useState(1);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onNameChange(v: string) {
    setTenantName(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  async function submit() {
    setError(null);
    const cleanSlug = slugify(slug);
    if (!tenantName.trim()) return setError("Enter a tenant name.");
    if (!cleanSlug) return setError("Enter a valid workspace ID.");
    if (!ownerEmail.trim()) return setError("Enter the owner's email.");
    if (ownerPassword.length < 6) return setError("Password must be at least 6 characters.");

    setBusy(true);
    try {
      await api.adminCreateTenant({
        tenant_name: tenantName.trim(),
        slug: cleanSlug,
        vertical,
        max_users: Math.max(1, maxUsers),
        owner_email: ownerEmail.trim(),
        owner_name: ownerName.trim() || undefined,
        owner_password: ownerPassword,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create tenant.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "mt-1 w-full rounded-md ws-input px-3 py-2 outline-none focus:border-accent";
  const labelCls = "text-xs font-medium uppercase tracking-wide text-muted";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md ws-card p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create tenant</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>

        <label className="block">
          <span className={labelCls}>Tenant / company name</span>
          <input value={tenantName} onChange={(e) => onNameChange(e.target.value)} placeholder="Acme Pharmacy" className={inputCls} />
        </label>

        <label className="block">
          <span className={labelCls}>Workspace ID (login slug)</span>
          <input value={slug} onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }} placeholder="acme-pharmacy" className={inputCls} />
        </label>

        <label className="block">
          <span className={labelCls}>Business type</span>
          <select value={vertical} onChange={(e) => setVertical(e.target.value)} className={inputCls}>
            {VERTICALS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </label>

        <label className="block">
          <span className={labelCls}>Paid seats (max users)</span>
          <input type="number" min={1} value={maxUsers}
            onChange={(e) => setMaxUsers(parseInt(e.target.value) || 1)} className={inputCls} />
          <span className="text-[11px] text-muted">Includes the owner. Each active user is billed $100/month.</span>
        </label>

        <div className="border-t border-line pt-4 space-y-4">
          <p className="text-xs text-muted -mb-1">Owner account (the customer signs in with these)</p>
          <label className="block">
            <span className={labelCls}>Owner name</span>
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Jane Doe" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Owner email</span>
            <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Temporary password</span>
            <input type="text" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="min 6 characters" className={inputCls} />
          </label>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={busy}
            className="flex-1 rounded-md bg-accent text-white py-2 font-medium disabled:opacity-50">
            {busy ? "Creating…" : "Create tenant"}
          </button>
          <button onClick={onClose} className="rounded-md border border-line px-4 py-2 text-sm text-muted hover:bg-line/50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
