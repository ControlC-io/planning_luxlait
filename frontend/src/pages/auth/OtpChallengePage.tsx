import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDemoMode } from '@/context/DemoModeContext';
import { verifyEmailOtp } from '@/lib/authClient';

type OtpChallengePageProps = {
  title?: string;
  subtitle?: string;
};

export default function OtpChallengePage({
  title = 'Code de vérification',
  subtitle = 'Saisissez le code à 6 chiffres envoyé par email.',
}: OtpChallengePageProps) {
  const navigate = useNavigate();
  const { withDemo } = useDemoMode();
  const location = useLocation();
  const state = location.state as { userId?: string; email?: string } | undefined;
  const userId = state?.userId;
  const emailForResend = state?.email;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const onResend = async () => {
    if (!emailForResend?.trim()) return;
    setResendBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/request-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: emailForResend.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Impossible de renvoyer le code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setResendBusy(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) {
      navigate(withDemo('/login'));
      return;
    }
    setError('');
    setBusy(true);
    try {
      await verifyEmailOtp(userId, code.trim());
      navigate(withDemo('/'));
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
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 18 }}>
          {subtitle}
        </div>
        <form onSubmit={onSubmit}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              fontSize: 22,
              letterSpacing: '0.3em',
              textAlign: 'center',
              marginBottom: 14,
              fontFamily: 'IBM Plex Sans, monospace',
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: '#B91C1C', marginBottom: 12 }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
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
            }}
          >
            {busy ? 'Vérification…' : 'Vérifier'}
          </button>
          {emailForResend && (
            <button
              type="button"
              onClick={() => void onResend()}
              disabled={resendBusy}
              style={{
                marginTop: 14,
                width: '100%',
                background: 'none',
                border: 'none',
                color: '#0069B4',
                fontSize: 13,
                cursor: resendBusy ? 'wait' : 'pointer',
                textDecoration: 'underline',
              }}
            >
              {resendBusy ? 'Envoi…' : 'Renvoyer le code'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
