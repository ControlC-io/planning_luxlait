import { useAuthStore } from '@/lib/api';

export async function loginWithPassword(email: string, password: string) {
  const res = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as {
    token?: string;
    expiresIn?: string;
    user?: {
      id: string;
      email: string;
      name: string | null;
      roles: string[];
    };
    requires2FA?: boolean;
    userId?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Connexion impossible');
  }
  if (data.requires2FA && data.userId) {
    return { requires2FA: true as const, userId: data.userId };
  }
  if (data.token && data.user) {
    useAuthStore.getState().setSession(data.token, data.user);
    return { requires2FA: false as const };
  }
  throw new Error('Réponse inattendue du serveur');
}

export async function verifyEmailOtp(userId: string, code: string) {
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userId, code }),
  });
  const data = (await res.json()) as {
    token?: string;
    user?: {
      id: string;
      email: string;
      name: string | null;
      roles: string[];
    };
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Code invalide');
  }
  if (data.token && data.user) {
    useAuthStore.getState().setSession(data.token, data.user);
    return;
  }
  throw new Error('Réponse inattendue');
}
