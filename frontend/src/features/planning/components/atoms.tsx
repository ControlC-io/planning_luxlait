import type { ReactNode } from 'react';
import { usePlanningData } from '@/context/PlanningDataContext';
import { planningStatusShort, planningStatusCellStyle } from '@/lib/planningStatusShort';

export function Ico({ d, size = 16 }: { d: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d}
    </svg>
  );
}

export function ShiftChip({
  shiftId,
  size = 'sm',
}: {
  shiftId: string;
  size?: 'sm' | 'lg';
}) {
  const { SHIFTS } = usePlanningData();
  const s = SHIFTS.find((x) => x.id === shiftId);
  if (!s) return null;
  const dim = size === 'lg' ? 22 : 18;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dim,
        height: dim,
        borderRadius: 4,
        flexShrink: 0,
        backgroundColor: s.chipBg,
        color: s.chipText,
        fontSize: size === 'lg' ? 11 : 9,
        fontWeight: 700,
        lineHeight: 1,
        fontFamily: 'IBM Plex Sans, sans-serif',
      }}
    >
      {s.short}
    </span>
  );
}

export function StatusBadge({ statusId }: { statusId: string }) {
  const { STATUSES } = usePlanningData();
  const s = STATUSES.find((x) => x.id === statusId);
  if (!s) return null;
  const cell = planningStatusCellStyle(s);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 5px',
        borderRadius: 3,
        backgroundColor: cell.bg,
        color: cell.color,
        border: cell.border,
        fontSize: 10,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {planningStatusShort(s)}
    </span>
  );
}

export function ImportanceDot({
  importance,
}: {
  importance: string;
}) {
  const map: Record<string, { color: string; label: string }> = {
    MANDATORY: { color: '#EF4444', label: 'Obligatoire' },
    PRIORITY: { color: '#F59E0B', label: 'Prioritaire' },
    OPTIONAL: { color: '#94A3B8', label: 'Optionnel' },
  };
  const c = map[importance] || map.OPTIONAL;
  return (
    <span
      title={c.label}
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        backgroundColor: c.color,
        flexShrink: 0,
      }}
    />
  );
}

export function AvatarChip({
  emp,
  color = '#DBEAFE',
  textColor = '#1E40AF',
  size = 28,
}: {
  emp: { prenom: string; nom: string };
  color?: string;
  textColor?: string;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size > 24 ? 11 : 9,
        fontWeight: 700,
        color: textColor,
        flexShrink: 0,
      }}
    >
      {emp.prenom[0]}
      {emp.nom[0]}
    </div>
  );
}
