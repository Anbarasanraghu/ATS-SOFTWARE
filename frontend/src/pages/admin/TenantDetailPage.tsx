import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type AdminTenant } from "../../lib/api";

type Mod = { module_id: string; code: string; name: string; category: string; enabled: boolean };
type FieldDef = { id: string; field_key: string; label: string; data_type: string; is_required: boolean };

const ENTITIES = ["product", "customer", "employee", "invoice"];

export default function TenantDetailPage() {
  const { id = "" } = useParams();
  const [mods, setMods] = useState<Mod[]>([]);
  const [entity, setEntity] = useState("product");
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [f, setF] = useState({ field_key: "", label: "", data_type: "text", is_required: false });
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<AdminTenant | null>(null);
  const [seats, setSeats] = useState<number>(1);
  const [savingSeats, setSavingSeats] = useState(false);

  async function loadMods() { setMods(await api.adminTenantModules(id)); }
  async function loadFields(ent = entity) { setFields(await api.adminFields(id, ent)); }
  async function loadTenant() {
    const t = (await api.adminTenants()).find((x) => x.id === id) ?? null;
    setTenant(t);
    if (t) setSeats(t.max_users);
  }

  async function saveSeats() {
    setSavingSeats(true);
    try {
      const updated = await api.adminUpdateTenant(id, { max_users: Math.max(1, seats) });
      setTenant(updated);
      setSeats(updated.max_users);
    } finally { setSavingSeats(false); }
  }

  useEffect(() => { void loadMods(); void loadTenant(); }, [id]);
  useEffect(() => { void loadFields(entity); }, [id, entity]);

  async function toggle(module_id: string, enabled: boolean) {
    await api.adminToggleModule(id, module_id, enabled);
    await loadMods();
  }

  async function addField(e: { preventDefault(): void }) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.adminAddField(id, { entity, ...f, options: [] });
      setF({ field_key: "", label: "", data_type: "text", is_required: false });
      await loadFields();
    } finally { setSaving(false); }
  }

  const inputCls = "rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Configure tenant{tenant ? ` — ${tenant.name}` : ""}</h1>

      {/* Seats & billing */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Seats &amp; billing</h2>
        <div className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-end gap-6">
          <div>
            <div className="text-xs text-muted">Active users</div>
            <div className="text-lg font-bold">{tenant?.active_users ?? "—"} / {tenant?.max_users ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Revenue / month</div>
            <div className="text-lg font-bold">${(tenant?.monthly_total ?? 0).toLocaleString()}</div>
            <div className="text-[11px] text-muted">${tenant?.price_per_user ?? 100}/user</div>
          </div>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Paid seats</span>
            <input type="number" min={1} value={seats}
              onChange={(e) => setSeats(parseInt(e.target.value) || 1)}
              className="mt-1 w-28 rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
          </label>
          <button onClick={saveSeats} disabled={savingSeats}
            className="rounded-md bg-accent text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
            {savingSeats ? "Saving…" : "Update seats"}
          </button>
        </div>
      </section>

      {/* Modules */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Modules</h2>
        <div className="bg-surface border border-line rounded-lg divide-y divide-line">
          {mods.length === 0 && <p className="px-4 py-3 text-sm text-muted">No modules found.</p>}
          {mods.map((m) => (
            <label key={m.module_id} className="flex items-center justify-between px-4 py-3 text-sm cursor-pointer hover:bg-paper/60">
              <span>
                {m.name}{" "}
                <span className="text-xs text-muted">({m.category})</span>
              </span>
              <input type="checkbox" className="h-4 w-4" checked={m.enabled}
                onChange={(e) => toggle(m.module_id, e.target.checked)} />
            </label>
          ))}
        </div>
      </section>

      {/* Custom fields */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Custom fields</h2>
          <select className={inputCls} value={entity}
            onChange={(e) => setEntity(e.target.value)}>
            {ENTITIES.map((ent) => (
              <option key={ent} value={ent}>{ent}</option>
            ))}
          </select>
        </div>

        <div className="bg-surface border border-line rounded-lg divide-y divide-line">
          {fields.length === 0 && <p className="px-4 py-3 text-sm text-muted">No custom fields for {entity} yet.</p>}
          {fields.map((d) => (
            <div key={d.id} className="px-4 py-3 text-sm flex items-center gap-2">
              <span className="font-medium">{d.label}</span>
              <span className="text-muted">— {d.data_type}</span>
              {d.is_required && <span className="text-xs text-danger">required</span>}
              <span className="ml-auto text-xs text-muted font-mono">[{d.field_key}]</span>
            </div>
          ))}
        </div>

        <form onSubmit={addField}
          className="flex flex-wrap gap-2 items-end bg-surface border border-line rounded-lg p-4">
          <input className={inputCls} placeholder="key (e.g. brand)" value={f.field_key}
            onChange={(e) => setF({ ...f, field_key: e.target.value })} required />
          <input className={inputCls} placeholder="Label" value={f.label}
            onChange={(e) => setF({ ...f, label: e.target.value })} required />
          <select className={inputCls} value={f.data_type}
            onChange={(e) => setF({ ...f, data_type: e.target.value })}>
            <option value="text">text</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="date">date</option>
            <option value="select">select</option>
            <option value="multiselect">multiselect</option>
          </select>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={f.is_required}
              onChange={(e) => setF({ ...f, is_required: e.target.checked })} /> required
          </label>
          <button disabled={saving}
            className="rounded-md bg-accent text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
            Add field
          </button>
        </form>
      </section>
    </div>
  );
}
