import { NavLink, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { navForModules } from "./modules";
import type { ReactNode } from "react";

export default function AppShell({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const items = navForModules(me?.modules ?? []);

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 bg-surface border-r border-line flex flex-col">
        <div className="px-5 py-4 border-b border-line">
          <div className="text-sm font-semibold text-accent">modular/erp</div>
          <div className="text-xs text-muted mt-1">{me?.tenant.name}</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                    isActive ? "bg-accent-soft text-accent font-medium" : "text-ink hover:bg-line/50"
                  }`}>
                <Icon size={17} /> {item.label}
              </NavLink>
            );
          })}
          {me?.user?.is_platform_admin && (
            <NavLink to="/admin/tenants"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                  isActive ? "bg-accent-soft text-accent font-medium" : "text-ink hover:bg-line/50"
                }`}>
              ⚙ Admin
            </NavLink>
          )}
        </nav>
        <div className="p-3 border-t border-line">
          <div className="px-2 pb-2 text-xs text-muted">{me?.user.email}</div>
          <button onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm hover:bg-line/50">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
