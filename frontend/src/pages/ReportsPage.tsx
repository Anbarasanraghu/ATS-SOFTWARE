import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, IndianRupee, FileText, Users, Boxes, TrendingUp } from "lucide-react";
import { api, type MonthStat, type ReportSummary } from "../lib/api";
import { money } from "../lib/money";

const STATUS_CLS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  sent: "bg-sky-100 text-sky-700",
  paid: "bg-emerald-100 text-emerald-700",
  void: "bg-red-100 text-red-600",
};

function KpiCard({ label, value, sub, icon: Icon, color, onClick }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left w-full bg-surface border border-line rounded-lg p-5 flex items-start gap-4 transition-all
        ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-line/80" : "cursor-default"}`}
    >
      <div className={`rounded-lg p-2.5 ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted uppercase tracking-wide mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
      </div>
    </button>
  );
}

function BarChart({ data }: { data: MonthStat[] }) {
  if (!data.length) return <p className="text-sm text-muted p-4">No data yet.</p>;
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex items-end gap-2 h-40 px-2">
      {data.map((d) => (
        <div key={d.month} className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <div className="text-xs text-muted font-mono">{Number(d.total).toFixed(0)}</div>
          <div
            className="w-full bg-accent/80 rounded-t-sm"
            style={{ height: `${Math.max((d.total / max) * 120, 4)}px` }}
          />
          <div className="text-[10px] text-muted truncate w-full text-center">{d.month.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [monthData, setMonthData] = useState<MonthStat[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    void (async () => {
      try {
        const [s, m] = await Promise.all([api.reportSummary(), api.reportByMonth()]);
        setSummary(s);
        setMonthData(m);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-muted text-sm p-4">Loading…</div>;
  if (!summary) return <div className="text-danger text-sm p-4">Failed to load reports.</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Reports</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Revenue"
          value={money(summary.revenue)}
          sub="from paid invoices"
          icon={IndianRupee}
          color="bg-emerald-100 text-emerald-700"
          onClick={() => navigate("/billing")}
        />
        <KpiCard
          label="Outstanding"
          value={money(summary.outstanding)}
          sub="draft + sent invoices"
          icon={TrendingUp}
          color="bg-sky-100 text-sky-700"
          onClick={() => navigate("/billing")}
        />
        <KpiCard
          label="Customers"
          value={String(summary.customer_count)}
          icon={Users}
          color="bg-violet-100 text-violet-700"
          onClick={() => navigate("/customers")}
        />
        <KpiCard
          label="Products"
          value={String(summary.product_count)}
          icon={Boxes}
          color="bg-amber-100 text-amber-700"
          onClick={() => navigate("/products")}
        />
      </div>

      {/* Invoice breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(["draft", "sent", "paid", "void"] as const).map((s) => (
          <button key={s} onClick={() => navigate("/billing")}
            className="text-left w-full bg-surface border border-line rounded-lg p-4 flex items-center gap-3 transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-line/80">
            <FileText size={18} className="text-muted" />
            <div>
              <div className="text-lg font-bold">{summary.invoices[s]}</div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[s]}`}>{s}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly chart */}
        <div className="bg-surface border border-line rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-muted" />
            <span className="font-semibold text-sm">Revenue by Month</span>
          </div>
          <BarChart data={monthData} />
        </div>

        {/* Top customers */}
        <div className="bg-surface border border-line rounded-lg p-5">
          <div className="font-semibold text-sm mb-4">Top Customers (by revenue)</div>
          {summary.top_customers.length === 0 ? (
            <p className="text-sm text-muted">No paid invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {summary.top_customers.map((tc, i) => {
                const max = summary.top_customers[0].total;
                return (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-4 text-xs text-muted font-mono">{i + 1}</span>
                    <span className="flex-1 truncate font-medium">{tc.name}</span>
                    <span className="font-mono text-xs text-muted w-24 text-right">
                      {money(tc.total)}
                    </span>
                    <div className="w-20 h-2 rounded-full bg-line overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${(tc.total / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent invoices */}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-line font-semibold text-sm">Recent Invoices</div>
        {summary.recent_invoices.length === 0 ? (
          <p className="p-5 text-sm text-muted">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.recent_invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-muted">{inv.invoice_number}</td>
                  <td className="px-4 py-3 font-medium">{inv.customer_name}</td>
                  <td className="px-4 py-3 text-muted">{inv.issue_date ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{money(inv.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[inv.status] ?? ""}`}>
                      {inv.status}
                    </span>
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
