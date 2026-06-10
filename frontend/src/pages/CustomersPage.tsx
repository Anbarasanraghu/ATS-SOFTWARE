import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { api, type Customer, type FieldDef } from "../lib/api";
import DynamicFields from "../components/DynamicFields";

type Form = {
  name: string; email: string; phone: string; company: string;
  address: string; notes: string; status: string; custom: Record<string, unknown>;
};
const blank = (): Form => ({ name: "", email: "", phone: "", company: "", address: "", notes: "", status: "active", custom: {} });

const STATUS_CLS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-zinc-100 text-zinc-500",
};

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [defs, setDefs]           = useState<FieldDef[]>([]);
  const [search, setSearch]       = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]     = useState<Customer | null>(null);
  const [form, setForm]           = useState<Form>(blank());
  const [error, setError]         = useState<string | null>(null);

  async function refresh() {
    const [c, d] = await Promise.all([api.listCustomers(), api.fieldDefinitions("customer")]);
    setCustomers(c); setDefs(d);
  }
  useEffect(() => { void refresh(); }, []);

  function openCreate() { setForm(blank()); setError(null); setShowCreate(true); }
  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ name: c.name, email: c.email ?? "", phone: c.phone ?? "", company: c.company ?? "",
      address: c.address ?? "", notes: c.notes ?? "", status: c.status, custom: { ...c.custom_fields } });
    setError(null);
  }
  function closeModal() { setShowCreate(false); setEditing(null); setError(null); }

  function buildPayload(f: Form) {
    return { ...f, email: f.email || null, phone: f.phone || null,
      company: f.company || null, address: f.address || null, notes: f.notes || null, custom_fields: f.custom };
  }

  async function submitCreate(e: { preventDefault(): void }) {
    e.preventDefault(); setError(null);
    try { await api.createCustomer(buildPayload(form)); closeModal(); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  async function submitEdit(e: { preventDefault(): void }) {
    e.preventDefault(); if (!editing) return; setError(null);
    try { await api.updateCustomer(editing.id, buildPayload(form)); closeModal(); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  async function handleDelete(id: string) {
    if (!confirm("Delete this customer?")) return;
    try { await api.deleteCustomer(id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const inputCls = "mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

  const modal = (isEdit: boolean) => (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form onSubmit={isEdit ? submitEdit : submitCreate}
        className="bg-surface border border-line rounded-lg p-6 w-full max-w-lg space-y-4 shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{isEdit ? "Edit Customer" : "New Customer"}</h2>
          <button type="button" onClick={closeModal} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Name *</span>
            <input className={inputCls} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Email</span>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Phone</span>
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Company</span>
            <input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Status</span>
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="block col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Address</span>
            <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className="block col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Notes</span>
            <textarea rows={2} className={`${inputCls} resize-none`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>
        <DynamicFields defs={defs} values={form.custom}
          onChange={(k, v) => setForm((f) => ({ ...f, custom: { ...f.custom, [k]: v } }))} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={closeModal} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium">
            {isEdit ? "Save changes" : "Create customer"}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Customers</h1>
        <div className="ml-auto flex items-center gap-3">
          <input className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent w-52"
            placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={openCreate}
            className="flex items-center gap-2 rounded-md bg-accent text-white px-4 py-2 text-sm font-medium">
            <Plus size={16} /> New Customer
          </button>
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted">{customers.length === 0 ? "No customers yet." : "No match."}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted">{c.company ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[c.status] ?? ""}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => navigate(`/customers/${c.id}`)} className="text-muted hover:text-accent" title="View detail">
                        <ExternalLink size={14} />
                      </button>
                      <button onClick={() => openEdit(c)} className="text-muted hover:text-accent" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(c.id)} className="text-muted hover:text-danger" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && modal(false)}
      {editing && modal(true)}
    </div>
  );
}
