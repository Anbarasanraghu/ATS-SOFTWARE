import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ShieldCheck, BarChart3, Boxes, Loader2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [slug, setSlug] = useState("demo");
  const [email, setEmail] = useState("admin@demo.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(slug, email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "mt-1.5 w-full rounded-lg glass px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:shadow-ring placeholder:text-muted/60";
  const labelCls = "text-xs font-semibold uppercase tracking-wide text-muted";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-accent to-accent-hover text-white">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/15 blur-3xl animate-glow-pulse" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-white/10 blur-3xl animate-glow-pulse" />

        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Sparkles size={22} />
          </div>
          <span className="text-lg font-bold font-display tracking-tight">ATS ERP</span>
        </div>

        <div className="relative space-y-6 max-w-md">
          <h1 className="text-4xl font-bold font-display leading-tight">
            Run your entire business from one premium workspace.
          </h1>
          <p className="text-white/80 leading-relaxed">
            Billing, inventory, CRM, HR and AI insights — unified, multi-tenant, and secure.
          </p>
          <div className="space-y-3 pt-2">
            {[
              { icon: BarChart3, label: "Real-time dashboards & reports" },
              { icon: Boxes, label: "Inventory, POS & barcode scanning" },
              { icon: ShieldCheck, label: "Role-based access & data isolation" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-sm text-white/90">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} />
                </div>
                {label}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} ATS ERP. All rights reserved.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-sm animate-fade-in-up">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white">
              <Sparkles size={20} />
            </div>
            <span className="text-lg font-bold font-display text-ink">ATS ERP</span>
          </div>

          <h2 className="text-2xl font-bold font-display text-ink">Welcome back</h2>
          <p className="text-sm text-muted mt-1 mb-8">Sign in to your workspace to continue.</p>

          <div className="space-y-4">
            <label className="block">
              <span className={labelCls}>Workspace</span>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputCls} placeholder="your-workspace" />
            </label>

            <label className="block">
              <span className={labelCls}>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputCls} />
            </label>

            <label className="block">
              <span className={labelCls}>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={inputCls} />
            </label>
          </div>

          {error && (
            <p className="mt-4 text-sm text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={busy}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent text-white py-2.5 font-semibold shadow-glow-violet hover:bg-accent-hover transition-colors disabled:opacity-60">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="mt-6 text-xs text-muted text-center">
            Need a workspace? Contact your administrator to get set up.
          </p>
        </form>
      </div>
    </div>
  );
}
