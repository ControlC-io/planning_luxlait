import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@shared/auth';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    // #region agent log
    fetch('http://127.0.0.1:7713/ingest/4d1c7866-0c93-4eea-be66-7eaca1b46d80',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin_frontend/src/pages/Login.tsx:13',message:'Login attempt started',data:{email},timestamp:Date.now(),runId:'run1',hypothesisId:'H1,H2,H4'})}).catch(()=>{});
    // #endregion
    try {
      const result = await login(email, password);
      // #region agent log
      fetch('http://127.0.0.1:7713/ingest/4d1c7866-0c93-4eea-be66-7eaca1b46d80',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin_frontend/src/pages/Login.tsx:20',message:'Login result received',data:{twoFactorRedirect:result?.twoFactorRedirect,emailOtpRequired:result?.emailOtpRequired,hasResult:!!result},timestamp:Date.now(),runId:'run1',hypothesisId:'H1,H2,H4'})}).catch(()=>{});
      // #endregion
      if (result?.twoFactorRedirect) {
        // #region agent log
        fetch('http://127.0.0.1:7713/ingest/4d1c7866-0c93-4eea-be66-7eaca1b46d80',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin_frontend/src/pages/Login.tsx:23',message:'2FA redirect detected but not handled',data:{email},timestamp:Date.now(),runId:'run1',hypothesisId:'H1,H3'})}).catch(()=>{});
        // #endregion
        sessionStorage.setItem('pending_2fa_email', email);
        navigate('/auth/2fa-challenge');
        return;
      }
      if (result?.emailOtpRequired) {
        // #region agent log
        fetch('http://127.0.0.1:7713/ingest/4d1c7866-0c93-4eea-be66-7eaca1b46d80',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin_frontend/src/pages/Login.tsx:30',message:'Email OTP required but not handled',data:{email},timestamp:Date.now(),runId:'run1',hypothesisId:'H2,H3'})}).catch(()=>{});
        // #endregion
        navigate('/auth/email-otp');
        return;
      }
      // #region agent log
      fetch('http://127.0.0.1:7713/ingest/4d1c7866-0c93-4eea-be66-7eaca1b46d80',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin_frontend/src/pages/Login.tsx:35',message:'Login successful, navigating to dashboard',data:{email},timestamp:Date.now(),runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      navigate('/dashboard');
    } catch (err: unknown) {
      // #region agent log
      fetch('http://127.0.0.1:7713/ingest/4d1c7866-0c93-4eea-be66-7eaca1b46d80',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin_frontend/src/pages/Login.tsx:38',message:'Login error caught',data:{error:err instanceof Error ? err.message : 'Unknown error',errorType:err?.constructor?.name},timestamp:Date.now(),runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-2xl p-6 space-y-4 shadow-xl">
          {error && (
            <div className="rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
