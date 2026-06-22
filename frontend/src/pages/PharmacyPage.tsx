import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, AlertTriangle, Pill } from "lucide-react";
import { api, type Product, type ProductBatch } from "../lib/api";
import ScanInput from "../components/ScanInput";

const inputCls = "mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";
const STATUS: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  near: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-600",
};
const blankForm = () => ({ product_id: "", batch_no: "", mfg_date: "", expiry_date: "", quantity: "1" });

export default function PharmacyPage({ mode = "batches" }: { mode?: "batches" | "expiry" }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches]   = useState<ProductBatch[]>([]);
  const [days, setDays]         = useState(90);
  const [form, setForm]         = useState(blankForm());
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");

  async function refresh() {
    if (mode === "expiry") {
      setBatches(await api.expiryReport(days));
    } else {
      const [p, b] = await Promise.all([api.listProducts(), api.listBatches()]);
      setProducts(p); setBatches(b);
    }
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [mode, days]);

  async function onScan(code: string) {
    try {
      const p = await api.scanProduct(code);
      setForm((f) => ({ ...f, product_id: p.id }));
    } catch { setError(`No product for "${code}"`); }
  }

  async function addBatch(e: { preventDefault(): void }) {
    e.preventDefault(); setError(null);
    if (!form.product_id) { setError("Select or scan a product."); return; }
    try {
      await api.addBatch({
        product_id: form.product_id,
        batch_no: form.batch_no || null,
        mfg_date: form.mfg_date || null,
        expiry_date: form.expiry_date || null,
        quantity: Number(form.quantity) || 0,
      });
      setForm(blankForm());
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this batch? Its quantity is removed from stock.")) return;
    try { await api.deleteBatch(id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  const filtered = useMemo(() => batches.filter((b) =>
    b.product_name.toLowerCase().includes(search.toLowerCase()) ||
    (b.batch_no ?? "").toLowerCase().includes(search.toLowerCase())), [batches, search]);

  const isExpiry = mode === "expiry";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Pill size={20} /> {isExpiry ? "Expiry Report" : "Pharmacy — Batches"}
        </h1>
        {isExpiry ? (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted">Within</span>
            <select className="rounded-md border border-line bg-paper px-2 py-1.5" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[30, 60, 90, 180].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
        ) : (
          <input className="ml-auto rounded-md border border-line bg-paper px-3 py-2 text-sm w-56" placeholder="Search product / batch…" value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
      </div>

      {/* Add batch (batches view only) */}
      {!isExpiry && (
        <form onSubmit={addBatch} className="bg-surface border border-line rounded-lg p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Receive a batch</div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <label className="block md:col-span-2"><span className="text-[11px] text-muted">Product *</span>
              <select className={inputCls} value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                <option value="">— Select —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
              </select></label>
            <label className="block"><span className="text-[11px] text-muted">Batch No.</span>
              <input className={inputCls} value={form.batch_no} onChange={(e) => setForm({ ...form, batch_no: e.target.value })} /></label>
            <label className="block"><span className="text-[11px] text-muted">Mfg date</span>
              <input type="date" className={inputCls} value={form.mfg_date} onChange={(e) => setForm({ ...form, mfg_date: e.target.value })} /></label>
            <label className="block"><span className="text-[11px] text-muted">Expiry date</span>
              <input type="date" className={inputCls} value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></label>
            <label className="block"><span className="text-[11px] text-muted">Quantity</span>
              <input type="number" step="0.001" className={inputCls} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
          </div>
          <div className="flex items-center gap-3">
            <ScanInput onScan={onScan} className="max-w-xs" placeholder="Scan product to select…" />
            <button type="submit" className="rounded-md bg-accent text-white px-4 py-2 text-sm font-medium flex items-center gap-1"><Plus size={15} /> Add batch (stock in)</button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        </form>
      )}

      {/* Batches / expiry table */}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted">{isExpiry ? "Nothing expiring in this window." : "No batches yet. Receive one above."}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Product</th><th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Mfg</th><th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3">Status</th>
                {!isExpiry && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                  <td className="px-4 py-3 font-medium">{b.product_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{b.batch_no ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{b.mfg_date ?? "—"}</td>
                  <td className="px-4 py-3">{b.expiry_date ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{b.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[b.status] ?? ""}`}>
                      {b.status === "expired" ? "expired" : b.status === "near" ? `${b.days_to_expiry}d left` : "ok"}
                    </span>
                  </td>
                  {!isExpiry && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => remove(b.id)} className="text-muted hover:text-danger"><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isExpiry && filtered.some((b) => b.status === "expired") && (
        <p className="text-sm text-danger flex items-center gap-2"><AlertTriangle size={15} /> Expired batches are blocked from sale at POS.</p>
      )}
    </div>
  );
}
