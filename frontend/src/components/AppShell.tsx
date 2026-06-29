import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, SlidersHorizontal, Sparkles, Users, Menu, X, Shield, LayoutDashboard } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { navForModules, MODULE_NAV } from "./modules";
import type { ReactNode } from "react";

const SECTION_LABELS: Record<string, string> = {
  billing: "Billing",
  inventory: "Inventory",
  crm: "CRM",
  hr: "Human Resources",
  reports: "Reports",
  medical: "Pharmacy",
};

export default function AppShell({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // mobile drawer

  const items = me?.user?.is_platform_admin ? MODULE_NAV : navForModules(me?.modules ?? []);
  const canManage = !!me?.user?.is_platform_admin || ["owner", "admin"].includes(me?.user?.role ?? "");

  const isParentOfNav = (path: string) =>
    items.some((other) => other.path !== path && other.path.startsWith(path + "/"));

  // Group module nav items into labelled sections, preserving first-seen order.
  const sections: { key: string; label: string; items: typeof items }[] = [];
  for (const item of items) {
    let sec = sections.find((s) => s.key === item.code);
    if (!sec) {
      sec = { key: item.code, label: SECTION_LABELS[item.code] ?? item.code, items: [] };
      sections.push(sec);
    }
    sec.items.push(item);
  }

  const initials = (me?.user.full_name ?? me?.user.email ?? "?")
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const linkClass = (active: boolean) =>
    `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
      active
        ? "bg-accent text-white shadow-glow-violet"
        : "text-muted hover:text-accent hover:bg-accent-soft"
    }`;

  const pharmLinkClass = (active: boolean) =>
    `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 select-none ${
      active
        ? "ph-nav-active text-white"
        : "text-muted hover:text-teal-600 hover:bg-teal-50/60"
    }`;

  const close = () => setOpen(false);

  const Sidebar = (
    <div className="flex flex-col h-full glass-strong">
      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-line">
        <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-white shadow-glow-violet flex-shrink-0">
          <Sparkles size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-ink tracking-tight leading-tight font-display truncate">
            {me?.tenant.name ?? "ATS ERP"}
          </div>
          <div className="text-[11px] text-muted capitalize truncate">{me?.tenant.vertical ?? "workspace"}</div>
        </div>
        <button onClick={close} className="lg:hidden ml-auto text-muted hover:text-ink" aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        <NavLink to="/dashboard" onClick={close} className={({ isActive }) => linkClass(isActive)}>
          <LayoutDashboard size={16} className="flex-shrink-0" /> <span className="truncate">Dashboard</span>
        </NavLink>

        {sections.map((sec) => (
          <div key={sec.key} className="space-y-0.5">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted/70">{sec.label}</p>
            {sec.items.map((item) => {
              const Icon = item.icon;
              const cls = sec.key === "medical" ? pharmLinkClass : linkClass;
              return (
                <NavLink key={item.path} to={item.path} end={isParentOfNav(item.path)} onClick={close}
                  className={({ isActive }) => cls(isActive)}>
                  <Icon size={16} className="flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}

        {/* Workspace section */}
        <div className="space-y-0.5 pt-1">
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted/70">Workspace</p>
          <NavLink to="/assistant" onClick={close} className={({ isActive }) => linkClass(isActive)}>
            <Sparkles size={16} className="flex-shrink-0" /> <span className="truncate">AI Assistant</span>
          </NavLink>
          {canManage && (
            <NavLink to="/team" onClick={close} className={({ isActive }) => linkClass(isActive)}>
              <Users size={16} className="flex-shrink-0" /> <span className="truncate">Team</span>
            </NavLink>
          )}
          {canManage && (
            <NavLink to="/settings" onClick={close} className={({ isActive }) => linkClass(isActive)}>
              <SlidersHorizontal size={16} className="flex-shrink-0" /> <span className="truncate">Settings</span>
            </NavLink>
          )}
          {me?.user?.is_platform_admin && (
            <NavLink to="/admin/tenants" onClick={close} className={({ isActive }) => linkClass(isActive)}>
              <Shield size={16} className="flex-shrink-0" /> <span className="truncate">Admin</span>
            </NavLink>
          )}
        </div>
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-line">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-glow-violet">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ink truncate">{me?.user.full_name || me?.user.email}</p>
            <p className="text-[11px] text-muted capitalize truncate">{me?.user.role ?? "member"}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate("/login"); }}
          className="mt-1 flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-danger hover:bg-danger-soft transition-colors duration-150">
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper">
      {/* Mobile top bar */}
      <header className="lg:hidden no-print sticky top-0 z-30 flex items-center gap-3 px-4 h-14 glass-strong border-b border-line">
        <button onClick={() => setOpen(true)} className="text-ink p-1 -ml-1" aria-label="Open menu">
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white"><Sparkles size={15} /></div>
          <span className="text-sm font-bold text-ink font-display truncate">{me?.tenant.name ?? "ATS ERP"}</span>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="no-print hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 border-r border-line z-20">
        {Sidebar}
      </aside>

      {/* Mobile drawer + overlay */}
      {open && (
        <div className="lg:hidden no-print fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] border-r border-line shadow-pop animate-slide-in-left">
            {Sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="lg:pl-64 min-w-0">
        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
