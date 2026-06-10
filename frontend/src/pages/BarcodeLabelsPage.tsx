import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer } from "lucide-react";
import { api, type Product } from "../lib/api";

const inputCls = "rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, { format: "CODE128", width: 1.4, height: 38, fontSize: 11, margin: 2 });
      } catch { /* ignore invalid codes */ }
    }
  }, [value]);
  return <svg ref={ref} />;
}

export default function BarcodeLabelsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch]     = useState("");
  const [qty, setQty]           = useState<Record<string, number>>({});
  const [showPrice, setShowPrice] = useState(true);

  useEffect(() => { void api.listProducts().then(setProducts); }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? "").toLowerCase().includes(search.toLowerCase()),
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

      <div className="flex items-center gap-3 no-print">
        <h1 className="text-xl font-semibold">Barcode Labels</h1>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Show price
        </label>
        <button onClick={() => window.print()} disabled={labels.length === 0}
          className="flex items-center gap-2 rounded-md bg-accent text-white px-4 py-2 text-sm font-medium disabled:opacity-40">
          <Printer size={16} /> Print {labels.length > 0 ? `(${labels.length})` : ""}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Picker */}
        <div className="no-print space-y-3">
          <input className={`${inputCls} w-full`} placeholder="Search name / SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="bg-surface border border-line rounded-lg divide-y divide-line max-h-[60vh] overflow-y-auto">
            {filtered.length === 0 && <p className="px-4 py-3 text-sm text-muted">No products.</p>}
            {filtered.map((p) => {
              const code = p.barcode || p.sku;
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <input type="checkbox" checked={(qty[p.id] ?? 0) > 0}
                    disabled={!code}
                    onChange={(e) => setQty((q) => ({ ...q, [p.id]: e.target.checked ? (q[p.id] || 1) : 0 }))} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted font-mono">{code ?? "no barcode/SKU"}</div>
                  </div>
                  <input type="number" min={0} className={`${inputCls} w-20 text-right`}
                    value={qty[p.id] ?? 0} disabled={!code}
                    onChange={(e) => setQty((q) => ({ ...q, [p.id]: Math.max(0, Number(e.target.value)) }))} />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted">Products without a barcode or SKU can't be labelled. Set a quantity to add copies.</p>
        </div>

        {/* Preview / print sheet */}
        <div id="label-sheet" className="bg-surface border border-line rounded-lg p-4">
          {labels.length === 0 ? (
            <p className="text-sm text-muted no-print">Select products on the left to preview labels.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {labels.map(({ p, code, key }) => (
                <div key={key} className="border border-line rounded p-2 w-[180px] text-center break-inside-avoid">
                  <div className="text-xs font-medium truncate">{p.name}</div>
                  <Barcode value={code} />
                  {showPrice && <div className="text-sm font-semibold">{Number(p.price).toFixed(2)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
