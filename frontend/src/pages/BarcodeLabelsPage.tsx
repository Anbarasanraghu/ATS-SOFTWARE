import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer, Wand2, Check } from "lucide-react";
import { api, type Product } from "../lib/api";
import { money } from "../lib/money";
import ScanInput from "../components/ScanInput";

const inputCls = "rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

// Generate a valid 13-digit EAN-13 barcode (in-store prefix 200).
function genEan13(used: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let base = "200";
    for (let i = 0; i < 9; i++) base += Math.floor(Math.random() * 10);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += +base[i] * (i % 2 === 0 ? 1 : 3);
    const code = base + ((10 - (sum % 10)) % 10);
    if (!used.has(code)) return code;
  }
  return "200" + Date.now().toString().slice(-10);
}

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && value) {
      try { JsBarcode(ref.current, value, { format: "CODE128", width: 1.4, height: 38, fontSize: 11, margin: 2 }); }
      catch { /* ignore invalid codes */ }
    }
  }, [value]);
  return <svg ref={ref} />;
}

export default function BarcodeLabelsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch]     = useState("");
  const [qty, setQty]           = useState<Record<string, number>>({});
  const [drafts, setDrafts]     = useState<Record<string, string>>({}); // in-progress barcode edits
  const [showPrice, setShowPrice] = useState(true);
  const [busy, setBusy]         = useState<string | null>(null);
  const [scanMsg, setScanMsg]   = useState<string | null>(null);

  async function load() { setProducts(await api.listProducts()); }
  useEffect(() => { void load(); }, []);

  async function onScan(code: string) {
    try { await api.scanProduct(code); setSearch(code); setScanMsg(null); }
    catch { setSearch(""); setScanMsg(`Barcode “${code}” isn't assigned yet — focus a product's barcode field below and scan again to assign it.`); }
  }

  const usedCodes = () => new Set(products.map((p) => p.barcode).filter(Boolean) as string[]);

  async function saveBarcode(p: Product, raw: string) {
    const value = raw.trim();
    if ((p.barcode ?? "") === value) return;
    setBusy(p.id);
    try {
      const updated = await api.patchProduct(p.id, { barcode: value || null });
      setProducts((ps) => ps.map((x) => (x.id === p.id ? updated : x)));
      setDrafts((d) => { const n = { ...d }; delete n[p.id]; return n; });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save barcode");
      setDrafts((d) => { const n = { ...d }; delete n[p.id]; return n; }); // revert
    } finally { setBusy(null); }
  }

  async function generateOne(p: Product) {
    await saveBarcode(p, genEan13(usedCodes()));
  }

  async function generateAllMissing() {
    const missing = products.filter((p) => !p.barcode);
    if (missing.length === 0) { alert("Every product already has a barcode."); return; }
    if (!confirm(`Generate barcodes for ${missing.length} product(s) without one?`)) return;
    const used = usedCodes();
    setBusy("all");
    try {
      for (const p of missing) {
        const code = genEan13(used);
        used.add(code);
        try {
          const updated = await api.patchProduct(p.id, { barcode: code });
          setProducts((ps) => ps.map((x) => (x.id === p.id ? updated : x)));
        } catch { /* skip collisions */ }
      }
    } finally { setBusy(null); }
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const labels = products.flatMap((p) => {
    const n = qty[p.id] ?? 0;
    const code = p.barcode || p.sku;
    if (n <= 0 || !code) return [];
    return Array.from({ length: n }, (_, i) => ({ p, code, key: `${p.id}-${i}` }));
  });

  return (
    <div className="space-y-6">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #label-sheet, #label-sheet * { visibility: visible !important; }
        #label-sheet { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }`}</style>

      <div className="flex items-center gap-3 no-print flex-wrap">
        <h1 className="text-xl font-semibold">Barcode Labels</h1>
        <button onClick={generateAllMissing} disabled={busy === "all"}
          className="flex items-center gap-1 rounded-md border border-line px-3 py-2 text-sm hover:bg-line/50 disabled:opacity-50">
          <Wand2 size={15} /> Generate missing
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Show price
        </label>
        <button onClick={() => window.print()} disabled={labels.length === 0}
          className="flex items-center gap-2 rounded-md bg-accent text-white px-4 py-2 text-sm font-medium disabled:opacity-40">
          <Printer size={16} /> Print {labels.length > 0 ? `(${labels.length})` : ""}
        </button>
      </div>

      <div className="no-print -mt-2 space-y-2">
        <ScanInput onScan={onScan} className="max-w-sm" placeholder="Scan to find a product by barcode…" />
        <p className="text-xs text-muted">
          The barcode you set here is saved on the product, so it scans in POS and links to invoices, purchases, sales and reports.
          Type/scan an existing barcode into a product's field to assign it, or generate a new one.
        </p>
        {scanMsg && <p className="text-xs text-accent bg-accent-soft/40 rounded px-3 py-2">{scanMsg}</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Picker + barcode assignment */}
        <div className="no-print space-y-3">
          <input className={`${inputCls} w-full`} placeholder="Search name / SKU / barcode…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="bg-surface border border-line rounded-lg divide-y divide-line max-h-[62vh] overflow-y-auto">
            {filtered.length === 0 && <p className="px-4 py-3 text-sm text-muted">No products.</p>}
            {filtered.map((p) => {
              const code = p.barcode || p.sku;
              const draft = drafts[p.id] ?? (p.barcode ?? "");
              return (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <input type="checkbox" checked={(qty[p.id] ?? 0) > 0} disabled={!code}
                    onChange={(e) => setQty((q) => ({ ...q, [p.id]: e.target.checked ? (q[p.id] || 1) : 0 }))} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        className="w-40 rounded border border-line bg-paper px-2 py-1 text-xs font-mono outline-none focus:border-accent"
                        placeholder="barcode…"
                        value={draft}
                        disabled={busy === p.id}
                        onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        onBlur={() => saveBarcode(p, draft)} />
                      <button onClick={() => generateOne(p)} disabled={busy === p.id}
                        className="text-muted hover:text-accent p-1" title="Generate barcode"><Wand2 size={13} /></button>
                      {p.barcode && <Check size={12} className="text-emerald-500" />}
                      {p.sku && <span className="text-[10px] text-muted">SKU {p.sku}</span>}
                    </div>
                  </div>
                  <input type="number" min={0} className={`${inputCls} w-16 text-right`}
                    value={qty[p.id] ?? 0} disabled={!code}
                    onChange={(e) => setQty((q) => ({ ...q, [p.id]: Math.max(0, Number(e.target.value)) }))} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Preview / print sheet */}
        <div id="label-sheet" className="bg-surface border border-line rounded-lg p-4">
          {labels.length === 0 ? (
            <p className="text-sm text-muted no-print">Set a quantity on products (with a barcode) to preview labels.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {labels.map(({ p, code, key }) => (
                <div key={key} className="border border-line rounded p-2 w-[180px] text-center break-inside-avoid">
                  <div className="text-xs font-medium truncate">{p.name}</div>
                  <Barcode value={code} />
                  {showPrice && <div className="text-sm font-semibold">{money(p.price)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
