import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/lib/api';
import RequireAuth from '@/components/RequireAuth';
import { PlanningDataProvider } from '@/context/PlanningDataContext';
import { DemoModeProvider, useDemoMode } from '@/context/DemoModeContext';
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

function DocumentTitle() {
  const { isDemo } = useDemoMode();
  useEffect(() => {
    document.title = isDemo ? 'Planification — Démo' : 'Luxlait — Planification';
  }, [isDemo]);
  return null;
}

function WithDemoMode({ isDemo, children }: { isDemo: boolean; children: ReactNode }) {
  return (
    <DemoModeProvider isDemo={isDemo}>
      <DocumentTitle />
      {children}
    </DemoModeProvider>
  );
}

function AuthedPlanningApp() {
  return (
    <RequireAuth>
      <PlanningDataProvider>
        <LuxlaitApp />
      </PlanningDataProvider>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthInit />
      <Routes>
        <Route
          path="/demo/login"
          element={
            <WithDemoMode isDemo>
              <LoginPage />
            </WithDemoMode>
          }
        />
        <Route
          path="/demo/auth/email-otp"
          element={
            <WithDemoMode isDemo>
              <EmailOtpChallenge />
            </WithDemoMode>
          }
        />
        <Route
          path="/demo/auth/two-factor"
          element={
            <WithDemoMode isDemo>
              <TwoFactorChallenge />
            </WithDemoMode>
          }
        />
        <Route
          path="/demo"
          element={
            <WithDemoMode isDemo>
              <Navigate to="/demo/planning" replace />
            </WithDemoMode>
          }
        />
        <Route
          path="/demo/"
          element={
            <WithDemoMode isDemo>
              <Navigate to="/demo/planning" replace />
            </WithDemoMode>
          }
        />
        <Route
          path="/demo/*"
          element={
            <WithDemoMode isDemo>
              <AuthedPlanningApp />
            </WithDemoMode>
          }
        />

        <Route
          path="/login"
          element={
            <WithDemoMode isDemo={false}>
              <LoginPage />
            </WithDemoMode>
          }
        />
        <Route
          path="/auth/email-otp"
          element={
            <WithDemoMode isDemo={false}>
              <EmailOtpChallenge />
            </WithDemoMode>
          }
        />
        <Route
          path="/auth/two-factor"
          element={
            <WithDemoMode isDemo={false}>
              <TwoFactorChallenge />
            </WithDemoMode>
          }
        />
        <Route
          path="/"
          element={
            <WithDemoMode isDemo={false}>
              <Navigate to="/planning" replace />
            </WithDemoMode>
          }
        />
        <Route
          path="/*"
          element={
            <WithDemoMode isDemo={false}>
              <AuthedPlanningApp />
            </WithDemoMode>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
