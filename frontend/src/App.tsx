import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/lib/api';
import RequireAuth from '@/components/RequireAuth';
import { PlanningDataProvider } from '@/context/PlanningDataContext';
import LuxlaitApp from '@/pages/LuxlaitApp';
import EmailOtpChallenge from '@/pages/auth/EmailOtpChallenge';
import LoginPage from '@/pages/auth/Login';
import TwoFactorChallenge from '@/pages/auth/TwoFactorChallenge';

function AuthInit() {
  const initialize = useAuthStore((s) => s.initialize);
  useEffect(() => {
    initialize();
  }, [initialize]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthInit />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/email-otp" element={<EmailOtpChallenge />} />
        <Route path="/auth/two-factor" element={<TwoFactorChallenge />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <PlanningDataProvider>
                <LuxlaitApp />
              </PlanningDataProvider>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
