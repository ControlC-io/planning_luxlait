import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/api';
import { useDemoMode } from '@/context/DemoModeContext';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const loading = useAuthStore((s) => s.loading);
  const { withDemo } = useDemoMode();

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'IBM Plex Sans, sans-serif',
          color: '#64748B',
        }}
      >
        Chargement…
      </div>
    );
  }

  if (!token) {
    return <Navigate to={withDemo('/login')} replace />;
  }

  return <>{children}</>;
}
