import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Plus, X, AlertTriangle, Camera } from "lucide-react";
import { api, type FieldDef, type Product } from "../lib/api";
import ScanInput from "../components/ScanInput";
import CameraScanner from "../components/LazyCameraScanner";

type LogEntry = {
  id: string; name: string; barcode: string; delta: number; unit: string;
  newStock: number; status: "in" | "out" | "added" | "error"; msg?: string; at: string;
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));
const inputCls = "mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

export default function ScanStockPage() {
  const [mode, setMode] = useState<"in" | "out">("in");
  const [qty, setQty]   = useState("1");
  const [log, setLog]   = useState<LogEntry[]>([]);
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [pending, setPending] = useState<string | null>(null);   // unknown barcode awaiting quick-add
  const [nf, setNf]     = useState({ name: "", price: "0", cost_price: "0", stock_qty: "1", unit: "pcs", custom: {} as Record<string, unknown> });
  const [err, setErr]   = useState<string | null>(null);
  const [cam, setCam]   = useState(false);

  useEffect(() => { void api.fieldDefinitions("product").then(setDefs).catch(() => {}); }, []);

  async function handleScan(code: string) {
    setErr(null);
    if (pending) return;                       // ignore scans while quick-add is open
    const q = Number(qty) || 1;
    let p: Product;
    try {
      p = await api.scanProduct(code);
    } catch {
      // Unknown barcode → close camera and open quick-add prefilled with this code.
      setCam(false);
      setPending(code);
      setNf({ name: "", price: "0", cost_price: "0", stock_qty: String(q), unit: "pcs", custom: {} });
      return;
    }
    try {
      await api.createStockMovement({ product_id: p.id, movement_type: mode, quantity: q, reference: "Scan", notes: `Scan ${mode}` });
      const newStock = mode === "in" ? p.stock_qty + q : p.stock_qty - q;
      setLog((l) => [{ id: uid(), name: p.name, barcode: code, delta: mode === "in" ? q : -q, unit: p.unit, newStock, status: mode, at: new Date().toLocaleTimeString() }, ...l]);
    } catch (e) {
      setLog((l) => [{ id: uid(), name: p.name, barcode: code, delta: 0, unit: p.unit, newStock: p.stock_qty, status: "error", msg: e instanceof Error ? e.message : "Failed", at: new Date().toLocaleTimeString() }, ...l]);
    }
  }

  async function submitNew(e: { preventDefault(): void }) {
    e.preventDefault(); if (!pending) return; setErr(null);
    if (!nf.name.trim()) { setErr("Enter a product name."); return; }
    try {
      const p = await api.createProduct({
        name: nf.name.trim(), barcode: pending,
        price: Number(nf.price) || 0, cost_price: Number(nf.cost_price) || 0,
        stock_qty: Number(nf.stock_qty) || 0, unit: nf.unit || "pcs",
        custom_fields: nf.custom,
      });
      setLog((l) => [{ id: uid(), name: p.name, barcode: pending, delta: Number(nf.stock_qty) || 0, unit: p.unit, newStock: p.stock_qty, status: "added", at: new Date().toLocaleTimeString() }, ...l]);
      setPending(null);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to add"); }
  }

  const totalIn  = log.filter((x) => x.status === "in" || x.status === "added").reduce((s, x) => s + Math.abs(x.delta), 0);
  const totalOut = log.filter((x) => x.status === "out").reduce((s, x) => s + Math.abs(x.delta), 0);

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold">Scan Stock</h1>

      {/* Mode + quantity */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex border border-line rounded-md overflow-hidden text-sm">
          <button onClick={() => setMode("in")}
            className={`flex items-center gap-1 px-4 py-2 font-medium ${mode === "in" ? "bg-emerald-600 text-white" : "hover:bg-line/50"}`}>
            <ArrowDownToLine size={16} /> Receive (+)
          </button>
          <button onClick={() => setMode("out")}
            className={`flex items-center gap-1 px-4 py-2 font-medium ${mode === "out" ? "bg-amber-600 text-white" : "hover:bg-line/50"}`}>
            <ArrowUpFromLine size={16} /> Issue (−)
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Qty per scan
          <input type="number" min="0.001" step="0.001" className="w-20 rounded-md border border-line bg-paper px-2 py-2 text-sm text-right" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <div className="ml-auto text-xs text-muted">In: <b className="text-emerald-600">{totalIn}</b> · Out: <b className="text-amber-600">{totalOut}</b></div>
      </div>

      {/* The scanner */}
      <div className="flex items-center gap-2">
        <ScanInput onScan={handleScan} autoFocus camera={false} className="flex-1"
          placeholder={`Scan barcode to ${mode === "in" ? "ADD" : "REMOVE"} ${Number(qty) || 1}…`} />
        <button onClick={() => setCam(true)}
          className="shrink-0 flex items-center gap-1 rounded-md bg-accent text-white px-4 py-2 text-sm font-medium">
          <Camera size={16} /> Camera
        </button>
      </div>
      <p className="text-xs text-muted -mt-2">
        Use a USB scanner (types into the box) or tap <b>Camera</b> to scan with your phone/laptop camera. Each scan {mode === "in" ? "adds to" : "removes from"} stock instantly; a new barcode opens a quick-add so the product enters inventory with that exact code.
      </p>
      {cam && <CameraScanner continuous onDetect={(code) => void handleScan(code)} onClose={() => setCam(false)} />}

      {/* Quick-add for unknown barcode */}
      {pending && (
        <form onSubmit={submitNew} className="bg-surface border border-accent/40 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">New barcode <span className="font-mono text-accent">{pending}</span> — add to inventory</div>
            <button type="button" onClick={() => { setPending(null); setErr(null); }} className="text-muted hover:text-ink"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="block col-span-2"><span className="text-xs text-muted">Name *</span>
              <input autoFocus required className={inputCls} value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} /></label>
            <label className="block"><span className="text-xs text-muted">Sale price</span>
              <input type="number" step="0.01" className={inputCls} value={nf.price} onChange={(e) => setNf({ ...nf, price: e.target.value })} /></label>
            <label className="block"><span className="text-xs text-muted">Opening stock</span>
              <input type="number" step="0.001" className={inputCls} value={nf.stock_qty} onChange={(e) => setNf({ ...nf, stock_qty: e.target.value })} /></label>
            {defs.map((d) => {
              const cur = nf.custom[d.field_key];
              const set = (v: unknown) => setNf((f) => ({ ...f, custom: { ...f.custom, [d.field_key]: v } }));
              if (d.data_type === "select") {
                const opts = (d.options || []).map((o) => typeof o === "string" ? { id: o, label: o } : { id: o.value, label: o.label ?? o.value });
                return <label key={d.field_key} className="block"><span className="text-xs text-muted">{d.label}{d.is_required ? " *" : ""}</span>
                  <select className={inputCls} value={cur == null ? "" : String(cur)} onChange={(e) => set(e.target.value)}>
                    <option value="">—</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select></label>;
              }
              if (d.data_type === "boolean")
                return <label key={d.field_key} className="flex items-center gap-2 text-sm mt-5"><input type="checkbox" checked={Boolean(cur)} onChange={(e) => set(e.target.checked)} /> {d.label}</label>;
              return <label key={d.field_key} className="block"><span className="text-xs text-muted">{d.label}{d.is_required ? " *" : ""}</span>
                <input type={d.data_type === "number" ? "number" : d.data_type === "date" ? "date" : "text"} className={inputCls} value={cur == null ? "" : String(cur)} onChange={(e) => set(e.target.value)} /></label>;
            })}
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPending(null)} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium flex items-center gap-1"><Plus size={14} /> Add & stock</button>
          </div>
        </form>
      )}
      {err && !pending && <p className="text-sm text-danger">{err}</p>}

      {/* Session log */}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-line text-sm font-medium flex items-center justify-between">
          <span>Scanned this session <span className="text-muted font-normal">· {log.length}</span></span>
          {log.length > 0 && <button onClick={() => setLog([])} className="text-xs text-muted hover:text-danger">Clear</button>}
        </div>
        <div className="divide-y divide-line/60 max-h-[50vh] overflow-y-auto">
          {log.length === 0 && <p className="px-4 py-6 text-sm text-muted">Nothing scanned yet. Start scanning above.</p>}
          {log.map((x) => (
            <div key={x.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="w-6">
                {x.status === "error" ? <AlertTriangle size={15} className="text-danger" />
                  : x.status === "added" ? <Plus size={15} className="text-accent" />
                  : x.status === "in" ? <ArrowDownToLine size={15} className="text-emerald-600" />
                  : <ArrowUpFromLine size={15} className="text-amber-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{x.name}</div>
                <div className="text-xs text-muted font-mono">{x.barcode}</div>
              </div>
              {x.status === "error" ? (
                <span className="text-xs text-danger">{x.msg}</span>
              ) : (
                <>
                  <span className={`font-mono font-semibold ${x.delta < 0 ? "text-amber-600" : "text-emerald-600"}`}>{x.delta > 0 ? "+" : ""}{x.delta}</span>
                  <span className="text-xs text-muted w-24 text-right">→ {x.newStock} {x.unit}</span>
                </>
              )}
              <span className="text-[10px] text-muted w-16 text-right">{x.at}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
