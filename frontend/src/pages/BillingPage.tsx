import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Plus, Trash2 } from "lucide-react";
import { api, type Customer, type Invoice, type Product } from "../lib/api";

const STATUS_CLS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  sent:  "bg-sky-100 text-sky-700",
  paid:  "bg-emerald-100 text-emerald-700",
  void:  "bg-red-100 text-red-600",
};

type Line = { description: string; quantity: string; unit_price: string; tax_percent: string; product_id: string };
const blankLine = (): Line => ({ description: "", quantity: "1", unit_price: "0", tax_percent: "0", product_id: "" });
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function BillingPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_id: "", customer_name: "", customer_email: "",
    issue_date: todayISO(), due_date: "", notes: "",
  });
  const [lines, setLines] = useState<Line[]>([blankLine()]);

  async function refresh() {
    const [inv, cust, prods] = await Promise.all([
      api.listInvoices(), api.listCustomers(), api.listProducts(),
    ]);
    setInvoices(inv); setCustomers(cust); setProducts(prods);
  }
  useEffect(() => { void refresh(); }, []);

  function pickCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    setForm({ ...form, customer_id: id, customer_name: c?.name ?? "", customer_email: c?.email ?? "" });
  }

  function pickProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) { setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, product_id: "" } : l)); return; }
    setLines((ls) => ls.map((l, idx) => idx === i
      ? { ...l, product_id: p.id, description: p.name, unit_price: String(p.price), tax_percent: String(p.tax_percent) }
      : l));
  }

  function updateLine(i: number, field: keyof Line, value: string) {
    setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  function cancelCreate() {
    setCreating(false); setError(null);
    setForm({ customer_id: "", customer_name: "", customer_email: "", issue_date: todayISO(), due_date: "", notes: "" });
    setLines([blankLine()]);
  }

  async function submitCreate(e: { preventDefault(): void }) {
    e.preventDefault(); setError(null);
    try {
      await api.createInvoice({
        customer_id: form.customer_id || null,
        customer_name: form.customer_name,
        customer_email: form.customer_email || null,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
        notes: form.notes || null,
        items: lines.filter((l) => l.description.trim()).map((l) => ({
          product_id: l.product_id || null,
          description: l.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          tax_percent: Number(l.tax_percent),
        })),
      });
      cancelCreate(); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  async function deleteInv(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this draft invoice?")) return;
    try { await api.deleteInvoice(id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  const subtotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);
  const taxTotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price) * Number(l.tax_percent) / 100, 0);

  const inputCls = "rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Invoices</h1>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-md bg-accent text-white px-4 py-2 text-sm font-medium">
            <Plus size={16} /> New Invoice
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={submitCreate} className="bg-surface border border-line rounded-lg p-6 space-y-5">
          <h2 className="font-semibold">New Invoice</h2>

          {/* Customer picker */}
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Customer (CRM)</span>
              <select className={`mt-1 w-full ${inputCls}`} value={form.customer_id} onChange={(e) => pickCustomer(e.target.value)}>
                <option value="">— Select or type below —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Customer Name *</span>
              <input required className={`mt-1 w-full ${inputCls}`} value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Customer Email</span>
              <input type="email" className={`mt-1 w-full ${inputCls}`} value={form.customer_email}
                onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Issue Date *</span>
              <input type="date" required className={`mt-1 w-full ${inputCls}`} value={form.issue_date}
                onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Due Date</span>
              <input type="date" className={`mt-1 w-full ${inputCls}`} value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </label>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Line Items</div>
            <div className="rounded-lg border border-line overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-paper border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 text-left w-36">Product</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right w-20">Qty</th>
                    <th className="px-3 py-2 text-right w-28">Unit Price</th>
                    <th className="px-3 py-2 text-right w-20">Tax %</th>
                    <th className="px-3 py-2 text-right w-24">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-2">
                        <select className="w-full bg-transparent outline-none text-xs text-muted"
                          value={l.product_id} onChange={(e) => pickProduct(i, e.target.value)}>
                          <option value="">— pick —</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input className="w-full bg-transparent outline-none" placeholder="Item description"
                          value={l.description} onChange={(e) => updateLine(i, "description", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.001" className="w-full bg-transparent outline-none text-right"
                          value={l.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.01" className="w-full bg-transparent outline-none text-right"
                          value={l.unit_price} onChange={(e) => updateLine(i, "unit_price", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" max="100" step="0.01" className="w-full bg-transparent outline-none text-right"
                          value={l.tax_percent} onChange={(e) => updateLine(i, "tax_percent", e.target.value)} />
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {(Number(l.quantity) * Number(l.unit_price)).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {lines.length > 1 && (
                          <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                            className="text-muted hover:text-danger"><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-line">
                <button type="button" onClick={() => setLines((ls) => [...ls, blankLine()])}
                  className="flex items-center gap-1 text-sm text-accent hover:underline">
                  <Plus size={14} /> Add line
                </button>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-52 space-y-1 text-sm">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span>{subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted"><span>Tax</span><span>{taxTotal.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold border-t border-line pt-1">
                <span>Total</span><span>{(subtotal + taxTotal).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Notes</span>
            <textarea rows={2} className={`mt-1 w-full ${inputCls} resize-none`} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={cancelCreate} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium">Create Invoice</button>
          </div>
        </form>
      )}

      {/* Invoice list */}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {invoices.length === 0 ? (
          <p className="p-6 text-sm text-muted">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}
                  className="border-b border-line/60 last:border-0 hover:bg-paper/60 cursor-pointer"
                  onClick={() => navigate(`/billing/${inv.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{inv.invoice_number}</td>
                  <td className="px-4 py-3 font-medium">{inv.customer_name}</td>
                  <td className="px-4 py-3 text-muted">{inv.issue_date}</td>
                  <td className="px-4 py-3 text-muted">{inv.due_date ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{Number(inv.total).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700">{Number(inv.amount_paid).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={inv.balance_due > 0 ? "text-danger font-semibold" : "text-muted"}>
                      {Number(inv.balance_due).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[inv.status] ?? ""}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => navigate(`/billing/${inv.id}`)} className="text-muted hover:text-accent" title="View"><Eye size={15} /></button>
                      {inv.status === "draft" && (
                        <button onClick={(e) => deleteInv(inv.id, e)} className="text-muted hover:text-danger" title="Delete"><Trash2 size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
