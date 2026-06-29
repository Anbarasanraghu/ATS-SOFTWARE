import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, Plus, Trash2, X, ArrowDownUp } from "lucide-react";
import { api, type Category, type FieldDef, type Product, type Supplier } from "../lib/api";
import DynamicFields from "../components/DynamicFields";
import { money } from "../lib/money";

type EditForm = {
  sku: string; barcode: string; name: string; price: string; cost_price: string;
  stock_qty: string; reorder_level: string; unit: string; tax_percent: string;
  category_id: string; supplier_id: string; custom: Record<string, unknown>;
};
const blankForm = (): EditForm => ({
  sku: "", barcode: "", name: "", price: "0", cost_price: "0",
  stock_qty: "0", reorder_level: "0", unit: "pcs", tax_percent: "0",
  category_id: "", supplier_id: "", custom: {},
});

type MoveForm = { movement_type: string; quantity: string; unit_cost: string; reference: string; notes: string };

const inputCls = "mt-1 w-full rounded-xl neu-inset px-3 py-2 text-sm outline-none focus:border-accent";

export default function ProductsPage() {
  const [products, setProducts]       = useState<Product[]>([]);
  const [defs, setDefs]               = useState<FieldDef[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [search, setSearch]           = useState("");
  const [showCreate, setShowCreate]   = useState(false);
  const [editing, setEditing]         = useState<Product | null>(null);
  const [form, setForm]               = useState<EditForm>(blankForm());
  const [movingProduct, setMovingProduct] = useState<Product | null>(null);
  const [moveForm, setMoveForm]       = useState<MoveForm>({ movement_type: "in", quantity: "1", unit_cost: "", reference: "", notes: "" });
  const [error, setError]             = useState<string | null>(null);
  const [tab, setTab]                 = useState<"products" | "categories" | "suppliers">("products");

  // Category/Supplier form state
  const [catName, setCatName]         = useState("");
  const [supForm, setSupForm]         = useState({ name: "", email: "", phone: "", contact_person: "" });

  async function refresh() {
    const [p, d, c, s] = await Promise.all([
      api.listProducts(), api.fieldDefinitions("product"),
      api.listCategories(), api.listSuppliers(),
    ]);
    setProducts(p); setDefs(d); setCategories(c); setSuppliers(s);
  }
  useEffect(() => { void refresh(); }, []);

  function openCreate() { setForm(blankForm()); setError(null); setShowCreate(true); }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      sku: p.sku ?? "", barcode: p.barcode ?? "", name: p.name, price: String(p.price),
      cost_price: String(p.cost_price), stock_qty: String(p.stock_qty),
      reorder_level: String(p.reorder_level), unit: p.unit,
      tax_percent: String(p.tax_percent),
      category_id: p.category_id ?? "", supplier_id: p.supplier_id ?? "",
      custom: { ...p.custom_fields },
    });
    setError(null);
  }
  function closeModal() { setShowCreate(false); setEditing(null); setMovingProduct(null); setError(null); }

  function buildPayload(f: EditForm) {
    return {
      sku: f.sku || null, barcode: f.barcode || null, name: f.name, unit: f.unit,
      price: Number(f.price), cost_price: Number(f.cost_price),
      tax_percent: Number(f.tax_percent), stock_qty: Number(f.stock_qty),
      reorder_level: Number(f.reorder_level),
      category_id: f.category_id || null, supplier_id: f.supplier_id || null,
      custom_fields: f.custom,
    };
  }

  async function submitCreate(e: { preventDefault(): void }) {
    e.preventDefault(); setError(null);
    try { await api.createProduct(buildPayload(form)); closeModal(); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  async function submitEdit(e: { preventDefault(): void }) {
    e.preventDefault(); if (!editing) return; setError(null);
    try { await api.updateProduct(editing.id, buildPayload(form)); closeModal(); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }
  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    try { await api.deleteProduct(id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
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
      closeModal(); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  async function addCategory(e: { preventDefault(): void }) {
    e.preventDefault();
    try { await api.createCategory({ name: catName }); setCatName(""); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }
  async function deleteCategory(id: string) {
    if (!confirm("Delete category?")) return;
    try { await api.deleteCategory(id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }
  async function addSupplier(e: { preventDefault(): void }) {
    e.preventDefault();
    try { await api.createSupplier({ ...supForm }); setSupForm({ name: "", email: "", phone: "", contact_person: "" }); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }
  async function deleteSupplier(id: string) {
    if (!confirm("Delete supplier?")) return;
    try { await api.deleteSupplier(id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const productForm = (isEdit: boolean) => (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form onSubmit={isEdit ? submitEdit : submitCreate}
        className="neu rounded-2xl p-6 w-full max-w-xl space-y-4 shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{isEdit ? "Edit Product" : "New Product"}</h2>
          <button type="button" onClick={closeModal} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Name *</span>
            <input className={inputCls} value={form.name} required onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">SKU</span>
            <input className={inputCls} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Barcode</span>
            <input className={inputCls} value={form.barcode} placeholder="e.g. 6901234567890"
              onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Unit</span>
            <input className={inputCls} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Sale Price</span>
            <input type="number" step="0.01" className={inputCls} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Cost Price</span>
            <input type="number" step="0.01" className={inputCls} value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Stock Qty</span>
            <input type="number" step="0.001" className={inputCls} value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Reorder Level</span>
            <input type="number" step="0.001" className={inputCls} value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Tax %</span>
            <input type="number" step="0.01" className={inputCls} value={form.tax_percent} onChange={(e) => setForm({ ...form, tax_percent: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Category</span>
            <select className={inputCls} value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Supplier</span>
            <select className={inputCls} value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">— None —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
        <DynamicFields defs={defs} values={form.custom}
          onChange={(k, v) => setForm((f) => ({ ...f, custom: { ...f.custom, [k]: v } }))} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={closeModal} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium">{isEdit ? "Save changes" : "Create product"}</button>
        </div>
      </form>
    </div>
  );

  const moveModal = movingProduct && (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form onSubmit={submitMove} className="neu rounded-2xl p-6 w-full max-w-md space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Stock Movement — {movingProduct.name}</h2>
          <button type="button" onClick={closeModal} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Type</span>
            <select className={inputCls} value={moveForm.movement_type} onChange={(e) => setMoveForm({ ...moveForm, movement_type: e.target.value })}>
              <option value="in">Stock In</option>
              <option value="out">Stock Out</option>
              <option value="adjustment">Adjustment (set to)</option>
              <option value="return">Return</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Quantity *</span>
            <input type="number" step="0.001" min="0.001" required className={inputCls} value={moveForm.quantity}
              onChange={(e) => setMoveForm({ ...moveForm, quantity: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Unit Cost</span>
            <input type="number" step="0.01" className={inputCls} value={moveForm.unit_cost}
              onChange={(e) => setMoveForm({ ...moveForm, unit_cost: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Reference</span>
            <input className={inputCls} value={moveForm.reference}
              onChange={(e) => setMoveForm({ ...moveForm, reference: e.target.value })} />
          </label>
          <label className="block col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Notes</span>
            <input className={inputCls} value={moveForm.notes}
              onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })} />
          </label>
        </div>
        <div className="text-xs text-muted">Current stock: <span className="font-semibold">{movingProduct.stock_qty} {movingProduct.unit}</span></div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={closeModal} className="px-4 py-2 text-sm rounded-md border border-line hover:bg-line/50">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm rounded-md bg-accent text-white font-medium">Record</button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="neu-scene p-5 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Inventory</h1>
        <div className="flex border border-line rounded-md overflow-hidden text-sm ml-2">
          {(["products", "categories", "suppliers"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 capitalize ${tab === t ? "bg-accent text-white" : "hover:bg-line/50"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {tab === "products" && (
            <>
              <input className="rounded-xl neu-inset px-3 py-2 text-sm outline-none focus:border-accent w-48"
                placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button onClick={openCreate}
                className="flex items-center gap-2 rounded-md bg-accent text-white px-4 py-2 text-sm font-medium">
                <Plus size={16} /> New Product
              </button>
            </>
          )}
        </div>
      </div>

      {/* Products tab */}
      {tab === "products" && (
        <div className="neu rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted">No products yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Name / SKU</th>
                  <th className="px-4 py-3">Barcode</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const cat = categories.find((c) => c.id === p.category_id);
                  return (
                    <tr key={p.id} className="border-b border-line/60 last:border-0 hover:bg-paper/60">
                      <td className="px-4 py-3">
                        <div className="font-medium flex items-center gap-2">
                          {p.name}
                          {p.is_low_stock && <span title="Low stock"><AlertTriangle size={13} className="text-amber-500" /></span>}
                        </div>
                        <div className="text-xs text-muted">{p.sku ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{p.barcode ?? "—"}</td>
                      <td className="px-4 py-3 text-muted text-xs">{cat?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">{money(p.price)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted">{money(p.cost_price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={p.is_low_stock ? "text-amber-600 font-semibold" : ""}>
                          {p.stock_qty} {p.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => { setMovingProduct(p); setMoveForm({ movement_type: "in", quantity: "1", unit_cost: "", reference: "", notes: "" }); setError(null); }}
                            className="text-muted hover:text-accent" title="Stock movement">
                            <ArrowDownUp size={14} />
                          </button>
                          <button onClick={() => openEdit(p)} className="text-muted hover:text-accent" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="text-muted hover:text-danger" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Categories tab */}
      {tab === "categories" && (
        <div className="space-y-4">
          <form onSubmit={addCategory} className="flex gap-2">
            <input className="rounded-xl neu-inset px-3 py-2 text-sm outline-none focus:border-accent flex-1"
              placeholder="Category name…" value={catName} onChange={(e) => setCatName(e.target.value)} required />
            <button type="submit" className="rounded-md bg-accent text-white px-4 py-2 text-sm font-medium flex items-center gap-1">
              <Plus size={14} /> Add
            </button>
          </form>
          <div className="neu rounded-2xl divide-y divide-line">
            {categories.length === 0 && <p className="px-4 py-3 text-sm text-muted">No categories yet.</p>}
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium">{c.name}</span>
                <button onClick={() => deleteCategory(c.id)} className="text-muted hover:text-danger"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suppliers tab */}
      {tab === "suppliers" && (
        <div className="space-y-4">
          <form onSubmit={addSupplier} className="neu rounded-2xl p-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Name *</span>
              <input required className={inputCls} value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Contact Person</span>
              <input className={inputCls} value={supForm.contact_person} onChange={(e) => setSupForm({ ...supForm, contact_person: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Email</span>
              <input type="email" className={inputCls} value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Phone</span>
              <input className={inputCls} value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} />
            </label>
            <div className="col-span-2 flex justify-end">
              <button type="submit" className="rounded-md bg-accent text-white px-4 py-2 text-sm font-medium flex items-center gap-1">
                <Plus size={14} /> Add Supplier
              </button>
            </div>
          </form>
          <div className="neu rounded-2xl divide-y divide-line">
            {suppliers.length === 0 && <p className="px-4 py-3 text-sm text-muted">No suppliers yet.</p>}
            {suppliers.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted">{s.contact_person} {s.email ? `· ${s.email}` : ""} {s.phone ? `· ${s.phone}` : ""}</div>
                </div>
                <button onClick={() => deleteSupplier(s.id)} className="text-muted hover:text-danger"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && productForm(false)}
      {editing && productForm(true)}
      {moveModal}
    </div>
  );
}
