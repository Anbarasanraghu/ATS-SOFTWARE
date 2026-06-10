import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-surface border border-line rounded-lg p-8 space-y-4">
        <h1 className="text-xl font-semibold text-accent">Sign in</h1>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Workspace</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 outline-none focus:border-accent" />
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 outline-none focus:border-accent" />
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 outline-none focus:border-accent" />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button type="submit" disabled={busy}
          className="w-full rounded-md bg-accent text-white py-2 font-medium disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
