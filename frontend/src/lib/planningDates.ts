import type { PlanningDataBundle } from '@/data/planningData';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** YYYY MM DD for a day number within the bundle month (1 based day). */
export function isoDateFromBundleDay(
  bundle: PlanningDataBundle,
  dayOfMonth: number,
): string {
  return `${bundle.YEAR}-${pad2(bundle.MONTH_IDX + 1)}-${pad2(dayOfMonth)}`;
}

/** Day of month (1..DAYS) if iso lies in bundle month, else null. */
export function bundleDayFromIso(
  bundle: PlanningDataBundle,
  isoDate: string,
): number | null {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  if (y !== bundle.YEAR || m !== bundle.MONTH_IDX + 1) return null;
  return d;
}
