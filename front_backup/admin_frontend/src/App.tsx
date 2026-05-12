import { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@shared/auth';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import TwoFactorChallenge from './pages/TwoFactorChallenge';
import EmailOtpChallenge from './pages/EmailOtpChallenge';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-gray-900 text-white px-6 py-3 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight">MyRTest</span>
          <span className="text-gray-500 text-sm font-medium uppercase tracking-widest hidden sm:inline">
            Admin Panel
          </span>
        </div>

        {user && (
          <div ref={profileRef} className="relative flex items-center gap-3">
            <span className="text-sm text-gray-300 truncate max-w-[160px] sm:max-w-[220px]" title={user.email}>
              {user.email}
            </span>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              aria-label="Profile menu"
              aria-expanded={profileOpen}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 w-44 bg-white rounded-md shadow-lg border border-gray-200 z-50 text-gray-900">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/2fa-challenge" element={<TwoFactorChallenge />} />
            <Route path="/auth/email-otp" element={<EmailOtpChallenge />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <>
                    <Header />
                    <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<AdminDashboard />} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </main>
                  </>
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
