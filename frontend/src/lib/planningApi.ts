import { redirectToLoginOnSessionExpired, useAuthStore } from '@/lib/api';

export async function planningFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(`/api/planning${path}`, { ...init, headers });
  if (res.status === 401) {
    redirectToLoginOnSessionExpired();
  }
  return res;
}

export async function planningJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await planningFetch(path, init);
  if (res.status === 401) {
    return new Promise(() => {}) as Promise<T>;
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
