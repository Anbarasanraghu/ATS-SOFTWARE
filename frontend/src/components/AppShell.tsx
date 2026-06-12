import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
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

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar — static on md+, slide-over drawer on mobile */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-60 bg-surface border-r border-line flex flex-col
        transform transition-transform md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-accent">modular/erp</div>
            <div className="text-xs text-muted mt-1">{me?.tenant.name}</div>
          </div>
          <button className="md:hidden text-muted" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} onClick={() => setOpen(false)} className={linkCls}>
                <Icon size={17} /> {item.label}
              </NavLink>
            );
          })}
          {me?.user?.is_platform_admin && (
            <NavLink to="/admin/tenants" onClick={() => setOpen(false)} className={linkCls}>⚙ Admin</NavLink>
          )}
        </nav>
        <div className="p-3 border-t border-line">
          <div className="px-2 pb-2 text-xs text-muted truncate">{me?.user.email}</div>
          <button onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm hover:bg-line/50">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        {/* Mobile top bar with hamburger */}
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-3 bg-surface border-b border-line px-4 py-3">
          <button onClick={() => setOpen(true)} className="text-ink"><Menu size={20} /></button>
          <span className="text-sm font-semibold text-accent">modular/erp</span>
          <span className="text-xs text-muted ml-auto truncate max-w-[40%]">{me?.tenant.name}</span>
        </div>
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-5 md:py-8">{children}</div>
      </main>
    </div>
  );
}
