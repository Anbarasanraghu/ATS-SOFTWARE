import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Package, PlusCircle, Trash2, ArrowDownUp, Pencil } from "lucide-react";
import { api, type Activity, type DailyCount } from "../lib/api";
import { money } from "../lib/money";

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function actionIcon(a: Activity) {
  if (a.entity === "stock") return <ArrowDownUp size={15} className="text-accent" />;
  if (a.action === "create") return <PlusCircle size={15} className="text-emerald-500" />;
  if (a.action === "delete") return <Trash2 size={15} className="text-danger" />;
  if (a.action === "update") return <Pencil size={15} className="text-amber-500" />;
  return <Package size={15} className="text-muted" />;
}

// Source categories the feed can be filtered by.
const CATEGORIES = ["Inventory", "Stock In/Out", "Purchases", "Sales / POS", "Payroll"] as const;
type Category = (typeof CATEGORIES)[number];

function categoryOf(a: Activity): Category {
  if (a.entity === "stock") return "Stock In/Out";
  if (a.entity === "purchase") return "Purchases";
  if (a.entity === "sale") return "Sales / POS";
  if (a.entity === "payroll") return "Payroll";
  return "Inventory"; // product / category / supplier
}

const CATEGORY_STYLE: Record<Category, string> = {
  "Inventory": "bg-sky-100 text-sky-700",
  "Stock In/Out": "bg-accent-soft text-accent",
  "Purchases": "bg-violet-100 text-violet-700",
  "Sales / POS": "bg-emerald-100 text-emerald-700",
  "Payroll": "bg-amber-100 text-amber-700",
};

function describe(a: Activity): string {
  const name = a.entity_name ?? "item";
  if (a.entity === "stock") {
    const qty = a.detail.quantity as number | undefined;
    const stock = a.detail.new_stock as number | undefined;
    const label = { in: "Stock in", out: "Stock out", adjustment: "Adjusted", return: "Returned" }[a.action] ?? a.action;
    return `${label} ${qty ?? ""} · ${name}${stock != null ? ` → ${stock} on hand` : ""}`;
  }
  if (a.entity === "payroll") {
    const period = a.detail.period as string | undefined;
    const net = a.detail.net as number | undefined;
    if (a.action === "run") return `Ran payroll for ${name} · ${a.detail.created ?? 0} created`;
    const verb = { create: "Payroll created", update: "Payroll edited", approved: "Payroll approved",
                   paid: "Salary paid", delete: "Payroll deleted" }[a.action] ?? `Payroll ${a.action}`;
    return `${verb} — ${name}${period ? ` (${period})` : ""}${net != null ? ` · ${money(net)}` : ""}`;
  }
  if (a.entity === "purchase" || a.entity === "sale") {
    const isPos = a.entity === "sale" && name.startsWith("INV-");
    const verb = a.action === "delete"
      ? "Reversed"
      : a.entity === "purchase" ? "Purchase from" : isPos ? "POS / invoice sale" : "Sale to";
    const total = a.detail.total as number | undefined;
    return `${verb} ${name}${total != null ? ` · ${money(total)}` : ""}`;
  }
  if (a.action === "create") return `Added ${name}`;
  if (a.action === "delete") return `Deleted ${name}`;
  if (a.action === "update") {
    const changes = (a.detail.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
    const keys = Object.keys(changes);
    if (keys.length === 0) return `Updated ${name}`;
    const parts = keys.slice(0, 3).map((k) => `${k}: ${changes[k].from ?? "—"} → ${changes[k].to ?? "—"}`);
    return `Updated ${name} (${parts.join(", ")}${keys.length > 3 ? "…" : ""})`;
  }
  return `${a.action} ${name}`;
}

export default function UpdatesPage() {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [daily, setDaily] = useState<DailyCount[]>([]);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | "all">("all");

  useEffect(() => {
    void (async () => {
      const [a, d] = await Promise.all([api.listActivity(300), api.activityDaily(180)]);
      setActivity(a); setDaily(d);
    })();
  }, []);

  const countByDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of daily) m[d.day] = d.count;
    return m;
  }, [daily]);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const lead = first.getDay();
    const out: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    return out;
  }, [month]);

  const maxCount = Math.max(1, ...Object.values(countByDay));
  function heat(n: number) {
    if (!n) return "bg-paper";
    const r = n / maxCount;
    if (r > 0.66) return "bg-accent text-white";
    if (r > 0.33) return "bg-accent/60 text-white";
    return "bg-accent-soft";
  }

  // Day filter first (drives the category chip counts), then category.
  const dayFeed = selectedDay
    ? activity.filter((a) => dayKey(new Date(a.created_at)) === selectedDay)
    : activity;
  const feed = category === "all" ? dayFeed : dayFeed.filter((a) => categoryOf(a) === category);

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of dayFeed) { const c = categoryOf(a); m[c] = (m[c] ?? 0) + 1; }
    return m;
  }, [dayFeed]);

  const monthLabel = month.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="neu-scene p-5 sm:p-6 space-y-6">
      <h1 className="text-xl font-semibold">Updates</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="neu rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1 rounded hover:bg-line/50"><ChevronLeft size={18} /></button>
            <div className="font-medium text-sm">{monthLabel}</div>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1 rounded hover:bg-line/50"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted mb-1">
            {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const key = dayKey(d);
              const n = countByDay[key] ?? 0;
              const isSel = selectedDay === key;
              return (
                <button key={i}
                  onClick={() => setSelectedDay(isSel ? null : key)}
                  className={`aspect-square rounded flex flex-col items-center justify-center text-xs ${heat(n)} ${isSel ? "ring-2 ring-accent" : ""}`}
                  title={`${n} change(s)`}>
                  <span>{d.getDate()}</span>
                  {n > 0 && <span className="text-[9px] font-semibold">{n}</span>}
                </button>
              );
            })}
          </div>
          {selectedDay && (
            <button onClick={() => setSelectedDay(null)} className="mt-3 text-xs text-accent hover:underline">Clear day filter ({selectedDay})</button>
          )}
        </div>

        {/* Feed */}
        <div className="neu rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <div className="text-sm font-medium">
              {selectedDay ? `Activity on ${selectedDay}` : "Recent activity"}
              <span className="text-muted font-normal"> · {feed.length}</span>
            </div>
            {/* Category filter chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button onClick={() => setCategory("all")}
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${category === "all" ? "bg-accent text-white" : "bg-line/40 text-muted hover:bg-line/70"}`}>
                All ({dayFeed.length})
              </button>
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(category === c ? "all" : c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${category === c ? "bg-accent text-white" : "bg-line/40 text-muted hover:bg-line/70"}`}>
                  {c} ({catCounts[c] ?? 0})
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-line/60 max-h-[60vh] overflow-y-auto">
            {feed.length === 0 && <p className="px-4 py-6 text-sm text-muted">No activity{selectedDay ? " on this day" : ""}{category !== "all" ? ` in ${category}` : ""}.</p>}
            {feed.map((a) => {
              const cat = categoryOf(a);
              return (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5">{actionIcon(a)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{describe(a)}</div>
                    <div className="text-xs text-muted mt-1 flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded ${CATEGORY_STYLE[cat]}`}>{cat}</span>
                      <span>{a.actor ? `${a.actor} · ` : ""}{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
