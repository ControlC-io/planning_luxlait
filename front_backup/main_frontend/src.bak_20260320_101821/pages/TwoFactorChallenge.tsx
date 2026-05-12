import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@shared/auth';

const PENDING_OTP_KEY = 'pending_email_otp_user_id';
const PENDING_2FA_EMAIL_KEY = 'pending_2fa_email';

const TwoFactorChallenge = () => {
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [showBackupCode, setShowBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const { verify2FALogin, checkSession } = useAuth();
  const navigate = useNavigate();

  // Note: During 2FA challenge, user may not be fully authenticated yet
  // Better Auth maintains a temporary session for 2FA verification
  // So we don't redirect if user is null - the backend will handle the session

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // verify2FALogin sets user state via flushSync — navigate is safe immediately after.
      await verify2FALogin(code, trustDevice);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleUseEmailCode = async () => {
    const email = sessionStorage.getItem(PENDING_2FA_EMAIL_KEY);
    if (!email) {
      setError('Email not found. Please go back and sign in again.');
      return;
    }
    setError('');
    setEmailOtpSending(true);
    try {
      const res = await fetch('/api/auth/request-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      let data: { error?: string; userId?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        setError(data?.error || 'Could not send email code. Use authenticator or backup code.');
        return;
      }
      if (data?.userId) {
        sessionStorage.setItem(PENDING_OTP_KEY, data.userId);
        sessionStorage.removeItem(PENDING_2FA_EMAIL_KEY);
        navigate('/auth/email-otp');
      }
    } catch {
      setError('Could not send email code. Try again or use authenticator.');
    } finally {
      setEmailOtpSending(false);
    }
  };

  const handleVerifyBackupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/two-factor/verify-backup-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          code: backupCode,
          trustDevice 
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Invalid backup code');
      }

      // checkSession(true) uses flushSync so user state is committed before navigate().
      await checkSession(true);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid backup code');
      setBackupCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Two-Factor Authentication</h1>
            <p className="text-gray-600">
              {showBackupCode 
                ? 'Enter one of your backup codes'
                : 'Enter the 6-digit code from your authenticator app'}
            </p>
          </div>

          {!showBackupCode ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                  Verification Code
                </label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                  placeholder="000000"
                />
              </div>

              <div className="flex items-center">
                <input
                  id="trustDevice"
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="trustDevice" className="ml-2 block text-sm text-gray-700">
                  Trust this device for 30 days
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>

              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={() => setShowBackupCode(true)}
                  className="block w-full text-sm text-blue-600 hover:text-blue-700"
                >
                  Use a backup code instead
                </button>
                <button
                  type="button"
                  onClick={handleUseEmailCode}
                  disabled={emailOtpSending}
                  className="block w-full text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {emailOtpSending ? 'Sending...' : 'Send code to my email instead'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyBackupCode} className="space-y-4">
              <div>
                <label htmlFor="backupCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Backup Code
                </label>
                <input
                  id="backupCode"
                  type="text"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono"
                  placeholder="Enter backup code"
                />
              </div>

              <div className="flex items-center">
                <input
                  id="trustDeviceBackup"
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="trustDeviceBackup" className="ml-2 block text-sm text-gray-700">
                  Trust this device for 30 days
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !backupCode}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify Backup Code'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowBackupCode(false);
                    setBackupCode('');
                    setError('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Use authenticator code instead
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                sessionStorage.removeItem(PENDING_2FA_EMAIL_KEY);
                navigate('/login');
              }}
              className="text-sm text-gray-600 hover:text-gray-700"
            >
              Back to login
            </button>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-gray-600">
          <p>This page will timeout after 5 minutes for security.</p>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorChallenge;
