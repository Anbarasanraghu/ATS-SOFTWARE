import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, Settings, SlidersHorizontal } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { navForModules, MODULE_NAV } from "./modules";
import type { ReactNode } from "react";

export default function AppShell({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);   // mobile drawer
  // Platform admins see every module; tenants see only what's enabled for them.
  const items = me?.user?.is_platform_admin ? MODULE_NAV : navForModules(me?.modules ?? []);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
      isActive ? "bg-accent-soft text-accent font-medium" : "text-ink hover:bg-line/50"
    }`;

  const initials = (me?.user.full_name ?? me?.user.email ?? "?")
    .split(" ")
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-paper">

      {/* ── Sidebar ── */}
      <aside className="no-print w-64 bg-surface border-r border-line flex flex-col flex-shrink-0 sticky top-0 h-screen">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-line">
          <div className="text-base font-bold text-accent tracking-tight">modular/erp</div>
          <div className="text-xs text-muted mt-0.5 font-medium">{me?.tenant.name ?? "Loading…"}</div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-white shadow-sm"
                      : "text-muted hover:text-ink hover:bg-line/60"
                  }`
                }>
                <Icon size={16} className="flex-shrink-0" />
                {item.label}
              </NavLink>
            );
          })}

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:text-ink hover:bg-line/60"
              }`
            }>
            <SlidersHorizontal size={16} className="flex-shrink-0" /> Settings
          </NavLink>

          {me?.user?.is_platform_admin && (
            <NavLink
              to="/admin/tenants"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted hover:text-ink hover:bg-line/60"
                }`
              }>
              <Settings size={16} className="flex-shrink-0" /> Admin
            </NavLink>
          )}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-line space-y-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-ink truncate">{me?.user.email}</p>
              <p className="text-[11px] text-muted capitalize">{me?.user.role ?? "Administrator"}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-danger hover:bg-red-50 transition-colors">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto min-w-0">
        <div className="px-8 py-8 max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  );
}
