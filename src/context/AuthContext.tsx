import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "audio-listener-auth";

export type Credentials = { username: string; password: string };

type AuthContextValue = {
  creds: Credentials | null;
  login: (c: Credentials) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStored(): Credentials | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Credentials>;
    if (
      typeof p.username === "string" &&
      typeof p.password === "string" &&
      p.username.length > 0
    ) {
      return { username: p.username, password: p.password };
    }
  } catch {
    return null;
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [creds, setCreds] = useState<Credentials | null>(() => readStored());

  const login = useCallback((c: Credentials) => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ username: c.username, password: c.password })
    );
    setCreds(c);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setCreds(null);
  }, []);

  const value = useMemo(
    () => ({ creds, login, logout }),
    [creds, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
