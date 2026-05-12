import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PlanningDataBundle } from '@/data/planningData';
import {
  buildPlanningBundleFromApi,
  planningMonthRange,
  type PlanningApiPayload,
} from '@/lib/mapApiToPlanningBundle';
import { planningJson } from '@/lib/planningApi';
import { useEmployeeSkillsStore } from '@/stores/employeeSkillsStore';

export type PlanningFullContextValue = PlanningDataBundle & {
  planningYear: number;
  planningMonthOneBased: number;
  setPlanningMonth: (year: number, monthOneBased: number) => void;
  refetchPlanning: () => Promise<void>;
};

const PlanningFullContext = createContext<PlanningFullContextValue | null>(
  null,
);

export function usePlanningFull(): PlanningFullContextValue {
  const v = useContext(PlanningFullContext);
  if (!v) {
    throw new Error('usePlanningFull must be used within PlanningDataProvider');
  }
  return v;
}

/** Bundle fields only (same shape as before extended context). */
export function usePlanningData(): PlanningDataBundle {
  const v = usePlanningFull();
  return useMemo(() => {
    const {
      planningYear: _py,
      planningMonthOneBased: _pm,
      setPlanningMonth: _sm,
      refetchPlanning: _rf,
      ...bundle
    } = v;
    return bundle;
  }, [v]);
}

function readYearMonth(): { year: number; monthOneBased: number } {
  const y = Number(
    import.meta.env.VITE_PLANNING_YEAR ?? new Date().getFullYear(),
  );
  const m = Number(
    import.meta.env.VITE_PLANNING_MONTH ?? new Date().getMonth() + 1,
  );
  return { year: y, monthOneBased: Math.min(12, Math.max(1, m)) };
}

async function fetchPlanningPayload(
  year: number,
  month: number,
): Promise<PlanningApiPayload> {
  const { fromDate, toDate } = planningMonthRange(year, month);
  const q = `?fromDate=${fromDate}&toDate=${toDate}`;
  const [
    machines,
    employees,
    time_slots,
    statuses,
    skills,
    daily_assignments,
    weekly_employee_statuses,
  ] = await Promise.all([
    planningJson<PlanningApiPayload['machines']>('/luxlait_machines'),
    planningJson<PlanningApiPayload['employees']>('/luxlait_employees'),
    planningJson<PlanningApiPayload['time_slots']>('/luxlait_time_slots'),
    planningJson<PlanningApiPayload['statuses']>('/luxlait_statuses'),
    planningJson<PlanningApiPayload['skills']>(
      '/luxlait_employee_machine_skills',
    ),
    planningJson<PlanningApiPayload['daily_assignments']>(
      `/luxlait_daily_assignments${q}`,
    ),
    planningJson<PlanningApiPayload['weekly_employee_statuses']>(
      `/luxlait_weekly_employee_statuses${q}`,
    ),
  ]);
  return {
    machines,
    employees,
    time_slots,
    statuses,
    skills,
    daily_assignments,
    weekly_employee_statuses,
  };
}

export function PlanningDataProvider({ children }: { children: ReactNode }) {
  const initialYm = useMemo(() => readYearMonth(), []);
  const [planningYear, setPlanningYear] = useState(initialYm.year);
  const [planningMonthOneBased, setPlanningMonthOneBased] = useState(
    initialYm.monthOneBased,
  );
  const [bundleBase, setBundleBase] = useState<PlanningDataBundle | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hydrateFromPlanning = useEmployeeSkillsStore(
    (s) => s.hydrateFromPlanning,
  );

  const setPlanningMonth = useCallback((year: number, monthOneBased: number) => {
    setPlanningYear(year);
    setPlanningMonthOneBased(Math.min(12, Math.max(1, monthOneBased)));
  }, []);

  const refetchPlanning = useCallback(async () => {
    setError(null);
    const payload = await fetchPlanningPayload(
      planningYear,
      planningMonthOneBased,
    );
    const b = buildPlanningBundleFromApi(
      payload,
      planningYear,
      planningMonthOneBased,
    );
    setBundleBase(b);
    hydrateFromPlanning(b.EMPLOYEES);
  }, [planningYear, planningMonthOneBased, hydrateFromPlanning]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPlanningPayload(planningYear, planningMonthOneBased)
      .then((payload) => {
        if (cancelled) return;
        const b = buildPlanningBundleFromApi(
          payload,
          planningYear,
          planningMonthOneBased,
        );
        setBundleBase(b);
        hydrateFromPlanning(b.EMPLOYEES);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setBundleBase(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planningYear, planningMonthOneBased, hydrateFromPlanning]);

  const value = useMemo((): PlanningFullContextValue | null => {
    if (!bundleBase) return null;
    return {
      ...bundleBase,
      planningYear,
      planningMonthOneBased,
      setPlanningMonth,
      refetchPlanning,
    };
  }, [
    bundleBase,
    planningYear,
    planningMonthOneBased,
    setPlanningMonth,
    refetchPlanning,
  ]);

  if (loading && !bundleBase) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: 'center',
          fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
          color: '#64748B',
        }}
      >
        Chargement du planning…
      </div>
    );
  }

  if (error || !value) {
    return (
      <div
        style={{
          padding: 48,
          fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
          color: '#b91c1c',
        }}
      >
        <p style={{ fontWeight: 600 }}>
          Impossible de charger les données planning.
        </p>
        <pre style={{ fontSize: 12, marginTop: 12, whiteSpace: 'pre-wrap' }}>
          {error}
        </pre>
      </div>
    );
  }

  return (
    <PlanningFullContext.Provider value={value}>
      {children}
    </PlanningFullContext.Provider>
  );
}
