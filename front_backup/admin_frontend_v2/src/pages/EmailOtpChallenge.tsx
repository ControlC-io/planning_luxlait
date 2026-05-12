import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@shared/auth';

const PENDING_OTP_KEY = 'pending_email_otp_user_id';

const EmailOtpChallenge = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { verifyEmailOtp, checkSession } = useAuth();
  const navigate = useNavigate();

  const userId = sessionStorage.getItem(PENDING_OTP_KEY);

  useEffect(() => {
    if (!userId) {
      navigate('/login');
    }
  }, [userId, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setError('');
    setLoading(true);

    try {
      // #region agent log
      fetch('http://127.0.0.1:7713/ingest/4d1c7866-0c93-4eea-be66-7eaca1b46d80', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'admin_frontend/src/pages/EmailOtpChallenge.tsx:30',
          message: 'EmailOtpChallenge handleSubmit start',
          data: {},
          timestamp: Date.now(),
          runId: 'postfix1',
          hypothesisId: 'F3'
        })
      }).catch(() => {});
      // #endregion
      await verifyEmailOtp(userId, code);
      sessionStorage.removeItem('pending_2fa_email');
      await checkSession(true);
      // #region agent log
      fetch('http://127.0.0.1:7713/ingest/4d1c7866-0c93-4eea-be66-7eaca1b46d80', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'admin_frontend/src/pages/EmailOtpChallenge.tsx:39',
          message: 'EmailOtpChallenge verification done, navigating',
          data: {},
          timestamp: Date.now(),
          runId: 'postfix1',
          hypothesisId: 'F3,F2'
        })
      }).catch(() => {});
      // #endregion
      navigate('/dashboard');
    } catch (err: unknown) {
      // #region agent log
      fetch('http://127.0.0.1:7713/ingest/4d1c7866-0c93-4eea-be66-7eaca1b46d80', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'admin_frontend/src/pages/EmailOtpChallenge.tsx:47',
          message: 'EmailOtpChallenge verification error',
          data: { error: err instanceof Error ? err.message : 'Unknown error' },
          timestamp: Date.now(),
          runId: 'postfix1',
          hypothesisId: 'F3'
        })
      }).catch(() => {});
      // #endregion
      setError(err instanceof Error ? err.message : 'Invalid verification code');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-800 rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
            <p className="text-gray-400">
              We sent a 6-digit verification code to your email address. It expires in 10 minutes.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-1.5">
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                autoFocus
                className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-2xl tracking-widest"
                placeholder="000000"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-gray-400 hover:text-gray-300"
            >
              ← Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailOtpChallenge;
