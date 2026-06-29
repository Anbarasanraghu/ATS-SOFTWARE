import React, { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, AlertTriangle, Pill, CalendarClock,
  Search, Download, Printer, X, Package, TrendingUp,
  AlertCircle, ShieldAlert, DollarSign, RefreshCw, ChevronDown,
} from "lucide-react";
import { api, type Product, type ProductBatch, type BatchSummary } from "../lib/api";
import ScanInput from "../components/ScanInput";

const blankForm = () => ({
  product_id: "", batch_no: "", mfg_date: "", expiry_date: "", quantity: "1",
});

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; sub?: string;
}) {
  return (
    <div className="ph-card-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-base font-bold text-[#1B1B2F] truncate">{value}</p>
        <p className="text-xs text-[#8A8AA0] leading-tight">{label}</p>
        {sub && <p className="text-xs text-teal-600 font-medium mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StatusPill({ status, days }: { status: string; days: number | null | undefined }) {
  if (status === "expired")
    return <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-600">Expired</span>;
  if (status === "near")
    return <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">{days}d left</span>;
  return <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700">OK</span>;
}

const rowBorderColor = (status: string) =>
  status === "expired" ? "#FCA5A5" : status === "near" ? "#FCD34D" : "#6EE7B7";

export default function PharmacyPage({ mode = "batches" }: { mode?: "batches" | "expiry" }) {
  const [products, setProducts]   = useState<Product[]>([]);
  const [batches, setBatches]     = useState<ProductBatch[]>([]);
  const [summary, setSummary]     = useState<BatchSummary | null>(null);
  const [days, setDays]           = useState(90);
  const [form, setForm]           = useState(blankForm());
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading]     = useState(false);

  const isExpiry = mode === "expiry";

  async function refresh() {
    setLoading(true);
    try {
      if (isExpiry) {
        setBatches(await api.expiryReport(days));
      } else {
        const [p, b, s] = await Promise.all([
          api.listProducts(),
          api.listBatches(),
          api.batchSummary().catch(() => null),
        ]);
        setProducts(p);
        setBatches(b);
        if (s) setSummary(s);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [mode, days]);

  async function onScan(code: string) {
    try {
      const p = await api.scanProduct(code);
      setForm(f => ({ ...f, product_id: p.id }));
    } catch { setError(`No product for "${code}"`); }
  }

  async function addBatch(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(null);
    if (!form.product_id) { setError("Select or scan a product."); return; }
    try {
      await api.addBatch({
        product_id: form.product_id,
        batch_no:   form.batch_no   || null,
        mfg_date:   form.mfg_date   || null,
        expiry_date: form.expiry_date || null,
        quantity:   Number(form.quantity) || 0,
      });
      setForm(blankForm());
      setShowModal(false);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this batch? Its quantity is removed from stock.")) return;
    try { await api.deleteBatch(id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  const filtered = useMemo(() =>
    batches.filter(b =>
      b.product_name.toLowerCase().includes(search.toLowerCase()) ||
      (b.batch_no ?? "").toLowerCase().includes(search.toLowerCase())
    ), [batches, search]);

  const expiryStats = useMemo(() => ({
    expired:    filtered.filter(b => b.status === "expired").length,
    in7:        filtered.filter(b => b.status !== "expired" && (b.days_to_expiry ?? 9999) <= 7).length,
    in30:       filtered.filter(b => b.status !== "expired" && (b.days_to_expiry ?? 9999) <= 30).length,
    in90:       filtered.filter(b => b.status !== "expired" && (b.days_to_expiry ?? 9999) <= 90).length,
    totalValue: filtered.reduce((acc, b) => acc + b.quantity * (b.mrp ?? 0), 0),
  }), [filtered]);

  const getProduct = (pid: string) => products.find(p => p.id === pid);

  const fmtMoney = (n: number) =>
    `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function exportCSV() {
    const headers = isExpiry
      ? ["Medicine", "Batch No", "Expiry Date", "Days Left", "Qty", "MRP", "Status"]
      : ["Medicine", "Batch No", "Mfg Date", "Expiry Date", "Qty", "Cost Price", "Selling Price", "Status"];

    const rows = filtered.map(b => {
      const prod = isExpiry ? null : getProduct(b.product_id);
      return isExpiry
        ? [b.product_name, b.batch_no ?? "", b.expiry_date ?? "", b.days_to_expiry ?? "", b.quantity, b.mrp ?? "", b.status]
        : [b.product_name, b.batch_no ?? "", b.mfg_date ?? "", b.expiry_date ?? "", b.quantity, prod?.cost_price ?? "", prod?.price ?? b.mrp ?? "", b.status];
    });

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = isExpiry ? `expiry-report-${days}d.csv` : "pharmacy-batches.csv";
    a.click();
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER — EXPIRY REPORT
  // ─────────────────────────────────────────────────────────────
  if (isExpiry) {
    return (
      <div className="ph-scene p-5 space-y-5 animate-fade-in-up">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="ph-card-sm w-11 h-11 flex items-center justify-center flex-shrink-0">
              <CalendarClock size={20} className="text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1B1B2F]">Expiry Report</h1>
              <p className="text-sm text-[#8A8AA0]">Track expired and upcoming expiry medicines</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="ph-inset flex items-center gap-2 px-3 py-2">
              <Search size={14} className="text-[#8A8AA0] flex-shrink-0" />
              <input
                placeholder="Search medicine..."
                className="text-sm bg-transparent outline-none text-[#1B1B2F] w-36"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="ph-inset px-3 py-2 flex items-center gap-2">
              <span className="text-xs text-[#8A8AA0]">Within</span>
              <select
                className="text-sm bg-transparent outline-none text-[#1B1B2F]"
                value={days}
                onChange={e => setDays(Number(e.target.value))}
              >
                {[7, 30, 60, 90, 180].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <button onClick={exportCSV} className="ph-btn flex items-center gap-1.5 px-3 py-2 text-sm text-[#41415C]">
              <Download size={14} /> Export
            </button>
            <button onClick={() => window.print()} className="ph-btn flex items-center gap-1.5 px-3 py-2 text-sm text-[#41415C] no-print">
              <Printer size={14} /> Print
            </button>
            <button onClick={refresh} className="ph-btn w-9 h-9 flex items-center justify-center text-[#8A8AA0]">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Expired"     value={expiryStats.expired}    icon={ShieldAlert}   color="bg-red-100 text-red-600"       />
          <StatCard label="In 7 Days"   value={expiryStats.in7}        icon={AlertCircle}   color="bg-orange-100 text-orange-600" />
          <StatCard label="In 30 Days"  value={expiryStats.in30}       icon={AlertTriangle} color="bg-amber-100 text-amber-600"   />
          <StatCard label="In 90 Days"  value={expiryStats.in90}       icon={CalendarClock} color="bg-yellow-100 text-yellow-700" />
          <StatCard label="Total Value" value={fmtMoney(expiryStats.totalValue)} icon={DollarSign} color="bg-teal-100 text-teal-700" />
        </div>

        {/* Table */}
        <div className="ph-card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <div className="ph-card-sm w-14 h-14 flex items-center justify-center mx-auto mb-3">
                <CalendarClock size={24} className="text-[#8A8AA0]" />
              </div>
              <p className="text-[#41415C] font-medium">Nothing expiring in this window</p>
              <p className="text-sm text-[#8A8AA0] mt-1">Try a larger date range</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#E5F3F0", borderBottom: "1px solid #D0D8E8" }}
                      className="text-left text-xs uppercase tracking-wide text-[#41415C]">
                      <th className="px-4 py-3">Medicine</th>
                      <th className="px-4 py-3">Batch</th>
                      <th className="px-4 py-3">Expiry Date</th>
                      <th className="px-4 py-3 text-center">Days Left</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">MRP</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(b => (
                      <tr key={b.id}
                        className="hover:bg-[#EAF5F2] transition-colors"
                        style={{ borderBottom: "1px solid #E0EAF0", borderLeft: `3px solid ${rowBorderColor(b.status)}` }}>
                        <td className="px-4 py-3 font-medium text-[#1B1B2F]">{b.product_name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#8A8AA0]">{b.batch_no ?? "—"}</td>
                        <td className="px-4 py-3 text-[#41415C]">{b.expiry_date ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          {b.status === "expired"
                            ? <span className="text-red-600 font-bold text-xs">EXPIRED</span>
                            : <span className={`font-semibold ${
                                (b.days_to_expiry ?? 999) <= 7
                                  ? "text-red-500"
                                  : (b.days_to_expiry ?? 999) <= 30
                                    ? "text-amber-600"
                                    : "text-[#41415C]"
                              }`}>{b.days_to_expiry ?? "—"}</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[#1B1B2F]">{b.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono text-[#8A8AA0]">{b.mrp ? fmtMoney(b.mrp) : "—"}</td>
                        <td className="px-4 py-3 text-right font-mono text-[#1B1B2F]">{b.mrp ? fmtMoney(b.quantity * b.mrp) : "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusPill status={b.status} days={b.days_to_expiry} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => remove(b.id)}
                            className="ph-btn w-7 h-7 flex items-center justify-center text-[#8A8AA0] hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden p-4 space-y-3">
                {filtered.map(b => (
                  <div key={b.id} className="ph-card-sm p-4"
                    style={{ borderLeft: `3px solid ${rowBorderColor(b.status)}` }}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-[#1B1B2F] text-sm">{b.product_name}</p>
                        <p className="text-xs text-[#8A8AA0] font-mono mt-0.5">{b.batch_no ?? "—"}</p>
                      </div>
                      <StatusPill status={b.status} days={b.days_to_expiry} />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs mt-2">
                      <div><span className="text-[#8A8AA0]">Expiry: </span><span className="text-[#41415C]">{b.expiry_date ?? "—"}</span></div>
                      <div><span className="text-[#8A8AA0]">Days: </span>
                        <span className={`font-semibold ${b.status === "expired" ? "text-red-600" : b.status === "near" ? "text-amber-600" : "text-emerald-600"}`}>
                          {b.status === "expired" ? "EXPIRED" : (b.days_to_expiry ?? "—")}
                        </span>
                      </div>
                      <div><span className="text-[#8A8AA0]">Qty: </span><span className="text-[#41415C]">{b.quantity}</span></div>
                      <div><span className="text-[#8A8AA0]">MRP: </span><span className="text-[#41415C]">{b.mrp ? fmtMoney(b.mrp) : "—"}</span></div>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button onClick={() => remove(b.id)}
                        className="ph-btn w-8 h-8 flex items-center justify-center text-[#8A8AA0] hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {filtered.some(b => b.status === "expired") && (
          <div className="ph-card-sm px-4 py-3 flex items-center gap-2"
            style={{ boxShadow: "none", border: "1px solid #FECACA", background: "#FEF2F2" }}>
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600 font-medium">Expired batches are blocked from sale at POS.</p>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER — PHARMACY (BATCHES)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="ph-scene p-5 space-y-5 animate-fade-in-up">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="ph-card-sm w-11 h-11 flex items-center justify-center flex-shrink-0">
            <Pill size={20} className="text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1B1B2F]">Pharmacy</h1>
            <p className="text-sm text-[#8A8AA0]">Manage medicines, stock, batches and pharmacy inventory</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="ph-inset flex items-center gap-2 px-3 py-2">
            <Search size={14} className="text-[#8A8AA0] flex-shrink-0" />
            <input
              placeholder="Search medicine / batch..."
              className="text-sm bg-transparent outline-none text-[#1B1B2F] w-44"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={exportCSV} className="ph-btn flex items-center gap-1.5 px-3 py-2 text-sm text-[#41415C]">
            <Download size={14} /> Export
          </button>
          <button onClick={() => window.print()} className="ph-btn flex items-center gap-1.5 px-3 py-2 text-sm text-[#41415C] no-print">
            <Printer size={14} /> Print
          </button>
          <button onClick={refresh} className="ph-btn w-9 h-9 flex items-center justify-center text-[#8A8AA0]">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => { setShowModal(true); setError(null); setForm(blankForm()); }}
            className="ph-btn-primary flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
          >
            <Plus size={15} /> Add Medicine
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Batches"   value={summary?.batches ?? batches.length}             icon={Package}       color="bg-teal-100 text-teal-700"       />
        <StatCard label="Sellable Units"  value={summary?.sellable_units ?? "—"}                  icon={TrendingUp}    color="bg-emerald-100 text-emerald-700"  />
        <StatCard label="Near Expiry"     value={summary?.near_count ?? 0}                        icon={AlertTriangle} color="bg-amber-100 text-amber-700"      />
        <StatCard label="Expired Batches" value={summary?.expired_count ?? 0}                     icon={ShieldAlert}   color="bg-red-100 text-red-600"          />
        <StatCard label="Expired Units"   value={summary?.expired_units ?? 0}                     icon={AlertCircle}   color="bg-rose-100 text-rose-600"        />
        <StatCard label="Stock Value"     value={summary ? fmtMoney(summary.stock_value) : "—"}  icon={DollarSign}    color="bg-blue-100 text-blue-700"        />
      </div>

      {/* Batches table */}
      <div className="ph-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="ph-card-sm w-14 h-14 flex items-center justify-center mx-auto mb-3">
              <Pill size={24} className="text-[#8A8AA0]" />
            </div>
            <p className="text-[#41415C] font-medium">No batches found</p>
            <p className="text-sm text-[#8A8AA0] mt-1">Add your first medicine batch above</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#E5F3F0", borderBottom: "1px solid #D0D8E8" }}
                    className="text-left text-xs uppercase tracking-wide text-[#41415C]">
                    <th className="px-4 py-3">Medicine</th>
                    <th className="px-4 py-3">Batch No</th>
                    <th className="px-4 py-3">Mfg Date</th>
                    <th className="px-4 py-3">Expiry Date</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Cost Price</th>
                    <th className="px-4 py-3 text-right">MRP</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => {
                    const prod = getProduct(b.product_id);
                    return (
                      <tr key={b.id}
                        className="hover:bg-[#EAF5F2] transition-colors"
                        style={{ borderBottom: "1px solid #E0EAF0" }}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#1B1B2F]">{b.product_name}</p>
                          {b.manufacturer && <p className="text-xs text-[#8A8AA0] mt-0.5">{b.manufacturer}</p>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#8A8AA0]">{b.batch_no ?? "—"}</td>
                        <td className="px-4 py-3 text-[#8A8AA0]">{b.mfg_date ?? "—"}</td>
                        <td className="px-4 py-3 text-[#41415C]">{b.expiry_date ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-mono text-[#1B1B2F]">{b.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono text-[#8A8AA0]">
                          {prod?.cost_price ? fmtMoney(prod.cost_price) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[#1B1B2F]">
                          {b.mrp ? fmtMoney(b.mrp) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusPill status={b.status} days={b.days_to_expiry} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => remove(b.id)}
                            className="ph-btn w-7 h-7 flex items-center justify-center text-[#8A8AA0] hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden p-4 space-y-3">
              {filtered.map(b => {
                const prod = getProduct(b.product_id);
                return (
                  <div key={b.id} className="ph-card-sm p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-[#1B1B2F] text-sm">{b.product_name}</p>
                        {b.manufacturer && <p className="text-xs text-[#8A8AA0] mt-0.5">{b.manufacturer}</p>}
                      </div>
                      <StatusPill status={b.status} days={b.days_to_expiry} />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs mt-2">
                      <div><span className="text-[#8A8AA0]">Batch: </span><span className="font-mono text-[#41415C]">{b.batch_no ?? "—"}</span></div>
                      <div><span className="text-[#8A8AA0]">Qty: </span><span className="text-[#41415C]">{b.quantity}</span></div>
                      <div><span className="text-[#8A8AA0]">Expiry: </span><span className="text-[#41415C]">{b.expiry_date ?? "—"}</span></div>
                      <div><span className="text-[#8A8AA0]">MRP: </span><span className="text-[#41415C]">{b.mrp ? fmtMoney(b.mrp) : "—"}</span></div>
                      {prod?.cost_price != null && (
                        <div><span className="text-[#8A8AA0]">Cost: </span><span className="text-[#41415C]">{fmtMoney(prod.cost_price)}</span></div>
                      )}
                    </div>
                    <div className="flex justify-end mt-2">
                      <button onClick={() => remove(b.id)}
                        className="ph-btn w-8 h-8 flex items-center justify-center text-[#8A8AA0] hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Add Medicine Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center overflow-y-auto p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="ph-scene w-full max-w-2xl my-6 shadow-2xl animate-scale-in">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid #D0D8E8" }}>
              <div>
                <h2 className="font-bold text-[#1B1B2F] text-base flex items-center gap-2">
                  <Pill size={16} className="text-teal-600" /> Receive Medicine Batch
                </h2>
                <p className="text-xs text-[#8A8AA0] mt-0.5">Add stock for a medicine product</p>
              </div>
              <button onClick={() => setShowModal(false)}
                className="ph-btn w-8 h-8 flex items-center justify-center text-[#8A8AA0] hover:text-[#1B1B2F]">
                <X size={16} />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={addBatch} className="p-6 space-y-4">

              {/* Product */}
              <div>
                <label className="block text-xs font-semibold text-[#41415C] uppercase tracking-wide mb-1.5">
                  Product / Medicine *
                </label>
                <div className="relative">
                  <select
                    className="ph-inset w-full px-3 py-2.5 text-sm text-[#1B1B2F] appearance-none pr-8"
                    value={form.product_id}
                    onChange={e => setForm({ ...form, product_id: e.target.value })}
                  >
                    <option value="">— Select medicine —</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.sku ? ` (${p.sku})` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8AA0] pointer-events-none" />
                </div>
              </div>

              {/* Scan */}
              <div>
                <label className="block text-xs font-semibold text-[#41415C] uppercase tracking-wide mb-1.5">
                  Or Scan Barcode
                </label>
                <ScanInput onScan={onScan} className="w-full" placeholder="Scan product barcode…" />
              </div>

              {/* Grid fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#41415C] uppercase tracking-wide mb-1.5">
                    Batch Number
                  </label>
                  <input
                    className="ph-inset w-full px-3 py-2.5 text-sm text-[#1B1B2F]"
                    placeholder="e.g. B-2024-001"
                    value={form.batch_no}
                    onChange={e => setForm({ ...form, batch_no: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#41415C] uppercase tracking-wide mb-1.5">
                    Quantity *
                  </label>
                  <input
                    type="number" step="0.001" min="0"
                    className="ph-inset w-full px-3 py-2.5 text-sm text-[#1B1B2F]"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#41415C] uppercase tracking-wide mb-1.5">
                    Manufacture Date
                  </label>
                  <input
                    type="date"
                    className="ph-inset w-full px-3 py-2.5 text-sm text-[#1B1B2F]"
                    value={form.mfg_date}
                    onChange={e => setForm({ ...form, mfg_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#41415C] uppercase tracking-wide mb-1.5">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    className="ph-inset w-full px-3 py-2.5 text-sm text-[#1B1B2F]"
                    value={form.expiry_date}
                    onChange={e => setForm({ ...form, expiry_date: e.target.value })}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 rounded-xl px-3 py-2.5"
                  style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                  {error}
                </p>
              )}

              {/* Footer */}
              <div className="flex gap-3 justify-end pt-1"
                style={{ borderTop: "1px solid #D0D8E8", paddingTop: "1rem" }}>
                <button type="button" onClick={() => setShowModal(false)}
                  className="ph-btn px-4 py-2 text-sm text-[#41415C]">
                  Cancel
                </button>
                <button type="submit"
                  className="ph-btn-primary flex items-center gap-2 px-5 py-2 text-sm font-medium">
                  <Plus size={15} /> Add Batch (Stock In)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
