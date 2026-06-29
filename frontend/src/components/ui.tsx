import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2, ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";

/** Page heading with optional icon, subtitle and right-aligned actions. */
export function PageHeader({ title, subtitle, icon: Icon, actions }: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white shadow-glow-violet flex-shrink-0">
            <Icon size={18} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold font-display text-ink truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Soft white surface card with optional hover lift. */
export function Card({ className = "", hover = false, children }: {
  className?: string; hover?: boolean; children: ReactNode;
}) {
  return (
    <div className={`bg-surface border border-line rounded-2xl shadow-card ${hover ? "glass-hover" : ""} ${className}`}>{children}</div>
  );
}

type Tone = "accent" | "success" | "warning" | "info" | "danger";

const TONE_BG: Record<Tone, string> = {
  accent: "bg-accent-soft", success: "bg-success-soft", warning: "bg-warning-soft",
  info: "bg-info-soft", danger: "bg-danger-soft",
};
const TONE_FG: Record<Tone, string> = {
  accent: "text-accent", success: "text-success", warning: "text-warning",
  info: "text-info", danger: "text-danger",
};

/** Pastel-tinted KPI card with an icon chip and optional delta — the bento staple. */
export function StatCard({ label, value, sub, icon: Icon, tone = "accent", delta, deltaUp }: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: LucideIcon;
  tone?: Tone;
  delta?: string;
  deltaUp?: boolean;
}) {
  return (
    <div className={`${TONE_BG[tone]} rounded-2xl p-5 shadow-card glass-hover`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-ink-soft">{label}</span>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl bg-surface flex items-center justify-center shadow-sm ${TONE_FG[tone]} flex-shrink-0`}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold font-display text-ink truncate">{value}</div>
      <div className="mt-1 flex items-center gap-2">
        {delta && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${deltaUp ? "text-success" : "text-danger"}`}>
            {deltaUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{delta}
          </span>
        )}
        {sub && <span className="text-[11px] text-muted truncate">{sub}</span>}
      </div>
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  icon?: LucideIcon;
};

/** Themed pill button with variants, sizes and a loading state. */
export function Button({
  variant = "primary", size = "md", loading = false, icon: Icon,
  className = "", children, disabled, ...rest
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary: "bg-accent text-white hover:bg-accent-hover shadow-glow-violet",
    secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
    ghost: "text-muted hover:text-ink hover:bg-surface-2",
    danger: "bg-danger text-white hover:opacity-90",
  };
  const sizes: Record<string, string> = {
    sm: "px-3.5 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2.5 text-sm gap-2",
  };
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-xl font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}>
      {loading ? <Loader2 size={size === "sm" ? 13 : 15} className="animate-spin" /> : Icon && <Icon size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}

/** Small status pill. */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone | "neutral" }) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    info: "bg-info-soft text-info",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
