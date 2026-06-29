import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, IndianRupee, FileText, Users, Boxes, TrendingUp,
  ArrowUpRight, ArrowDownRight, Filter,
} from "lucide-react";
import { api, type MonthStat, type ReportSummary } from "../lib/api";
import { money } from "../lib/money";

const STATUS_CLS: Record<string, string> = {
  draft: "bg-surface-2 text-muted",
  sent: "bg-sky-100 text-sky-700",
  paid: "bg-emerald-100 text-emerald-700",
  void: "bg-red-100 text-red-600",
};

// ── Floating decorative 3D shapes ─────────────────────────────
function Shapes() {
  const shapes = [
    { cls: "top-2 left-[6%] w-9 h-9 rounded-xl rotate-12 bg-gradient-to-br from-sky-400 to-blue-600", d: "0s", t: "7s" },
    { cls: "top-24 right-[8%] w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-500", d: "1.2s", t: "6s" },
    { cls: "top-[40%] left-[3%] w-6 h-6 rounded-lg rotate-45 bg-gradient-to-br from-teal-300 to-emerald-500", d: "0.6s", t: "8s" },
    { cls: "bottom-16 right-[5%] w-10 h-10 rounded-2xl rotate-6 bg-gradient-to-br from-amber-300 to-orange-500", d: "0.3s", t: "9s" },
    { cls: "bottom-8 left-[12%] w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500", d: "1.6s", t: "6.5s" },
    { cls: "top-[55%] right-[14%] w-7 h-7 rounded-xl rotate-12 bg-gradient-to-br from-teal-400 to-cyan-500", d: "0.9s", t: "7.5s" },
  ];
  return (
    <>
      {shapes.map((s, i) => (
        <span key={i} aria-hidden
          className={`pointer-events-none absolute float shadow-lg opacity-80 ${s.cls}`}
          style={{ animationDelay: s.d, animationDuration: s.t }} />
      ))}
    </>
  );
}

// ── 3D KPI card ───────────────────────────────────────────────
function Kpi({ label, value, sub, icon: Icon, color, delta, onClick }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  color: string; delta?: number | null; onClick?: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`card-3d text-left w-full p-5 ${onClick ? "cursor-pointer" : "cursor-default"}`}>
      <div className="flex items-start justify-between">
        <div className={`rounded-xl p-2.5 ${color}`}><Icon size={20} /></div>
        {delta != null && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-ink mt-3">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-muted/80 mt-1">{sub}</div>}
    </button>
  );
}

