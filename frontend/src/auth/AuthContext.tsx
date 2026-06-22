import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, invalidateCompanyCache, type Me } from "../lib/api";

interface AuthState {
  me: Me | null;
  loading: boolean;
  login: (slug: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!getToken()) { setLoading(false); return; }
      try { setMe(await api.me()); }
      catch { setToken(null); }
      finally { setLoading(false); }
    }
    void load();

    function onExpired() { setMe(null); setToken(null); }
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  async function login(slug: string, email: string, password: string) {
    const { access_token } = await api.login(slug, email, password);
    setToken(access_token);
    setMe(await api.me());
  }

  function logout() {
    setToken(null);
    setMe(null);
    invalidateCompanyCache();
  }

  return (
    <AuthContext.Provider value={{ me, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}