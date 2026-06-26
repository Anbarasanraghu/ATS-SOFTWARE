import { useEffect, useState } from "react";
import { Plus, X, Pencil, Trash2, Users, AlertTriangle } from "lucide-react";
import { teamApi, type TeamUser, type Seats, type TeamModule } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

const ROLES = [
  { value: "member", label: "Member — only assigned modules" },
  { value: "manager", label: "Manager — assigned modules + HR/payroll" },
  { value: "admin", label: "Admin — full access + manage users" },
];

export default function TeamPage() {
  const { me } = useAuth();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [seats, setSeats] = useState<Seats | null>(null);
  const [modules, setModules] = useState<TeamModule[]>([]);
  const [editing, setEditing] = useState<TeamUser | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [u, s] = await Promise.all([teamApi.users(), teamApi.seats()]);
      setUsers(u); setSeats(s);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load."); }
  }
  useEffect(() => { void refresh(); void teamApi.modules().then(setModules); }, []);

  async function remove(u: TeamUser) {
    if (!confirm(`Remove ${u.email}? This deletes their account.`)) return;
    try { await teamApi.deleteUser(u.id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header + seat usage */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white"><Users size={18} /></div>
          <div>
            <h1 className="text-lg font-bold text-ink">Team</h1>
            <p className="text-xs text-muted">Add users for your office and choose what each can access.</p>
          </div>
        </div>
        <button
          onClick={() => { setError(null); setEditing("new"); }}
          disabled={!seats?.can_add}
          title={seats && !seats.can_add ? "Seat limit reached — ask your provider for more seats" : ""}
          className="inline-flex items-center gap-2 rounded-md bg-accent text-white px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40">
          <Plus size={16} /> Add user
        </button>
      </div>

      {seats && (
        <div className="flex flex-wrap gap-3">
          <Stat label="Seats used" value={`${seats.active_users} / ${seats.max_users}`} />
          <Stat label="Available" value={String(seats.available)} />
          <Stat label="Monthly cost" value={`$${seats.monthly_total.toLocaleString()}`}
            sub={`$${seats.price_per_user}/user`} />
        </div>
      )}

      {seats && !seats.can_add && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={15} /> All {seats.max_users} seats are in use. Contact your provider to add more seats.
        </div>
      )}
      {error && <div className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      {/* Users table */}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Modules</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === me?.user.id;
              return (
                <tr key={u.id} className="border-b border-line/60 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{u.full_name || u.email}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {u.role}{u.is_owner && <span className="ml-1 text-[10px] uppercase bg-accent-soft text-accent px-1.5 py-0.5 rounded">owner</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.is_owner || u.role === "admin"
                      ? <span className="text-xs text-muted">All modules</span>
                      : <div className="flex flex-wrap gap-1">
                          {u.modules.length === 0 && <span className="text-xs text-muted">—</span>}
                          {u.modules.map((m) => <span key={m} className="text-[11px] bg-line/60 rounded px-1.5 py-0.5 capitalize">{m}</span>)}
                        </div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === "active" ? "bg-green-100 text-green-700" : "bg-line text-muted"}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {!u.is_owner && !isSelf && (
                      <div className="inline-flex gap-1">
                        <button onClick={() => { setError(null); setEditing(u); }} className="p-1.5 text-muted hover:text-accent" title="Edit"><Pencil size={15} /></button>
                        <button onClick={() => remove(u)} className="p-1.5 text-muted hover:text-danger" title="Remove"><Trash2 size={15} /></button>
                      </div>
                    )}
                    {isSelf && <span className="text-xs text-muted">You</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <UserModal
          user={editing === "new" ? null : editing}
          modules={modules}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void refresh(); }}
          onError={setError}
        />
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface border border-line rounded-lg px-4 py-3 min-w-[130px]">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-bold text-ink">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function UserModal({ user, modules, onClose, onSaved, onError }: {
  user: TeamUser | null;
  modules: TeamModule[];
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const isEdit = !!user;
  const [email, setEmail] = useState(user?.email ?? "");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role ?? "member");
  const [status, setStatus] = useState(user?.status ?? "active");
  const [selected, setSelected] = useState<string[]>(user?.modules ?? []);
  const [busy, setBusy] = useState(false);

  const privileged = role === "admin";

  function toggleMod(code: string) {
    setSelected((s) => s.includes(code) ? s.filter((c) => c !== code) : [...s, code]);
  }

  async function save() {
    try {
      setBusy(true);
      if (isEdit) {
        await teamApi.updateUser(user!.id, {
          full_name: fullName, role, status,
          password: password || undefined,
          modules: selected,
        });
      } else {
        if (password.length < 6) { onError("Password must be at least 6 characters."); setBusy(false); return; }
        await teamApi.createUser({ email, full_name: fullName || undefined, password, role, modules: selected });
      }
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed.");
    } finally { setBusy(false); }
  }

  const inputCls = "mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 outline-none focus:border-accent text-sm";
  const labelCls = "text-xs font-medium uppercase tracking-wide text-muted";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md bg-surface border border-line rounded-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEdit ? "Edit user" : "Add user"}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>

        <label className="block">
          <span className={labelCls}>Email</span>
          <input type="email" value={email} disabled={isEdit} onChange={(e) => setEmail(e.target.value)}
            className={`${inputCls} ${isEdit ? "opacity-60" : ""}`} />
        </label>

        <label className="block">
          <span className={labelCls}>Name</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
        </label>

        <label className="block">
          <span className={labelCls}>{isEdit ? "New password (optional)" : "Password"}</span>
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? "leave blank to keep" : "min 6 characters"} className={inputCls} />
        </label>

        <label className="block">
          <span className={labelCls}>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>

        {isEdit && (
          <label className="block">
            <span className={labelCls}>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
        )}

        <div>
          <span className={labelCls}>Module access</span>
          {privileged ? (
            <p className="text-xs text-muted mt-1">Admins get access to all modules automatically.</p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {modules.map((m) => (
                <label key={m.module_id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.includes(m.code)} onChange={() => toggleMod(m.code)} />
                  {m.name}
                </label>
              ))}
              {modules.length === 0 && <p className="text-xs text-muted col-span-2">No modules enabled for this workspace.</p>}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={busy} className="flex-1 rounded-md bg-accent text-white py-2 font-medium disabled:opacity-50">
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create user"}
          </button>
          <button onClick={onClose} className="rounded-md border border-line px-4 py-2 text-sm text-muted hover:bg-line/50">Cancel</button>
        </div>
      </div>
    </div>
  );
}
