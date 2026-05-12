import type { Status } from '@/data/planningData';

export function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

/** ASCII-ish form for keyword checks (accents stripped). */
function normalizeForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * Short label for planning cells (handoff style: CP, MAL, …).
 * Static bundle uses non UUID ids; API rows use UUID and DB names.
 */
export function planningStatusShort(st: Status | undefined): string {
  if (!st) return '—';
  if (!isUuidLike(st.id)) return st.id;

  const key = normalizeForMatch(st.label);
  if (key.includes('conge')) return 'CP';
  if (key.startsWith('maladie')) return 'MAL';
  if (key.startsWith('formation')) return 'FORM';
  if (key === 'rtt') return 'RTT';
  if (key.includes('absence') || key.includes('non justif')) return 'ABS';

  const words = st.label.trim().split(/[\s\u00a0]+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => (w[0] ? w[0].toUpperCase() : ''))
      .join('')
      .slice(0, 4);
  }

  return st.label.slice(0, 4);
}

/** Matches PLANNING_DATA handoff: fill, text, and border for grid contrast. */
export const STATUS_CELL_HANDOFF: Record<
  string,
  { bg: string; color: string; border: string }
> = {
  CP: {
    bg: '#DCFCE7',
    color: '#166534',
    border: '1px solid #22C55E',
  },
  MAL: {
    bg: '#FEE2E2',
    color: '#991B1B',
    border: '1px solid #F87171',
  },
  FORM: {
    bg: '#EDE9FE',
    color: '#5B21B6',
    border: '1px solid #A78BFA',
  },
  RTT: {
    bg: '#DBEAFE',
    color: '#1E40AF',
    border: '1px solid #60A5FA',
  },
  ABS: {
    bg: '#FEF9C3',
    color: '#854D0E',
    border: '1px solid #EAB308',
  },
};

const FALLBACK_STATUS_BORDER = '1px solid rgba(148, 163, 184, 0.55)';

/** Background, text, and border for status cells (overrides DB tint when code matches handoff). */
export function planningStatusCellStyle(st: Status | undefined): {
  bg: string;
  color: string;
  border: string;
} {
  const short = planningStatusShort(st);
  const handoff =
    short !== '—' && short in STATUS_CELL_HANDOFF
      ? STATUS_CELL_HANDOFF[short]
      : undefined;
  if (handoff) {
    return {
      bg: handoff.bg,
      color: handoff.color,
      border: handoff.border,
    };
  }
  if (!st) {
    return { bg: '#F3F4F6', color: '#111827', border: FALLBACK_STATUS_BORDER };
  }
  return {
    bg: st.bg,
    color: st.color,
    border: FALLBACK_STATUS_BORDER,
  };
}
