import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  api, type Customer, type DocItem, type InventoryDoc, type Product, type Supplier,
} from "../lib/api";

const inputCls = "w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";
const blankLine = (): DocItem => ({ product_id: null, description: "", quantity: 1, unit_price: 0, tax_percent: 0 });

export default function DocumentsPage({ docType }: { docType: "purchase" | "sale" }) {
  const isPurchase = docType === "purchase";
  const title = isPurchase ? "Purchases" : "Sales";

  const [docs, setDocs]           = useState<InventoryDoc[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [head, setHead] = useState({ party_id: "", doc_number: "", doc_date: new Date().toISOString().slice(0, 10), notes: "" });
  const [lines, setLines] = useState<DocItem[]>([blankLine()]);

  async function refresh() {
    const [d, p, s, c] = await Promise.all([
      api.listDocuments(docType), api.listProducts(),
      isPurchase ? api.listSuppliers() : Promise.resolve<Supplier[]>([]),
      isPurchase ? Promise.resolve<Customer[]>([]) : api.listCustomers(),
    ]);
    setDocs(d); setProducts(p); setSuppliers(s); setCustomers(c);
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [docType]);

  const parties = isPurchase
    ? suppliers.map((s) => ({ id: s.id, name: s.name }))
    : customers.map((c) => ({ id: c.id, name: c.name }));

  function openForm() {
    setHead({ party_id: "", doc_number: "", doc_date: new Date().toISOString().slice(0, 10), notes: "" });
    setLines([blankLine()]);
    setError(null); setShowForm(true);
  }

  function setLine(i: number, patch: Partial<DocItem>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function pickProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) { setLine(i, { product_id: null }); return; }
    setLine(i, {
      product_id: p.id, description: p.name,
      unit_price: isPurchase ? p.cost_price : p.price,
      tax_percent: p.tax_percent,
    });
  }

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    for (const l of lines) {
      const line = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
      subtotal += line;
      tax += line * (Number(l.tax_percent) || 0) / 100;
    }
    return { subtotal, tax, total: subtotal + tax };
  }, [lines]);

  async function save(e: { preventDefault(): void }) {
    e.preventDefault(); setError(null);
    const valid = lines.filter((l) => l.description.trim() && Number(l.quantity) > 0);
    if (valid.length === 0) { setError("Add at least one line item."); return; }
    const party = parties.find((p) => p.id === head.party_id);
    try {
      await api.createDocument({
        doc_type: docType,
        doc_number: head.doc_number || null,
        party_id: head.party_id || null,
        party_name: party?.name || null,
        doc_date: head.doc_date,
        notes: head.notes || null,
        items: valid.map((l) => ({
          product_id: l.product_id, description: l.description,
          quantity: Number(l.quantity), unit_price: Number(l.unit_price),
          tax_percent: Number(l.tax_percent),
        })),
      });
      setShowForm(false); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this document? Stock will be reversed.")) return;
    try { await api.deleteDocument(id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{title}</h1>
        <button onClick={openForm} className="ml-auto flex items-center gap-2 rounded-md bg-accent text-white px-4 py-2 text-sm font-medium">
          <Plus size={16} /> New {isPurchase ? "Purchase" : "Sale"}
        </button>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {docs.length === 0 ? (
          <p className="p-6 text-sm text-muted">No {title.toLowerCase()} yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Doc #</th>
                <th className="px-4 py-3">{isPurchase ? "Supplier" : "Customer"}</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                  <td className="px-4 py-3">{d.doc_date}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.doc_number ?? "—"}</td>
                  <td className="px-4 py-3">{d.party_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{d.total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(d.id)} className="text-muted hover:text-danger" title="Delete"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <form onSubmit={save} className="bg-surface border border-line rounded-lg p-6 w-full max-w-3xl space-y-4 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New {isPurchase ? "Purchase" : "Sale"}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">{isPurchase ? "Supplier" : "Customer"}</span>
                <select className={`${inputCls} mt-1`} value={head.party_id} onChange={(e) => setHead({ ...head, party_id: e.target.value })}>
                  <option value="">— None —</option>
                  {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
              <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Doc #</span>
                <input className={`${inputCls} mt-1`} value={head.doc_number} onChange={(e) => setHead({ ...head, doc_number: e.target.value })} /></label>
              <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Date</span>
                <input type="date" className={`${inputCls} mt-1`} value={head.doc_date} onChange={(e) => setHead({ ...head, doc_date: e.target.value })} /></label>
            </div>

            <div className="border border-line rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-paper/60 text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-2 py-2 w-1/3">Product</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2 text-right w-20">Qty</th>
                    <th className="px-2 py-2 text-right w-24">{isPurchase ? "Cost" : "Price"}</th>
                    <th className="px-2 py-2 text-right w-16">Tax%</th>
                    <th className="px-2 py-2 text-right w-24">Total</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const lineTotal = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
                    return (
                      <tr key={i} className="border-t border-line/60">
                        <td className="px-2 py-1">
                          <select className={inputCls} value={l.product_id ?? ""} onChange={(e) => pickProduct(i, e.target.value)}>
                            <option value="">— Free text —</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1"><input className={inputCls} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></td>
                        <td className="px-2 py-1"><input type="number" step="0.001" className={`${inputCls} text-right`} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} /></td>
                        <td className="px-2 py-1"><input type="number" step="0.01" className={`${inputCls} text-right`} value={l.unit_price} onChange={(e) => setLine(i, { unit_price: Number(e.target.value) })} /></td>
                        <td className="px-2 py-1"><input type="number" step="0.01" className={`${inputCls} text-right`} value={l.tax_percent} onChange={(e) => setLine(i, { tax_percent: Number(e.target.value) })} /></td>
                        <td className="px-2 py-1 text-right font-mono">{lineTotal.toFixed(2)}</td>
                        <td className="px-2 py-1 text-center">
                          <button type="button" onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls)} className="text-muted hover:text-danger"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <button type="button" onClick={() => setLines((ls) => [...ls, blankLine()])} className="m-2 flex items-center gap-1 text-sm text-accent hover:underline"><Plus size={14} /> Add line</button>
            </div>

            <div className="flex items-start justify-between gap-4">
              <label className="block flex-1"><span className="text-xs font-medium uppercase tracking-wide text-muted">Notes</span>
                <input className={`${inputCls} mt-1`} value={head.notes} onChange={(e) => setHead({ ...head, notes: e.target.value })} /></label>
              <div className="text-sm text-right space-y-1 min-w-[180px]">
                <div className="flex justify-between gap-6"><span className="text-muted">Subtotal</span><span className="font-mono">{totals.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between gap-6"><span className="text-muted">Tax</span><span className="font-mono">{totals.tax.toFixed(2)}</span></div>
                <div className="flex justify-between gap-6 font-semibold border-t border-line pt-1"><span>Total</span><span className="font-mono">{totals.total.toFixed(2)}</span></div>
              </div>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium">
                Post {isPurchase ? "Purchase" : "Sale"} {isPurchase ? "(stock in)" : "(stock out)"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
