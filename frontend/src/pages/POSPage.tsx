import { useEffect, useRef, useState } from "react";
import { Trash2, Plus, Minus, ShoppingCart, Barcode, CheckCircle, RotateCcw } from "lucide-react";
import { api, type Customer, type Product } from "../lib/api";

type CartItem = {
  product: Product;
  qty: number;
};

type CheckoutState = "idle" | "loading" | "done";

const METHODS = ["cash", "card", "bank_transfer", "other"];

export default function POSPage() {
  const scanRef = useRef<HTMLInputElement>(null);
  const [cart, setCart]             = useState<CartItem[]>([]);
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [scanInput, setScanInput]   = useState("");
  const [scanError, setScanError]   = useState<string | null>(null);
  const [scanning, setScanning]     = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("Walk-in");
  const [method, setMethod]         = useState("cash");
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [lastInvoice, setLastInvoice] = useState<{ number: string; total: number } | null>(null);

  useEffect(() => {
    api.listCustomers().then(setCustomers).catch(() => {});
    // Auto-focus scanner input on mount
    scanRef.current?.focus();
  }, []);

  // Re-focus scanner after any interaction
  function refocus() {
    setTimeout(() => scanRef.current?.focus(), 100);
  }

  async function handleScan(e: { preventDefault(): void }) {
    e.preventDefault();
    const code = scanInput.trim();
    if (!code) return;
    setScanInput("");
    setScanError(null);
    setScanning(true);
    try {
      const product = await api.scanProduct(code);
      addToCart(product);
    } catch {
      setScanError(`"${code}" not found — check the barcode or SKU`);
    } finally {
      setScanning(false);
      refocus();
    }
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  }

  function setQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
    } else {
      setCart((prev) =>
        prev.map((i) => i.product.id === productId ? { ...i, qty } : i),
      );
    }
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
    refocus();
  }

  function pickCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    setCustomerId(id);
    setCustomerName(c?.name ?? "Walk-in");
    refocus();
  }

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.qty, 0);
  const taxTotal = cart.reduce(
    (s, i) => s + i.product.price * i.qty * i.product.tax_percent / 100, 0,
  );
  const total = subtotal + taxTotal;

  async function checkout() {
    if (cart.length === 0) return;
    setCheckoutState("loading");
    try {
      const today = new Date().toISOString().slice(0, 10);
      const invoice = await api.createInvoice({
        customer_id: customerId || null,
        customer_name: customerName || "Walk-in",
        issue_date: today,
        notes: `POS sale — ${method}`,
        items: cart.map((i) => ({
          product_id: i.product.id,
          description: i.product.name,
          quantity: i.qty,
          unit_price: i.product.price,
          tax_percent: i.product.tax_percent,
        })),
      });
      // Record immediate payment
      await api.recordPayment(invoice.id, {
        amount: invoice.total,
        payment_date: today,
        method,
      });
      setLastInvoice({ number: invoice.invoice_number, total: invoice.total });
      setCheckoutState("done");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Checkout failed");
      setCheckoutState("idle");
    }
  }

  function newSale() {
    setCart([]);
    setCustomerId("");
    setCustomerName("Walk-in");
    setMethod("cash");
    setCheckoutState("idle");
    setLastInvoice(null);
    setScanError(null);
    refocus();
  }

  // ── Done screen ──────────────────────────────────────────
  if (checkoutState === "done" && lastInvoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6 text-center">
        <div className="rounded-full bg-emerald-100 p-6">
          <CheckCircle size={48} className="text-emerald-600" />
        </div>
        <div>
          <div className="text-2xl font-bold text-emerald-700">Payment Received</div>
          <div className="text-muted mt-1">{lastInvoice.number}</div>
          <div className="text-4xl font-bold mt-3 font-mono">
            ${Number(lastInvoice.total).toFixed(2)}
          </div>
        </div>
        <button onClick={newSale}
          className="flex items-center gap-2 rounded-lg bg-accent text-white px-8 py-3 text-lg font-semibold">
          <RotateCcw size={20} /> New Sale
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">

      {/* ── Left: scanner + product search ── */}
      <div className="flex flex-col gap-4 w-80 flex-shrink-0">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ShoppingCart size={20} /> Point of Sale
        </h1>

        {/* Scanner input */}
        <form onSubmit={handleScan} className="space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wide text-muted">
            Scan Barcode / Enter SKU
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Barcode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={scanRef}
                autoFocus
                className="w-full rounded-lg border-2 border-accent bg-paper pl-9 pr-3 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="Scan or type code…"
                value={scanInput}
                onChange={(e) => { setScanInput(e.target.value); setScanError(null); }}
                disabled={scanning}
              />
            </div>
            <button type="submit"
              className="rounded-lg bg-accent text-white px-3 py-2 font-medium text-sm disabled:opacity-50"
              disabled={scanning || !scanInput.trim()}>
              {scanning ? "…" : "Add"}
            </button>
          </div>
          {scanError && (
            <p className="text-xs text-danger bg-red-50 rounded-md px-3 py-2">{scanError}</p>
          )}
          <p className="text-xs text-muted">
            USB/Bluetooth scanner sends barcode + Enter automatically.
          </p>
        </form>

        {/* Quick product list */}
        <div className="flex-1 overflow-y-auto space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted mb-2">
            All products (click to add)
          </div>
          <QuickList onAdd={addToCart} />
        </div>
      </div>

      {/* ── Right: cart + checkout ── */}
      <div className="flex-1 flex flex-col bg-surface border border-line rounded-xl overflow-hidden">

        {/* Cart header */}
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <span className="font-semibold">
            Cart <span className="text-muted font-normal text-sm">({cart.length} items)</span>
          </span>
          {cart.length > 0 && (
            <button onClick={() => { setCart([]); refocus(); }}
              className="text-xs text-muted hover:text-danger">
              Clear all
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto divide-y divide-line">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted space-y-3 py-12">
              <Barcode size={40} className="opacity-30" />
              <p className="text-sm">Scan a product to start</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.product.name}</div>
                  <div className="text-xs text-muted">
                    {item.product.sku ?? item.product.barcode ?? "—"} · ${item.product.price.toFixed(2)} each
                    {item.product.tax_percent > 0 && ` + ${item.product.tax_percent}% tax`}
                  </div>
                </div>
                {/* Qty controls */}
                <div className="flex items-center gap-1">
                  <button onClick={() => setQty(item.product.id, item.qty - 1)}
                    className="rounded-md border border-line w-7 h-7 flex items-center justify-center hover:bg-line/50 text-muted">
                    <Minus size={12} />
                  </button>
                  <input
                    type="number" min="1" step="1"
                    className="w-12 text-center border border-line rounded-md py-1 text-sm outline-none focus:border-accent bg-paper"
                    value={item.qty}
                    onChange={(e) => setQty(item.product.id, Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                  />
                  <button onClick={() => setQty(item.product.id, item.qty + 1)}
                    className="rounded-md border border-line w-7 h-7 flex items-center justify-center hover:bg-line/50 text-muted">
                    <Plus size={12} />
                  </button>
                </div>
                {/* Line total */}
                <div className="w-20 text-right font-mono text-sm font-semibold">
                  ${(item.product.price * item.qty).toFixed(2)}
                </div>
                <button onClick={() => removeItem(item.product.id)}
                  className="text-muted hover:text-danger ml-1">
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Checkout panel */}
        <div className="border-t border-line px-5 py-4 space-y-3 bg-paper/60">
          {/* Customer + payment method */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Customer</span>
              <select
                className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
                value={customerId}
                onChange={(e) => pickCustomer(e.target.value)}>
                <option value="">Walk-in customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Payment Method</span>
              <select
                className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
                value={method}
                onChange={(e) => { setMethod(e.target.value); refocus(); }}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m.replace("_", " ")}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Totals */}
          <div className="flex justify-between items-end">
            <div className="space-y-0.5 text-sm">
              <div className="flex gap-8 text-muted">
                <span>Subtotal</span>
                <span className="font-mono">${subtotal.toFixed(2)}</span>
              </div>
              {taxTotal > 0 && (
                <div className="flex gap-8 text-muted">
                  <span>Tax</span>
                  <span className="font-mono">${taxTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex gap-8 font-bold text-lg pt-1 border-t border-line">
                <span>Total</span>
                <span className="font-mono">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Charge button */}
            <button
              disabled={cart.length === 0 || checkoutState === "loading"}
              onClick={checkout}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-8 py-4 text-lg font-bold transition-colors">
              {checkoutState === "loading" ? "Processing…" : `Charge $${total.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quick product picker list ────────────────────────────────
function QuickList({ onAdd }: { onAdd: (p: Product) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch]     = useState("");

  useEffect(() => { api.listProducts().then(setProducts).catch(() => {}); }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <input
        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-xs outline-none focus:border-accent"
        placeholder="Search products…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {filtered.map((p) => (
          <button key={p.id} onClick={() => onAdd(p)}
            className="w-full text-left rounded-lg border border-line px-3 py-2 text-xs hover:bg-accent/5 hover:border-accent/40 transition-colors">
            <div className="font-medium truncate">{p.name}</div>
            <div className="text-muted flex items-center justify-between mt-0.5">
              <span>{p.barcode ?? p.sku ?? "—"}</span>
              <span className="font-mono font-semibold text-ink">${p.price.toFixed(2)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
