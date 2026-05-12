import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithPassword } from '@/lib/authClient';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await loginWithPassword(email.trim(), password);
      if (r.requires2FA) {
        navigate('/auth/email-otp', {
          state: { userId: r.userId, email: email.trim() },
        });
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F4F0E8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
          padding: 28,
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: '#0069B4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 800,
              color: '#fff',
            }}
          >
            LX
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
              Luxlait Planification
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
              Connectez-vous à votre compte
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>
            Email
          </label>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              fontSize: 13,
              marginBottom: 14,
              fontFamily: 'IBM Plex Sans, sans-serif',
            }}
          />
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>
            Mot de passe
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              fontSize: 13,
              marginBottom: 18,
              fontFamily: 'IBM Plex Sans, sans-serif',
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: '#B91C1C', marginBottom: 12 }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={busy}
            style={{
              width: '100%',
              padding: '11px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#0069B4',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'IBM Plex Sans, sans-serif',
            }}
          >
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: 12,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontFamily: 'IBM Plex Sans, sans-serif',
            }}
          >
            Mot de passe oublié ?
          </button>
        </div>
      </div>
    </div>
  );
}
