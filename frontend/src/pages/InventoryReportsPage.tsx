import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { api, type InventorySummary, type PeriodStat } from "../lib/api";
import { money } from "../lib/money";

function Card({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-left w-full neu rounded-2xl p-4 transition-all
        ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-line/80" : "cursor-default"}`}
    >
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </button>
  );
}

export default function InventoryReportsPage() {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [period, setPeriod]   = useState<"daily" | "monthly">("daily");
  const [stats, setStats]     = useState<PeriodStat[]>([]);
  const navigate = useNavigate();

  useEffect(() => { void api.inventorySummary().then(setSummary); }, []);
  useEffect(() => { void api.inventoryByPeriod(period).then(setStats); }, [period]);

  const maxVal = Math.max(1, ...stats.map((s) => Math.max(s.stock_in, s.stock_out)));

  return (
    <div className="neu-scene p-5 sm:p-6 space-y-6">
      <h1 className="text-xl font-semibold">Inventory Reports</h1>

      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Items" value={String(summary.item_count)} sub={`${summary.total_stock_units} units on hand`} onClick={() => navigate("/inventory")} />
            <Card label="Stock Value (cost)" value={money(summary.stock_value_cost)} sub={`Retail ${money(summary.stock_value_retail)}`} onClick={() => navigate("/inventory")} />
            <Card label="Low Stock" value={String(summary.low_stock_count)} sub="at or below reorder level" onClick={() => navigate("/inventory")} />
            <Card label="Today" value={`${money(summary.sales_today)}`} sub={`Sales · Purchases ${money(summary.purchases_today)}`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Total Purchases" value={money(summary.purchases_total)} onClick={() => navigate("/purchases")} />
            <Card label="Total Sales" value={money(summary.sales_total)} onClick={() => navigate("/sales")} />
            <Card label="Gross Margin" value={money(summary.sales_total - summary.purchases_total)} sub="sales − purchases" />
            <Card label="Retail − Cost" value={money(summary.stock_value_retail - summary.stock_value_cost)} sub="potential margin in stock" />
          </div>
        </>
      )}

      {/* Movements / value by period */}
      <div className="neu rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="text-sm font-medium">Stock movement &amp; trade by {period === "daily" ? "day (30d)" : "month (12m)"}</div>
          <div className="flex border border-line rounded-md overflow-hidden text-sm">
            {(["daily", "monthly"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 capitalize ${period === p ? "bg-accent text-white" : "hover:bg-line/50"}`}>{p}</button>
            ))}
          </div>
        </div>
        {stats.length === 0 ? (
          <p className="p-6 text-sm text-muted">No movement in this range.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2">Period</th>
                <th className="px-4 py-2">In / Out (units)</th>
                <th className="px-4 py-2 text-right">Stock In</th>
                <th className="px-4 py-2 text-right">Stock Out</th>
                <th className="px-4 py-2 text-right">Purchases</th>
                <th className="px-4 py-2 text-right">Sales</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.period} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{s.period}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1 h-4">
                      <div className="bg-emerald-400/70 rounded-sm h-3" style={{ width: `${(s.stock_in / maxVal) * 100}px` }} title={`In ${s.stock_in}`} />
                      <div className="bg-amber-400/70 rounded-sm h-3" style={{ width: `${(s.stock_out / maxVal) * 100}px` }} title={`Out ${s.stock_out}`} />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-emerald-600">{s.stock_in}</td>
                  <td className="px-4 py-2 text-right font-mono text-amber-600">{s.stock_out}</td>
                  <td className="px-4 py-2 text-right font-mono">{money(s.purchases)}</td>
                  <td className="px-4 py-2 text-right font-mono">{money(s.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Low stock list */}
      {summary && summary.low_stock_items.length > 0 && (
        <div className="neu rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line text-sm font-medium flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" /> Low stock items
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2">Name</th><th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2 text-right">On hand</th><th className="px-4 py-2 text-right">Reorder</th>
              </tr>
            </thead>
            <tbody>
              {summary.low_stock_items.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-muted text-xs">{p.sku ?? "—"}</td>
                  <td className="px-4 py-2 text-right font-mono text-amber-600 font-semibold">{p.stock_qty} {p.unit}</td>
                  <td className="px-4 py-2 text-right font-mono text-muted">{p.reorder_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