// ── Funnel chart ──────────────────────────────────────────────
function Funnel({ stages }: { stages: { label: string; value: number; from: string; to: string }[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="float space-y-2.5 py-2">
      {stages.map((s, i) => {
        const w = 45 + 55 * (s.value / max);
        return (
          <div key={i} className="flex justify-center" style={{ perspective: "600px" }}>
            <div
              className="relative rounded-2xl text-white px-5 py-3.5 flex items-center justify-between transition-transform hover:scale-[1.03]"
              style={{
                width: `${w}%`,
                background: `linear-gradient(135deg, ${s.from}, ${s.to})`,
                boxShadow: `0 12px 24px -10px ${s.to}aa, inset 0 1px 0 rgba(255,255,255,0.3)`,
                transform: "rotateX(6deg)",
              }}>
              <span className="text-sm font-semibold drop-shadow">{s.label}</span>
              <span className="text-lg font-bold drop-shadow">{s.value}</span>
            </div>
          </div>
        );
      })}
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

  const inv = summary.invoices;
  const revDelta = monthData.length >= 2 && monthData[monthData.length - 2].total
    ? ((monthData[monthData.length - 1].total - monthData[monthData.length - 2].total) /
        monthData[monthData.length - 2].total) * 100
    : null;
  const maxMonth = Math.max(...monthData.map((d) => d.total), 1);

  const funnel = [
    { label: "Total invoices", value: inv.total, from: "#6366F1", to: "#4F46E5" },
    { label: "Issued (sent + paid)", value: inv.sent + inv.paid, from: "#3B82F6", to: "#2563EB" },
    { label: "Paid", value: inv.paid, from: "#14B8A6", to: "#0D9488" },
    { label: "Collected revenue", value: inv.paid, from: "#F59E0B", to: "#EA580C" },
  ];

  return (
    <div className="scene-3d p-5 sm:p-6 space-y-6">
      <Shapes />

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-dot text-3xl font-extrabold bg-gradient-to-br from-ink via-ink to-muted bg-clip-text text-transparent drop-shadow-sm">
            Reports
          </h1>
          <p className="mono-label text-[11px] text-muted mt-1.5">Performance · Pipeline · Revenue</p>
        </div>
        <button onClick={() => navigate("/billing")}
          className="rise inline-flex items-center gap-2 rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-semibold shadow-glow-violet hover:bg-accent-hover">
          <Filter size={16} /> View invoices
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total revenue" value={money(summary.revenue)} sub="from paid invoices"
          icon={IndianRupee} color="bg-emerald-100 text-emerald-700" delta={revDelta} onClick={() => navigate("/billing")} />
        <Kpi label="Outstanding" value={money(summary.outstanding)} sub="draft + sent"
          icon={TrendingUp} color="bg-sky-100 text-sky-700" onClick={() => navigate("/billing")} />
        <Kpi label="Customers" value={String(summary.customer_count)} sub="total"
          icon={Users} color="bg-indigo-100 text-indigo-700" onClick={() => navigate("/customers")} />
        <Kpi label="Products" value={String(summary.product_count)} sub="in catalog"
          icon={Boxes} color="bg-amber-100 text-amber-700" onClick={() => navigate("/products")} />
      </div>

      {/* Funnel + revenue chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-3d p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={16} className="text-accent" />
            <span className="font-semibold text-sm text-ink">Invoice funnel</span>
          </div>
          <Funnel stages={funnel} />
        </div>

        <div className="card-3d p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-accent" />
            <span className="font-semibold text-sm text-ink">Revenue by month</span>
          </div>
          {monthData.length === 0 ? (
            <p className="text-sm text-muted">No data yet.</p>
          ) : (
            <div className="flex items-end gap-2 h-44 px-1">
              {monthData.map((d) => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1.5 group min-w-0">
                  <div className="text-[10px] text-muted font-mono">{Number(d.total).toFixed(0)}</div>
                  <div className="w-full rounded-t-lg bg-gradient-to-t from-accent/40 to-accent transition-all duration-300 group-hover:from-accent group-hover:to-info"
                    style={{ height: `${Math.max((d.total / maxMonth) * 130, 4)}px` }} />
                  <div className="text-[10px] text-muted truncate w-full text-center">{d.month.slice(5)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top customers + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-3d p-6">
          <div className="font-semibold text-sm text-ink mb-4">Top customers</div>
          {summary.top_customers.length === 0 ? (
            <p className="text-sm text-muted">No paid invoices yet.</p>
          ) : (
            <div className="space-y-3">
              {summary.top_customers.map((tc, i) => {
                const max = summary.top_customers[0].total || 1;
                return (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 rounded-lg bg-accent-soft text-accent flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <span className="flex-1 truncate font-medium text-ink">{tc.name}</span>
                    <span className="font-mono text-xs text-muted w-24 text-right">{money(tc.total)}</span>
                    <div className="w-20 h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-accent to-info rounded-full" style={{ width: `${(tc.total / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card-3d p-6">
          <div className="font-semibold text-sm text-ink mb-3">Recent activity</div>
          {summary.recent_invoices.length === 0 ? (
            <p className="text-sm text-muted">No invoices yet.</p>
          ) : (
            <div className="divide-y divide-line">
              {summary.recent_invoices.map((invc) => (
                <button key={invc.id} onClick={() => navigate(`/billing/${invc.id}`)}
                  className="w-full flex items-center gap-3 py-2.5 text-left hover:opacity-80">
                  <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink truncate">{invc.customer_name || "—"}</div>
                    <div className="text-[11px] text-muted">{invc.invoice_number} · {invc.issue_date ?? ""}</div>
                  </div>
                  <span className="text-sm font-semibold text-ink">{money(invc.total)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[invc.status] ?? ""}`}>{invc.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
