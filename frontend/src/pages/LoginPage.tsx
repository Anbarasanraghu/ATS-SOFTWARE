import { useState, type FormEvent, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, Building2, Mail, Lock, Eye, EyeOff,
  ArrowRight, Loader2, Headphones, ChevronRight,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

// ── Decorative mini SVG charts (left panel only) ──────────────

function MiniLineChart() {
  return (
    <svg viewBox="0 0 140 60" width="138" height="54" aria-hidden="true" style={{ display: "block" }}>
      <defs>
        <linearGradient id="llg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points="5,56 22,42 40,49 62,27 82,34 102,16 134,10 134,58 5,58" fill="url(#llg)" />
      <polyline points="5,56 22,42 40,49 62,27 82,34 102,16 134,10"
        fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="134" cy="10" r="4" fill="#6366F1" />
      <circle cx="134" cy="10" r="8" fill="#6366F1" fillOpacity="0.12" />
    </svg>
  );
}

function MiniPieChart() {
  return (
    <svg viewBox="0 0 80 80" width="64" height="64" aria-hidden="true" style={{ display: "block" }}>
      <path d="M40,40 L40,8 A32,32 0 0,1 67.7,56 Z" fill="#6366F1" />
      <path d="M40,40 L67.7,56 A32,32 0 0,1 12.3,57 Z" fill="#A5B4FC" />
      <path d="M40,40 L12.3,57 A32,32 0 0,1 40,8 Z" fill="#E0E7FF" />
      <circle cx="40" cy="40" r="13" fill="white" />
    </svg>
  );
}

function MiniBarChart() {
  const bars = [
    { x: 4,  h: 20, o: 0.42 },
    { x: 21, h: 36, o: 0.62 },
    { x: 38, h: 48, o: 0.9  },
    { x: 55, h: 30, o: 0.55 },
    { x: 72, h: 42, o: 0.75 },
  ];
  return (
    <svg viewBox="0 0 90 52" width="82" height="48" aria-hidden="true" style={{ display: "block" }}>
      {bars.map(({ x, h, o }) => (
        <rect key={x} x={x} y={52 - h} width="13" height={h} rx="3" fill="#6366F1" opacity={o} />
      ))}
    </svg>
  );
}

function DashboardMockup() {
  const sidebar = ["Dashboard", "Projects", "HR & Payroll", "Finance", "Inventory", "Reports", "Settings"];
  return (
    <div style={{ width: 200, borderRadius: 10, overflow: "hidden", background: "#F8F9FF", border: "1px solid rgba(99,102,241,0.08)", fontSize: 7, lineHeight: 1.4 }}>
      <div style={{ background: "white", padding: "5px 8px", display: "flex", alignItems: "center", gap: 4, borderBottom: "1px solid #ECEDF3" }}>
        <div style={{ width: 12, height: 12, borderRadius: 3, background: "#6366F1" }} />
        <span style={{ fontWeight: 700, color: "#1B1B2F", fontSize: 8 }}>ATS ERP</span>
      </div>
      <div style={{ display: "flex" }}>
        <div style={{ width: 44, background: "white", padding: "6px 4px", borderRight: "1px solid #ECEDF3" }}>
          {sidebar.map((item, i) => (
            <div key={item} style={{ padding: "3px 4px", borderRadius: 3, marginBottom: 2, background: i === 0 ? "#EEF2FF" : "transparent", color: i === 0 ? "#6366F1" : "#8A8AA0", fontSize: 6, fontWeight: i === 0 ? 700 : 400 }}>{item}</div>
          ))}
        </div>
        <div style={{ flex: 1, padding: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 8, color: "#1B1B2F", marginBottom: 4 }}>Dashboard</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginBottom: 4 }}>
            {[{ l: "Total Projects", v: "24", d: "+12%" }, { l: "Active Users", v: "128", d: "+8%" }].map(s => (
              <div key={s.l} style={{ background: "white", borderRadius: 4, padding: "4px 5px" }}>
                <div style={{ color: "#8A8AA0", fontSize: 5.5 }}>{s.l}</div>
                <div style={{ fontWeight: 800, fontSize: 11, color: "#1B1B2F" }}>{s.v}</div>
                <div style={{ color: "#10B981", fontSize: 5.5 }}>{s.d}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "white", borderRadius: 4, padding: "4px 5px" }}>
            <div style={{ fontSize: 7, fontWeight: 600, color: "#1B1B2F", marginBottom: 2 }}>Revenue Overview</div>
            <svg viewBox="0 0 110 28" width="100%" height="26" style={{ display: "block" }}>
              <polyline points="0,24 20,16 40,20 60,8 80,12 100,4 110,2"
                fill="none" stroke="#6366F1" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ marginTop: 3 }}>
            <div style={{ fontSize: 6.5, fontWeight: 600, color: "#1B1B2F", marginBottom: 2 }}>Recent Activities</div>
            <div style={{ background: "white", borderRadius: 4, padding: "3px 5px", display: "flex", gap: 4, alignItems: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "#E0E7FF", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 6, fontWeight: 600, color: "#1B1B2F" }}>Purchase order #PO-2431</div>
                <div style={{ fontSize: 5.5, color: "#8A8AA0" }}>Created by Admin</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Login Page ───────────────────────────────────────────

export default function LoginPage() {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const [slug, setSlug]           = useState("demo");
  const [email, setEmail]         = useState("admin@demo.com");
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [busy, setBusy]           = useState(false);
  const [showPw, setShowPw]       = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

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

  // ── Shared style objects ──
  const pageBg: CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #E6EBF8 0%, #EEF2FC 55%, #F0F4FF 100%)",
  };

  const floatCardBase: CSSProperties = {
    background: "white",
    borderRadius: 20,
    boxShadow: "8px 8px 22px #C5CFDF, -5px -5px 14px rgba(255,255,255,0.9)",
    padding: "14px 16px",
    position: "absolute",
  };

  const iconBox: CSSProperties = {
    width: 44, height: 44, borderRadius: 12,
    background: "linear-gradient(135deg, #4338CA, #6366F1)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "white",
    boxShadow: "4px 4px 12px rgba(99,102,241,0.35), -2px -2px 6px rgba(255,255,255,0.6)",
  };

  return (
    <div style={pageBg}>
      <div className="min-h-screen lg:grid lg:grid-cols-2">

        {/* ── LEFT PANEL — brand & decorative ── */}
        <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden">

          {/* Subtle background blobs */}
          <div style={{ position: "absolute", top: -80, right: -80, width: 340, height: 340, borderRadius: "50%", background: "rgba(99,102,241,0.07)", filter: "blur(60px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -60, left: -40, width: 280, height: 280, borderRadius: "50%", background: "rgba(129,140,248,0.08)", filter: "blur(50px)", pointerEvents: "none" }} />

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg, #312E81, #4338CA)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", boxShadow: "4px 4px 12px rgba(67,56,202,0.30)" }}>
              <Sparkles size={19} />
            </div>
            <span className="text-lg font-bold text-[#1B1B2F] font-display tracking-tight">ATS ERP</span>
          </div>

          {/* Heading + description + floating cards */}
          <div className="relative z-10 max-w-lg">
            <h1 className="text-[2.1rem] font-bold text-[#1B1B2F] leading-snug mb-4 font-display">
              All your operations.<br />One intelligent system.
            </h1>
            <p className="text-[#41415C] text-sm leading-relaxed mb-10 max-w-sm">
              ATS ERP helps teams streamline workflows, manage resources, and make smarter business decisions.
            </p>

            {/* Floating cards container */}
            <div className="relative" style={{ height: 300 }}>

              {/* Dashboard mockup — center, slightly faded */}
              <div className="animate-float-d" style={{ ...floatCardBase, top: 40, left: 60, padding: 0, opacity: 0.72, overflow: "hidden" }}>
                <DashboardMockup />
              </div>

              {/* Pie chart — bottom left */}
              <div className="animate-float-a" style={{ ...floatCardBase, bottom: 10, left: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#8A8AA0", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>Users</p>
                <MiniPieChart />
              </div>

              {/* Line chart — top right */}
              <div className="animate-float-b" style={{ ...floatCardBase, top: 0, right: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#8A8AA0", letterSpacing: "0.06em", textTransform: "uppercase" }}>Revenue</p>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#6366F1" }}>+18%</span>
                </div>
                <MiniLineChart />
              </div>

              {/* Bar chart — bottom right */}
              <div className="animate-float-c" style={{ ...floatCardBase, bottom: 20, right: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#8A8AA0", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>Orders</p>
                <MiniBarChart />
              </div>

            </div>
          </div>

          {/* Copyright */}
          <p className="relative z-10 text-xs text-[#8A8AA0]">
            © {new Date().getFullYear()} ATS ERP. All rights reserved.
          </p>
        </div>

        {/* ── RIGHT PANEL — login form ── */}
        <div className="flex items-center justify-center p-6 sm:p-10 min-h-screen lg:min-h-0">
          <div
            className="w-full animate-fade-in-up"
            style={{
              maxWidth: 440,
              background: "white",
              borderRadius: 30,
              boxShadow: "24px 24px 56px #C5CFDF, -10px -10px 26px rgba(255,255,255,0.9)",
              padding: "40px 36px",
            }}
          >
            {/* Logo — centered */}
            <div className="flex flex-col items-center gap-2 mb-7">
              <div style={iconBox}>
                <Sparkles size={20} />
              </div>
              <span className="text-sm font-bold text-[#1B1B2F] font-display tracking-tight">ATS ERP</span>
            </div>

            {/* Heading */}
            <h2 className="text-[1.75rem] font-bold font-display text-[#1B1B2F] text-center leading-tight">
              Welcome back
            </h2>
            <p className="text-sm text-[#8A8AA0] text-center mt-1.5 mb-8">
              Sign in to your workspace to continue
            </p>

            {/* Form */}
            <form onSubmit={submit} className="space-y-4">

              {/* Workspace */}
              <div>
                <label htmlFor="login-slug" className="block text-xs font-semibold text-[#41415C] mb-1.5">
                  Workspace
                </label>
                <div className="login-input-wrap">
                  <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8AA0]" style={{ pointerEvents: "none" }} />
                  <input
                    id="login-slug"
                    className="login-input"
                    placeholder="your-workspace"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    autoComplete="organization"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-[#41415C] mb-1.5">
                  Email
                </label>
                <div className="login-input-wrap">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8AA0]" style={{ pointerEvents: "none" }} />
                  <input
                    id="login-email"
                    type="email"
                    className="login-input"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-[#41415C] mb-1.5">
                  Password
                </label>
                <div className="login-input-wrap">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8AA0]" style={{ pointerEvents: "none" }} />
                  <input
                    id="login-password"
                    type={showPw ? "text" : "password"}
                    className="login-input"
                    style={{ paddingRight: 44 }}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A8AA0] hover:text-[#41415C] transition-colors"
                    tabIndex={-1}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember me + Forgot */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 text-sm text-[#41415C] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                  />
                  Remember me
                </label>
                <button type="button" className="text-sm text-indigo-500 font-medium hover:text-indigo-700 transition-colors">
                  Forgot password?
                </button>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
                  {error}
                </p>
              )}

              {/* Sign in button */}
              <button type="submit" disabled={busy} className="login-btn mt-2">
                {busy
                  ? <><Loader2 size={16} className="animate-spin" /> Signing in…</>
                  : <><span>Sign in</span><ArrowRight size={17} /></>
                }
              </button>

            </form>

            {/* Support card */}
            <div className="mt-6 text-center">
              <p className="text-xs text-[#8A8AA0] mb-2.5">Need a workspace?</p>
              <div className="login-support-card">
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Headphones size={16} style={{ color: "#6366F1" }} />
                </div>
                <span className="text-sm text-[#41415C] font-medium flex-1 text-left">
                  Contact your administrator to get set up
                </span>
                <ChevronRight size={16} style={{ color: "#8A8AA0", flexShrink: 0 }} />
              </div>
            </div>

            {/* Developer credit */}
            <p className="mt-5 text-center text-[10px] text-[#C8C8D8] tracking-wide">
              Developed by <span className="font-semibold">AGZUS TECHNOLOGY SOLUTION</span>
            </p>

          </div>
        </div>

      </div>
    </div>
  );
}
