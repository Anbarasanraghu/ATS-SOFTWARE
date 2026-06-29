import { useEffect, useState } from "react";
import {
  Wallet, Receipt, Users, Package, TrendingUp, Loader2,
} from "lucide-react";
import { api, type ReportSummary, type MonthStat } from "../lib/api";
import { Card, StatCard, Badge } from "../components/ui";

const money = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

const statusTone: Record<string, "neutral" | "success" | "info" | "warning" | "danger"> = {
  paid: "success", sent: "info", draft: "neutral", void: "danger",
};

/** Lightweight SVG donut. */
function Donut({ value, label }: { value: number; label: string }) {
  const r = 52, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative w-36 h-36">
      <svg viewBox="0 0 130 130" className="w-full h-full -rotate-90">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#ECEDF3" strokeWidth="14" />
        <circle cx="65" cy="65" r={r} fill="none" stroke="url(#g)" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} />
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#5B6677" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-display text-ink">{Math.round(pct)}%</span>
        <span className="text-[11px] text-muted">{label}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [s, setS] = useState<ReportSummary | null>(null);
  const [months, setMonths] = useState<MonthStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sum, mon] = await Promise.all([api.reportSummary(), api.reportByMonth()]);
        setS(sum); setMonths(mon);
      } catch { /* empty state */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted">
        <Loader2 className="animate-spin" /> <span className="ml-2">Loading dashboard…</span>
      </div>
    );
  }

  const maxMonth = Math.max(1, ...months.map((m) => m.total));
  const inv = s?.invoices ?? { total: 0, draft: 0, sent: 0, paid: 0, void: 0 };
  const collectRate = inv.total ? (inv.paid / inv.total) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold font-display text-ink">Welcome back 👋</h1>
        <p className="text-sm text-muted">Here's what's happening in your business today.</p>
      </div>

      {/* KPI row — pastel bento cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total revenue" value={money(s?.revenue ?? 0)} icon={Wallet} tone="warning" delta="10.5%" deltaUp sub="vs last month" />
        <StatCard label="Outstanding" value={money(s?.outstanding ?? 0)} icon={Receipt} tone="danger" sub="unpaid invoices" />
        <StatCard label="Customers" value={s?.customer_count ?? 0} icon={Users} tone="info" delta="8.2%" deltaUp sub="total" />
        <StatCard label="Products" value={s?.product_count ?? 0} icon={Package} tone="success" sub="in catalog" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Revenue trend (bars) */}
        <Card hover className="lg:col-span-2 p-6 relative overflow-hidden">
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-accent-soft blur-3xl pointer-events-none" />
          <div className="relative flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">Revenue trend</h2>
              <p className="text-xs text-muted">Monthly billing</p>
            </div>
            <div className="text-2xl font-bold font-display text-ink">{money(s?.revenue ?? 0)}</div>
          </div>
          <div className="relative flex items-end gap-2 h-40">
            {months.length === 0 && <div className="text-xs text-muted">No data yet.</div>}
            {months.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div className="w-full rounded-t-lg bg-gradient-to-t from-accent/30 to-accent transition-all duration-300 group-hover:to-accent-hover"
                  style={{ height: `${Math.max(4, (m.total / maxMonth) * 100)}%` }}
                  title={`${m.month}: ${money(m.total)}`} />
                <span className="text-[9px] text-muted">{m.month.slice(5)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Donut */}
        <Card hover className="p-6 flex flex-col items-center justify-center text-center">
          <h2 className="text-sm font-semibold text-ink self-start mb-2">Collection rate</h2>
          <Donut value={collectRate} label="paid" />
          <p className="mt-3 text-xs text-muted">{inv.paid} of {inv.total} invoices paid</p>
        </Card>

        {/* Invoice status */}
        <Card hover className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-ink">Invoice status</h2>
          </div>
          <div className="space-y-3">
            {([["paid", inv.paid, "bg-success"], ["sent", inv.sent, "bg-info"], ["draft", inv.draft, "bg-muted"], ["void", inv.void, "bg-danger"]] as const).map(
              ([label, count, bar]) => {
                const pct = inv.total ? (count / inv.total) * 100 : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="capitalize text-muted">{label}</span>
                      <span className="text-ink font-semibold">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </Card>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent invoices */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-ink mb-3">Recent invoices</h2>
          <div className="divide-y divide-line">
            {(s?.recent_invoices ?? []).length === 0 && <p className="text-xs text-muted py-2">No invoices yet.</p>}
            {(s?.recent_invoices ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-ink truncate">{r.customer_name || "—"}</div>
                  <div className="text-[11px] text-muted">{r.invoice_number} · {r.issue_date ?? ""}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-semibold text-ink">{money(r.total)}</span>
                  <Badge tone={statusTone[r.status] ?? "neutral"}>{r.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top customers */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-ink mb-3">Top customers</h2>
          <div className="space-y-3">
            {(s?.top_customers ?? []).length === 0 && <p className="text-xs text-muted py-2">No data yet.</p>}
            {(s?.top_customers ?? []).map((c, i) => {
              const max = Math.max(1, ...(s?.top_customers ?? []).map((x) => x.total));
              return (
                <div key={c.name + i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-ink truncate">{c.name || "—"}</span>
                      <span className="text-muted">{money(c.total)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover" style={{ width: `${(c.total / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
