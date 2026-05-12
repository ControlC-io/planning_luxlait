import { create } from 'zustand';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
};

const TOKEN_KEY = 'luxlait_jwt';
const USER_KEY = 'luxlait_user';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  setSession: (token: string, user: AuthUser) => void;
  logout: () => void;
  initialize: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  loading: true,
  setSession: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },
  initialize: () => {
    const t = localStorage.getItem(TOKEN_KEY);
    const u = localStorage.getItem(USER_KEY);
    if (t && u) {
      try {
        set({ token: t, user: JSON.parse(u) as AuthUser });
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    set({ loading: false });
  },
}));

let sessionExpiredRedirecting = false;

/**
 * Clears the session and sends the user to the login page (invalid or expired JWT).
 * Safe to call from multiple parallel 401 responses.
 */
export function redirectToLoginOnSessionExpired(): void {
  if (sessionExpiredRedirecting) return;
  if (typeof window === 'undefined') return;
  sessionExpiredRedirecting = true;
  useAuthStore.getState().logout();
  const pathname = window.location.pathname;
  const loginPath =
    pathname === '/demo' || pathname.startsWith('/demo/') ? '/demo/login' : '/login';
  window.location.replace(loginPath);
}
