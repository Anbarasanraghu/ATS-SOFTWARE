import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, MessageSquare, Phone, Mail, FileText } from "lucide-react";
import { api, type Customer, type CustomerInvoice, type Interaction } from "../lib/api";
import { money } from "../lib/money";

const STATUS_CLS: Record<string, string> = {
  draft: "bg-surface-2 text-muted", sent: "bg-sky-100 text-sky-700",
  paid: "bg-emerald-100 text-emerald-700", void: "bg-red-100 text-red-600",
};
const INTERACTION_TYPES = ["note", "call", "email", "meeting", "other"];
const TYPE_ICON: Record<string, typeof MessageSquare> = {
  note: MessageSquare, call: Phone, email: Mail, meeting: MessageSquare, other: MessageSquare,
};

export default function CustomerDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer]         = useState<Customer | null>(null);
  const [invoices, setInvoices]         = useState<CustomerInvoice[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [notFound, setNotFound]         = useState(false);
  const [newIA, setNewIA]               = useState({ type: "note", subject: "", body: "" });
  const [showIA, setShowIA]             = useState(false);

  async function load() {
    try {
      const [c, inv, ia] = await Promise.all([
        api.getCustomer(id), api.customerInvoices(id), api.listInteractions(id),
      ]);
      setCustomer(c); setInvoices(inv); setInteractions(ia);
    } catch { setNotFound(true); }
  }
  useEffect(() => { void load(); }, [id]);

  async function addInteraction(e: { preventDefault(): void }) {
    e.preventDefault();
    try {
      await api.addInteraction(id, { type: newIA.type, subject: newIA.subject || null, body: newIA.body });
      setNewIA({ type: "note", subject: "", body: "" }); setShowIA(false);
      await load();
    } catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  async function deleteInteraction(iaId: string) {
    if (!confirm("Delete this note?")) return;
    try { await api.deleteInteraction(id, iaId); await load(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  if (notFound) return (
    <div className="space-y-4">
      <button onClick={() => navigate("/customers")} className="flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Customers</button>
      <p className="text-danger">Customer not found.</p>
    </div>
  );
  if (!customer) return <div className="text-muted text-sm p-4">Loading…</div>;

  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);

  return (
    <div className="scene-3d p-5 sm:p-6 space-y-6">
      <button onClick={() => navigate("/customers")} className="mono-label text-[11px] flex items-center gap-1 text-muted hover:text-ink">
        <ArrowLeft size={16} /> Customers
      </button>

      {/* Header */}
      <div className="card-3d p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-dot text-2xl font-extrabold uppercase">{customer.name}</h1>
            {customer.company && <div className="text-muted text-sm mt-0.5">{customer.company}</div>}
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${customer.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-surface-2 text-muted"}`}>
            {customer.status}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mt-4 text-sm">
          {customer.email && <div className="flex items-center gap-2 text-muted"><Mail size={14} />{customer.email}</div>}
          {customer.phone && <div className="flex items-center gap-2 text-muted"><Phone size={14} />{customer.phone}</div>}
          {customer.address && <div className="text-muted">{customer.address}</div>}
        </div>
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-line">
          <div className="text-center">
            <div className="text-2xl font-bold">{invoices.length}</div>
            <div className="text-xs text-muted uppercase tracking-wide mt-1">Total Invoices</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-700">{money(totalRevenue)}</div>
            <div className="text-xs text-muted uppercase tracking-wide mt-1">Revenue (Paid)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{invoices.filter((i) => i.status === "sent").length}</div>
            <div className="text-xs text-muted uppercase tracking-wide mt-1">Open Invoices</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice history */}
        <div className="card-3d overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <span className="font-semibold text-sm flex items-center gap-2"><FileText size={15} /> Invoices</span>
          </div>
          {invoices.length === 0 ? (
            <p className="p-4 text-sm text-muted">No invoices linked to this customer.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60 cursor-pointer"
                    onClick={() => navigate(`/billing/${inv.id}`)}>
                    <td className="px-4 py-2 font-mono text-xs">
                      <div>{inv.invoice_number}</div>
                      <div className="text-muted">{inv.issue_date ?? "—"}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{money(inv.total)}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[inv.status] ?? ""}`}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Interaction log */}
        <div className="card-3d overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <span className="font-semibold text-sm">Activity Log</span>
            <button onClick={() => setShowIA(true)}
              className="flex items-center gap-1 text-xs text-black hover:underline">
              <Plus size={12} /> Add note
            </button>
          </div>

          {showIA && (
            <form onSubmit={addInteraction} className="p-4 border-b border-line space-y-3 bg-paper/40">
              <div className="flex gap-2">
                <select className="rounded-md input-3d px-2 py-1.5 text-sm outline-none focus:border-black"
                  value={newIA.type} onChange={(e) => setNewIA({ ...newIA, type: e.target.value })}>
                  {INTERACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className="flex-1 rounded-md input-3d px-2 py-1.5 text-sm outline-none focus:border-black"
                  placeholder="Subject (optional)" value={newIA.subject}
                  onChange={(e) => setNewIA({ ...newIA, subject: e.target.value })} />
              </div>
              <textarea required rows={3} className="w-full rounded-md input-3d px-2 py-1.5 text-sm outline-none focus:border-black resize-none"
                placeholder="Notes…" value={newIA.body}
                onChange={(e) => setNewIA({ ...newIA, body: e.target.value })} />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowIA(false)} className="px-3 py-1.5 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
                <button type="submit" className="px-3 py-1.5 text-sm rounded-md bg-black text-white font-medium">Save</button>
              </div>
            </form>
          )}

          {interactions.length === 0 ? (
            <p className="p-4 text-sm text-muted">No activity yet.</p>
          ) : (
            <div className="divide-y divide-line">
              {interactions.map((ia) => {
                const Icon = TYPE_ICON[ia.type] ?? MessageSquare;
                return (
                  <div key={ia.id} className="px-4 py-3 flex gap-3">
                    <div className="mt-0.5 text-muted"><Icon size={14} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium capitalize text-muted">{ia.type}</span>
                        {ia.subject && <span className="text-xs font-semibold truncate">{ia.subject}</span>}
                        <span className="text-xs text-muted ml-auto whitespace-nowrap">{new Date(ia.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm mt-0.5 whitespace-pre-line">{ia.body}</p>
                    </div>
                    <button onClick={() => deleteInteraction(ia.id)} className="text-muted hover:text-danger self-start mt-0.5"><Trash2 size={13} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
