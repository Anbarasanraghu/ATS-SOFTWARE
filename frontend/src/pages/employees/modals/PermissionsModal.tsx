import { useEffect, useState } from "react";
import { X, Shield, Save } from "lucide-react";
import { api, type EmployeePermission } from "../../../lib/api";

interface Props {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}

export function PermissionsModal({ employeeId, employeeName, onClose }: Props) {
  const [perms, setPerms] = useState<EmployeePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.listPermissions(employeeId).then(setPerms).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function toggle(module: string) {
    setPerms(ps => ps.map(p => p.module === module ? { ...p, has_access: !p.has_access } : p));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updatePermissions(employeeId, perms.map(p => ({ module: p.module, has_access: p.has_access })));
      setPerms(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* */ }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-accent" />
            <h2 className="text-base font-semibold text-ink">Permissions — {employeeName}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-muted text-sm">Loading…</div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted mb-4">Toggle module access for this employee. Changes take effect after saving.</p>
              {perms.map(p => (
                <label key={p.module} className="flex items-center justify-between p-3 rounded-xl border border-line hover:bg-surface cursor-pointer">
                  <span className="text-sm font-medium text-ink">{p.label}</span>
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={p.has_access} onChange={() => toggle(p.module)} />
                    <div onClick={() => toggle(p.module)}
                      className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${p.has_access ? "bg-accent" : "bg-gray-200"}`}>
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-surface rounded-full shadow transition-transform ${p.has_access ? "translate-x-5" : ""}`} />
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {!loading && (
          <div className="px-6 py-4 border-t border-line">
            <button onClick={save} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 text-sm font-medium">
              <Save size={14} />
              {saving ? "Saving…" : saved ? "Saved!" : "Save Permissions"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
