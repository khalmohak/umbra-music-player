import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ping, type SubsonicErrorBody } from "../subsonic";

export default function LoginPage() {
  const { creds, login } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (creds) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const p = await ping(user.trim(), pass);
      if (p.status !== "ok") {
        const fail = p as SubsonicErrorBody;
        setErr(
          fail.error?.message ??
            (typeof fail.error?.code === "number" ? `Error ${fail.error.code}` : "Authentication failed")
        );
        return;
      }
      login({ username: user.trim(), password: pass });
      navigate("/", { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-[400px] animate-fade-up">
        <header className="mb-8 text-center">
          <div className="mb-5 flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-accent/20 bg-accent/8 shadow-[0_0_32px_rgba(192,132,252,0.18)]">
              <svg className="size-8 text-accent" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text">
            Umbra
          </h1>
          <p className="mt-2 text-sm text-muted">Connect to your music library</p>
        </header>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]"
        >
          <div className="mb-4">
            <label
              htmlFor="login-user"
              className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-wider text-muted"
            >
              Username
            </label>
            <input
              id="login-user"
              autoComplete="username"
              className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text outline-none transition-all duration-150 placeholder:text-faint focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(192,132,252,0.14)]"
              placeholder="Navidrome user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="login-pass"
              className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-wider text-muted"
            >
              Password
            </label>
            <input
              id="login-pass"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text outline-none transition-all duration-150 placeholder:text-faint focus:border-accent/60 focus:shadow-[0_0_0_3px_rgba(192,132,252,0.14)]"
              placeholder="••••••••"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !user.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-deep shadow-[0_0_24px_rgba(192,132,252,0.22)] transition-all duration-150 enabled:hover:brightness-105 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && (
              <span
                className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-accent-deep/30 border-t-accent-deep"
                aria-hidden
              />
            )}
            {loading ? "Signing in…" : "Continue"}
          </button>

          {err && (
            <div
              className="mt-4 rounded-xl border border-danger/40 bg-danger-bg px-3 py-2.5 text-sm text-danger"
              role="alert"
            >
              {err}
            </div>
          )}

          <p className="mt-6 border-t border-border pt-5 text-xs leading-relaxed text-faint">
            Proxies <code className="font-mono text-[0.7rem] text-muted">/rest</code> to your Navidrome server.
            Override <code className="font-mono text-[0.7rem] text-muted">VITE_PROXY_TARGET</code> in{" "}
            <code className="font-mono text-[0.7rem] text-muted">.env</code>.
          </p>
        </form>
      </div>
    </div>
  );
}
