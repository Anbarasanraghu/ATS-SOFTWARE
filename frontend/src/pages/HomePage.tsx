import { useAuth } from "../auth/AuthContext";

export default function HomePage() {
  const { me, logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface border border-line rounded-lg p-8 text-center space-y-3">
        <h1 className="text-xl font-semibold text-accent">You're in 🎉</h1>
        <p className="text-muted">Signed in as {me?.user.email}</p>
        <button onClick={logout}
          className="rounded-md border border-line px-4 py-2 hover:bg-line/50">
          Sign out
        </button>
      </div>
    </div>
  );
}