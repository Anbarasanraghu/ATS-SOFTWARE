import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDownUp, Download, Plus, Trash2, X } from "lucide-react";
import { api, type Category, type FieldDef, type Product, type Supplier } from "../lib/api";

const inputCls = "w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";
const NUMERIC = ["price", "cost_price", "stock_qty", "reorder_level", "tax_percent"];

// ── A single inline-editable text/number cell ────────────────
function EditableCell({
  value, type = "text", align = "left", onSave,
  render,
}: {
  value: string | number | null;
  type?: "text" | "number" | "date";
  align?: "left" | "right";
  onSave: (raw: string) => void;
  render?: (v: string | number | null) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const skip = useRef(false);

  function commit() {
    if (skip.current) { skip.current = false; setEditing(false); return; }
    setEditing(false);
    if (draft !== String(value ?? "")) onSave(draft);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        step={type === "number" ? "0.01" : undefined}
        className={`w-full rounded border border-accent bg-paper px-2 py-1 text-sm outline-none ${align === "right" ? "text-right" : ""}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") { skip.current = true; e.currentTarget.blur(); }
        }}
      />
    );
  }
  return (
    <div
      className={`cursor-text px-2 py-1 rounded hover:bg-accent-soft/40 min-h-[28px] ${align === "right" ? "text-right" : ""}`}
      title="Click to edit"
      onClick={() => { setDraft(value == null ? "" : String(value)); setEditing(true); }}
    >
      {render ? render(value) : (value === "" || value == null ? <span className="text-muted">—</span> : value)}
    </div>
  );
}

// ── A select cell (category / supplier / custom select) ──────
function SelectCell({
  value, options, onSave,
}: {
  value: string;
  options: { id: string; label: string }[];
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const current = options.find((o) => o.id === value);
  if (editing) {
    return (
      <select
        autoFocus
        className="w-full rounded border border-accent bg-paper px-1 py-1 text-sm outline-none"
        value={value}
        onChange={(e) => { onSave(e.target.value); setEditing(false); }}
        onBlur={() => setEditing(false)}
      >
        <option value="">— None —</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  }
  return (
    <div className="cursor-pointer px-2 py-1 rounded hover:bg-accent-soft/40 min-h-[28px] text-xs text-muted"
      title="Click to change" onClick={() => setEditing(true)}>
      {current ? current.label : <span className="text-muted">—</span>}
    </div>
  );
}

type MoveForm = { movement_type: string; quantity: string; unit_cost: string; reference: string; notes: string };
const blankMove = (): MoveForm => ({ movement_type: "in", quantity: "1", unit_cost: "", reference: "", notes: "" });

export default function InventoryPage() {
  const [products, setProducts]     = useState<Product[]>([]);
  const [defs, setDefs]             = useState<FieldDef[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [error, setError]           = useState<string | null>(null);
  const [tab, setTab]               = useState<"items" | "categories" | "suppliers">("items");

  // new-row form (full row incl. custom fields)
  type NewRow = {
    name: string; sku: string; barcode: string; category_id: string; supplier_id: string;
    unit: string; price: string; cost_price: string; stock_qty: string; reorder_level: string;
    custom: Record<string, unknown>;
  };
  const blankNew = (): NewRow => ({
    name: "", sku: "", barcode: "", category_id: "", supplier_id: "",
    unit: "pcs", price: "0", cost_price: "0", stock_qty: "0", reorder_level: "0", custom: {},
  });
  const [nr, setNr] = useState<NewRow>(blankNew());
  const [adding, setAdding] = useState(false);

  // stock movement modal
  const [movingProduct, setMovingProduct] = useState<Product | null>(null);
  const [moveForm, setMoveForm] = useState<MoveForm>(blankMove());

  // category / supplier forms
  const [catName, setCatName] = useState("");
  const [supForm, setSupForm] = useState({ name: "", email: "", phone: "", contact_person: "" });

  async function refresh() {
    const [p, d, c, s] = await Promise.all([
      api.listProducts(), api.fieldDefinitions("product"),
      api.listCategories(), api.listSuppliers(),
    ]);
    setProducts(p); setDefs(d); setCategories(c); setSuppliers(s);
  }
  useEffect(() => { void refresh(); }, []);

  // ── inline patch of a core column ──────────────────────────
  async function patchField(id: string, field: string, raw: string) {
    setError(null);
    let value: unknown = raw;
    if (NUMERIC.includes(field)) value = raw === "" ? 0 : Number(raw);
    else if (field === "sku" || field === "barcode") value = raw.trim() || null;
    else if (field === "name" && raw.trim() === "") return; // name can't be blank
    try {
      const updated = await api.patchProduct(id, { [field]: value });
      setProducts((ps) => ps.map((p) => (p.id === id ? updated : p)));
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
  }

  async function patchCustom(p: Product, key: string, raw: string | boolean) {
    setError(null);
    const def = defs.find((d) => d.field_key === key);
    let v: unknown = raw;
    if (def?.data_type === "number") v = raw === "" ? null : Number(raw);
    else if (def?.data_type === "boolean") v = Boolean(raw);
    const custom_fields = { ...p.custom_fields, [key]: v };
    if (v === null || v === "") delete (custom_fields as Record<string, unknown>)[key];
    try {
      const updated = await api.patchProduct(p.id, { custom_fields });
      setProducts((ps) => ps.map((x) => (x.id === p.id ? updated : x)));
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
  }

  async function addRow(e: { preventDefault(): void }) {
    e.preventDefault(); setError(null);
    if (!nr.name.trim()) { setError("Enter a product name."); return; }
    setAdding(true);
    try {
      await api.createProduct({
        name: nr.name.trim(), sku: nr.sku.trim() || null, barcode: nr.barcode.trim() || null,
        unit: nr.unit || "pcs",
        price: Number(nr.price) || 0, cost_price: Number(nr.cost_price) || 0,
        stock_qty: Number(nr.stock_qty) || 0, reorder_level: Number(nr.reorder_level) || 0,
        category_id: nr.category_id || null, supplier_id: nr.supplier_id || null,
        custom_fields: nr.custom,
      });
      setNr(blankNew());
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to add"); }
    finally { setAdding(false); }
  }

  function setNewCustom(key: string, value: unknown) {
    setNr((r) => ({ ...r, custom: { ...r.custom, [key]: value } }));
  }

  async function deleteOne(id: string) {
    if (!confirm("Delete this item?")) return;
    try { await api.deleteProduct(id); await refresh(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected item(s)?`)) return;
    try {
      await api.bulkDeleteProducts([...selected]);
      setSelected(new Set());
      await refresh();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function submitMove(e: { preventDefault(): void }) {
    e.preventDefault(); if (!movingProduct) return; setError(null);
    try {
      await api.createStockMovement({
        product_id: movingProduct.id, movement_type: moveForm.movement_type,
        quantity: Number(moveForm.quantity),
        unit_cost: moveForm.unit_cost ? Number(moveForm.unit_cost) : null,
        reference: moveForm.reference || null, notes: moveForm.notes || null,
      });
      setMovingProduct(null); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  async function addCategory(e: { preventDefault(): void }) {
    e.preventDefault();
    try { await api.createCategory({ name: catName }); setCatName(""); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }
  async function addSupplier(e: { preventDefault(): void }) {
    e.preventDefault();
    try { await api.createSupplier({ ...supForm }); setSupForm({ name: "", email: "", phone: "", contact_person: "" }); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((s) => s.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id)));
  }

  function exportCsv() {
    const cols = ["name", "sku", "barcode", "unit", "price", "cost_price", "tax_percent", "stock_qty", "reorder_level"];
    const head = [...cols, "category", "supplier", ...defs.map((d) => d.label)];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(",")];
    for (const p of filtered) {
      const cat = categories.find((c) => c.id === p.category_id)?.name ?? "";
      const sup = suppliers.find((s) => s.id === p.supplier_id)?.name ?? "";
      const row = [
        ...cols.map((c) => (p as unknown as Record<string, unknown>)[c]),
        cat, sup, ...defs.map((d) => p.custom_fields[d.field_key]),
      ];
      lines.push(row.map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const catOpts = categories.map((c) => ({ id: c.id, label: c.name }));
  const supOpts = suppliers.map((s) => ({ id: s.id, label: s.name }));
  const num = (v: string | number | null) => Number(v ?? 0).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Inventory</h1>
        <div className="flex border border-line rounded-md overflow-hidden text-sm">
          {(["items", "categories", "suppliers"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 capitalize ${tab === t ? "bg-accent text-white" : "hover:bg-line/50"}`}>{t}</button>
          ))}
        </div>
        {tab === "items" && (
          <div className="ml-auto flex items-center gap-2">
            <input className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent w-48"
              placeholder="Search name / SKU / barcode…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {selected.size > 0 && (
              <button onClick={deleteSelected}
                className="flex items-center gap-1 rounded-md bg-danger/10 text-danger border border-danger/30 px-3 py-2 text-sm font-medium">
                <Trash2 size={15} /> Delete {selected.size}
              </button>
            )}
            <button onClick={exportCsv}
              className="flex items-center gap-1 rounded-md border border-line px-3 py-2 text-sm hover:bg-line/50">
              <Download size={15} /> CSV
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {tab === "items" && (
        <div className="bg-surface border border-line rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} />
                </th>
                <th className="px-2 py-3">Name</th>
                <th className="px-2 py-3">SKU</th>
                <th className="px-2 py-3">Barcode</th>
                <th className="px-2 py-3">Category</th>
                <th className="px-2 py-3">Supplier</th>
                <th className="px-2 py-3">Unit</th>
                <th className="px-2 py-3 text-right">Price</th>
                <th className="px-2 py-3 text-right">Cost</th>
                <th className="px-2 py-3 text-right">Stock</th>
                <th className="px-2 py-3 text-right">Reorder</th>
                {defs.map((d) => <th key={d.field_key} className="px-2 py-3">{d.label}</th>)}
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={`border-b border-line/60 last:border-0 ${selected.has(p.id) ? "bg-accent-soft/30" : "hover:bg-paper/60"}`}>
                  <td className="px-3 py-1 align-middle">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  </td>
                  <td className="px-1 py-1 font-medium min-w-[160px]">
                    <div className="flex items-center gap-1">
                      <EditableCell value={p.name} onSave={(v) => patchField(p.id, "name", v)} />
                      {p.is_low_stock && <AlertTriangle size={13} className="text-amber-500 shrink-0" />}
                    </div>
                  </td>
                  <td className="px-1 py-1"><EditableCell value={p.sku} onSave={(v) => patchField(p.id, "sku", v)} /></td>
                  <td className="px-1 py-1 font-mono text-xs"><EditableCell value={p.barcode} onSave={(v) => patchField(p.id, "barcode", v)} /></td>
                  <td className="px-1 py-1 min-w-[120px]"><SelectCell value={p.category_id ?? ""} options={catOpts} onSave={(v) => patchField(p.id, "category_id", v)} /></td>
                  <td className="px-1 py-1 min-w-[120px]"><SelectCell value={p.supplier_id ?? ""} options={supOpts} onSave={(v) => patchField(p.id, "supplier_id", v)} /></td>
                  <td className="px-1 py-1 w-16"><EditableCell value={p.unit} onSave={(v) => patchField(p.id, "unit", v)} /></td>
                  <td className="px-1 py-1 text-right font-mono"><EditableCell value={p.price} type="number" align="right" render={num} onSave={(v) => patchField(p.id, "price", v)} /></td>
                  <td className="px-1 py-1 text-right font-mono text-muted"><EditableCell value={p.cost_price} type="number" align="right" render={num} onSave={(v) => patchField(p.id, "cost_price", v)} /></td>
                  <td className="px-1 py-1 text-right font-mono">
                    <EditableCell value={p.stock_qty} type="number" align="right"
                      render={(v) => <span className={p.is_low_stock ? "text-amber-600 font-semibold" : ""}>{v}</span>}
                      onSave={(v) => patchField(p.id, "stock_qty", v)} />
                  </td>
                  <td className="px-1 py-1 text-right font-mono text-muted"><EditableCell value={p.reorder_level} type="number" align="right" onSave={(v) => patchField(p.id, "reorder_level", v)} /></td>
                  {defs.map((d) => {
                    const cur = p.custom_fields[d.field_key];
                    if (d.data_type === "select") {
                      const opts = (d.options || []).map((o) => typeof o === "string" ? { id: o, label: o } : { id: o.value, label: o.label ?? o.value });
                      return <td key={d.field_key} className="px-1 py-1"><SelectCell value={cur == null ? "" : String(cur)} options={opts} onSave={(v) => patchCustom(p, d.field_key, v)} /></td>;
                    }
                    if (d.data_type === "boolean") {
                      return <td key={d.field_key} className="px-2 py-1"><input type="checkbox" checked={Boolean(cur)} onChange={(e) => patchCustom(p, d.field_key, e.target.checked)} /></td>;
                    }
                    return <td key={d.field_key} className="px-1 py-1"><EditableCell value={cur == null ? "" : String(cur)} type={d.data_type === "number" ? "number" : d.data_type === "date" ? "date" : "text"} onSave={(v) => patchCustom(p, d.field_key, v)} /></td>;
                  })}
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => { setMovingProduct(p); setMoveForm(blankMove()); setError(null); }} className="text-muted hover:text-accent" title="Stock movement"><ArrowDownUp size={14} /></button>
                      <button onClick={() => deleteOne(p.id)} className="text-muted hover:text-danger" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {/* add-row — mirrors every column, incl. custom fields */}
              <tr className="bg-paper/50 align-top">
                <td className="px-3 py-2"><Plus size={14} className="text-accent" /></td>
                <td className="px-1 py-2"><input className={inputCls} placeholder="New item name…" value={nr.name}
                  onChange={(e) => setNr({ ...nr, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") addRow(e); }} /></td>
                <td className="px-1 py-2"><input className={inputCls} placeholder="SKU" value={nr.sku} onChange={(e) => setNr({ ...nr, sku: e.target.value })} /></td>
                <td className="px-1 py-2"><input className={inputCls} placeholder="Barcode" value={nr.barcode} onChange={(e) => setNr({ ...nr, barcode: e.target.value })} /></td>
                <td className="px-1 py-2">
                  <select className={inputCls} value={nr.category_id} onChange={(e) => setNr({ ...nr, category_id: e.target.value })}>
                    <option value="">Category…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className="px-1 py-2">
                  <select className={inputCls} value={nr.supplier_id} onChange={(e) => setNr({ ...nr, supplier_id: e.target.value })}>
                    <option value="">Supplier…</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </td>
                <td className="px-1 py-2"><input className={inputCls} value={nr.unit} onChange={(e) => setNr({ ...nr, unit: e.target.value })} /></td>
                <td className="px-1 py-2"><input type="number" className={`${inputCls} text-right`} placeholder="Price" value={nr.price} onChange={(e) => setNr({ ...nr, price: e.target.value })} /></td>
                <td className="px-1 py-2"><input type="number" className={`${inputCls} text-right`} placeholder="Cost" value={nr.cost_price} onChange={(e) => setNr({ ...nr, cost_price: e.target.value })} /></td>
                <td className="px-1 py-2"><input type="number" className={`${inputCls} text-right`} placeholder="Stock" value={nr.stock_qty} onChange={(e) => setNr({ ...nr, stock_qty: e.target.value })} /></td>
                <td className="px-1 py-2"><input type="number" className={`${inputCls} text-right`} placeholder="Reorder" value={nr.reorder_level} onChange={(e) => setNr({ ...nr, reorder_level: e.target.value })} /></td>
                {defs.map((d) => {
                  const cur = nr.custom[d.field_key];
                  if (d.data_type === "select") {
                    const opts = (d.options || []).map((o) => typeof o === "string" ? { id: o, label: o } : { id: o.value, label: o.label ?? o.value });
                    return (
                      <td key={d.field_key} className="px-1 py-2">
                        <select className={inputCls} value={cur == null ? "" : String(cur)} onChange={(e) => setNewCustom(d.field_key, e.target.value)}>
                          <option value="">{d.label}{d.is_required ? " *" : ""}…</option>
                          {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                      </td>
                    );
                  }
                  if (d.data_type === "boolean") {
                    return <td key={d.field_key} className="px-2 py-2"><input type="checkbox" checked={Boolean(cur)} onChange={(e) => setNewCustom(d.field_key, e.target.checked)} /></td>;
                  }
                  return (
                    <td key={d.field_key} className="px-1 py-2">
                      <input type={d.data_type === "number" ? "number" : d.data_type === "date" ? "date" : "text"}
                        className={inputCls} placeholder={`${d.label}${d.is_required ? " *" : ""}`}
                        value={cur == null ? "" : String(cur)} onChange={(e) => setNewCustom(d.field_key, e.target.value)} />
                    </td>
                  );
                })}
                <td className="px-2 py-2">
                  <button onClick={addRow} disabled={adding} className="rounded-md bg-accent text-white px-3 py-2 text-sm font-medium flex items-center gap-1 disabled:opacity-50"><Plus size={14} /> {adding ? "…" : "Add"}</button>
                </td>
              </tr>
            </tbody>
          </table>
          {filtered.length === 0 && <p className="px-4 py-3 text-sm text-muted">No items yet — add one in the row above.</p>}
        </div>
      )}

      {tab === "categories" && (
        <div className="space-y-4">
          <form onSubmit={addCategory} className="flex gap-2">
            <input className={`${inputCls} flex-1`} placeholder="Category name…" value={catName} onChange={(e) => setCatName(e.target.value)} required />
            <button type="submit" className="rounded-md bg-accent text-white px-4 py-2 text-sm font-medium flex items-center gap-1"><Plus size={14} /> Add</button>
          </form>
          <div className="bg-surface border border-line rounded-lg divide-y divide-line">
            {categories.length === 0 && <p className="px-4 py-3 text-sm text-muted">No categories yet.</p>}
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium">{c.name}</span>
                <button onClick={async () => { if (confirm("Delete category?")) { await api.deleteCategory(c.id); await refresh(); } }} className="text-muted hover:text-danger"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "suppliers" && (
        <div className="space-y-4">
          <form onSubmit={addSupplier} className="bg-surface border border-line rounded-lg p-4 grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Name *</span>
              <input required className={`${inputCls} mt-1`} value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} /></label>
            <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Contact Person</span>
              <input className={`${inputCls} mt-1`} value={supForm.contact_person} onChange={(e) => setSupForm({ ...supForm, contact_person: e.target.value })} /></label>
            <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Email</span>
              <input type="email" className={`${inputCls} mt-1`} value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} /></label>
            <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Phone</span>
              <input className={`${inputCls} mt-1`} value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} /></label>
            <div className="col-span-2 flex justify-end">
              <button type="submit" className="rounded-md bg-accent text-white px-4 py-2 text-sm font-medium flex items-center gap-1"><Plus size={14} /> Add Supplier</button>
            </div>
          </form>
          <div className="bg-surface border border-line rounded-lg divide-y divide-line">
            {suppliers.length === 0 && <p className="px-4 py-3 text-sm text-muted">No suppliers yet.</p>}
            {suppliers.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div><div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted">{s.contact_person} {s.email ? `· ${s.email}` : ""} {s.phone ? `· ${s.phone}` : ""}</div></div>
                <button onClick={async () => { if (confirm("Delete supplier?")) { await api.deleteSupplier(s.id); await refresh(); } }} className="text-muted hover:text-danger"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {movingProduct && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <form onSubmit={submitMove} className="bg-surface border border-line rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Stock Movement — {movingProduct.name}</h2>
              <button type="button" onClick={() => setMovingProduct(null)} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Type</span>
                <select className={`${inputCls} mt-1`} value={moveForm.movement_type} onChange={(e) => setMoveForm({ ...moveForm, movement_type: e.target.value })}>
                  <option value="in">Stock In</option><option value="out">Stock Out</option>
                  <option value="adjustment">Adjustment (set to)</option><option value="return">Return</option>
                </select></label>
              <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Quantity *</span>
                <input type="number" step="0.001" min="0.001" required className={`${inputCls} mt-1`} value={moveForm.quantity} onChange={(e) => setMoveForm({ ...moveForm, quantity: e.target.value })} /></label>
              <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Unit Cost</span>
                <input type="number" step="0.01" className={`${inputCls} mt-1`} value={moveForm.unit_cost} onChange={(e) => setMoveForm({ ...moveForm, unit_cost: e.target.value })} /></label>
              <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-muted">Reference</span>
                <input className={`${inputCls} mt-1`} value={moveForm.reference} onChange={(e) => setMoveForm({ ...moveForm, reference: e.target.value })} /></label>
              <label className="block col-span-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">Notes</span>
                <input className={`${inputCls} mt-1`} value={moveForm.notes} onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })} /></label>
            </div>
            <div className="text-xs text-muted">Current stock: <span className="font-semibold">{movingProduct.stock_qty} {movingProduct.unit}</span></div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setMovingProduct(null)} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium">Record</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
