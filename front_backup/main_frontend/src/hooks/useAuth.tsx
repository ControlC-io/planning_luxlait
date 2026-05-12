import { useState, useEffect, createContext, useContext, ReactNode } from "react";

type AppUser = { id: string; email: string; name?: string | null; roles?: string[] };
type AppRole = "admin" | "manager" | "viewer";

interface AuthContextType {
  user: AppUser | null;
  session: null;
  loading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  isManager: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const JWT_STORAGE_KEY = "myrtest_jwt_token";

function decodeJwtPayload(token: string): unknown | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadPart = parts[1];
    // base64url to base64
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + "=".repeat(padLength);
    const json = atob(padded);
    // JSON parse expects UTF 8, and atob gives a latin1 string; this conversion keeps non ASCII safe
    const utf8 = decodeURIComponent(
      Array.from(json)
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(utf8);
  } catch {
    return null;
  }
}

function deriveAppRoleFromRoles(roles: string[] | undefined | null): AppRole {
  const rolesLower = (roles ?? []).map((r) => String(r).toLowerCase());
  if (rolesLower.some((r) => r.includes("admin"))) return "admin";
  if (rolesLower.some((r) => r.includes("manager"))) return "manager";
  return "viewer";
}

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function deriveNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "User";
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0]?.toUpperCase() + s.slice(1))
    .join(" ");
}

async function fetchJwtFromSession(): Promise<string | null> {
  const res = await fetch("/api/auth/jwt-from-session", { credentials: "include" });
  if (!res.ok) return null;
  const data = await safeJson<{ token?: string }>(res);
  return data?.token ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/auth/get-session", { credentials: "include" });
        const data = await safeJson<{ user?: AppUser }>(res);
        if (res.ok && data?.user) {
          setUser(data.user);

          const token = localStorage.getItem(JWT_STORAGE_KEY);
          const jwtToken = token ?? (await fetchJwtFromSession());
          if (jwtToken) localStorage.setItem(JWT_STORAGE_KEY, jwtToken);

          const decoded = jwtToken ? decodeJwtPayload(jwtToken) : null;
          const jwtRoles = (decoded as any)?.roles as string[] | undefined;

          // No need for strict RBAC yet; only used to gate admin routes.
          const appRole = deriveAppRoleFromRoles(jwtRoles ?? data.user.roles);
          setRole(appRole);
        } else {
          setUser(null);
          setRole(null);
          localStorage.removeItem(JWT_STORAGE_KEY);
        }
      } catch {
        setUser(null);
        setRole(null);
        localStorage.removeItem(JWT_STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await safeJson<{ user?: AppUser; twoFactorRedirect?: boolean }>(res);
      if (!res.ok) {
        return { error: new Error(data ? (data as any).error || "Sign in failed" : "Sign in failed") };
      }

      if (data?.user) {
        const jwtToken = await fetchJwtFromSession();
        if (!jwtToken) {
          return { error: new Error("Failed to obtain JWT for API calls") };
        }
        localStorage.setItem(JWT_STORAGE_KEY, jwtToken);
        setUser(data.user);

        const decoded = decodeJwtPayload(jwtToken);
        const jwtRoles = (decoded as any)?.roles as string[] | undefined;
        const appRole = deriveAppRoleFromRoles(jwtRoles ?? data.user.roles);
        setRole(appRole);
      }

      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error("Sign in failed") };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: deriveNameFromEmail(email), email, password }),
      });

      const data = await safeJson<{ user?: AppUser }>(res);
      if (!res.ok) {
        return { error: new Error((data as any)?.error || "Sign up failed") };
      }

      if (data?.user) {
        const jwtToken = await fetchJwtFromSession();
        if (!jwtToken) {
          return { error: new Error("Failed to obtain JWT for API calls") };
        }
        localStorage.setItem(JWT_STORAGE_KEY, jwtToken);
        setUser(data.user);

        const decoded = decodeJwtPayload(jwtToken);
        const jwtRoles = (decoded as any)?.roles as string[] | undefined;
        const appRole = deriveAppRoleFromRoles(jwtRoles ?? data.user.roles);
        setRole(appRole);
      }

      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error("Sign up failed") };
    }
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
      setRole(null);
      localStorage.removeItem(JWT_STORAGE_KEY);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session: null,
        loading,
        role,
        isAdmin: role === "admin",
        isManager: role === "manager",
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
