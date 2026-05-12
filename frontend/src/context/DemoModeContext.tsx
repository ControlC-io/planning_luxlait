import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

type DemoModeValue = {
  isDemo: boolean;
  prefix: string;
  withDemo: (path: string) => string;
};

const DemoModeContext = createContext<DemoModeValue | null>(null);

export function DemoModeProvider({
  isDemo,
  children,
}: {
  isDemo: boolean;
  children: ReactNode;
}) {
  const prefix = isDemo ? '/demo' : '';
  const withDemo = useCallback(
    (path: string) => {
      const normalized = path.startsWith('/') ? path : `/${path}`;
      if (!isDemo) return normalized;
      if (normalized === '/demo' || normalized.startsWith('/demo/')) return normalized;
      if (normalized === '/') return '/demo';
      return `/demo${normalized}`;
    },
    [isDemo],
  );
  const value = useMemo(
    () => ({ isDemo, prefix, withDemo }),
    [isDemo, prefix, withDemo],
  );
  return (
    <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>
  );
}

export function useDemoMode(): DemoModeValue {
  const ctx = useContext(DemoModeContext);
  if (!ctx) {
    throw new Error('useDemoMode must be used within DemoModeProvider');
  }
  return ctx;
}
