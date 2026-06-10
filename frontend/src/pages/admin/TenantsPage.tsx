import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string; vertical: string }[]>([]);
  useEffect(() => { void api.adminTenants().then(setTenants); }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Tenants</h1>
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Name</th><th className="px-4 py-3">Slug</th>
            <th className="px-4 py-3">Vertical</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3">{t.name}</td>
                <td className="px-4 py-3 text-muted">{t.slug}</td>
                <td className="px-4 py-3">{t.vertical}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/admin/tenants/${t.id}`} className="text-accent hover:underline">Configure →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}