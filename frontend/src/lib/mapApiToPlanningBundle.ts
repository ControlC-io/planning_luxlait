/**
 * Maps REST payloads from GET /api/planning/luxlait_* into PlanningDataBundle for the UI.
 */
import type {
  Assignment,
  Employee,
  Group,
  Machine,
  PlanningDataBundle,
  Shift,
  SkillLevelOnMachine,
  Status,
  WeeklyStatusEntry,
} from '@/data/planningData';

const MONTH_NAMES_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

function slugLabel(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase() || 'grp'
  );
}

function parseIsoDay(iso: string): { y: number; m0: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m0: m - 1, d };
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function pickTextOnBg(bgHex: string): string {
  try {
    return relativeLuminance(bgHex) > 0.55 ? '#111827' : '#ffffff';
  } catch {
    return '#111827';
  }
}

function mixWithWhite(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb
    .toString(16)
    .padStart(2, '0')}`;
}

function mapTimeSlotToShift(ts: {
  id: string;
  name: string;
  short_name: string | null;
  color: string;
}): Shift {
  const raw = ts.color?.trim() || '94A3B8';
  const chipBg = raw.startsWith('#') ? raw : `#${raw}`;
  return {
    id: ts.id,
    label: ts.name,
    short: ts.short_name || ts.name.slice(0, 2).toUpperCase(),
    chipBg,
    chipText: pickTextOnBg(chipBg),
    cellBg: mixWithWhite(chipBg, 0.82),
    cellText: '#334155',
  };
}

function mapDbStatus(s: { id: string; name: string; color: string }): Status {
  const raw = s.color?.trim() || 'E5E7EB';
  const bg = raw.startsWith('#') ? raw : `#${raw}`;
  return {
    id: s.id,
    label: s.name,
    bg,
    color: pickTextOnBg(bg),
  };
}

type ApiMachine = {
  id: string;
  name: string;
  machine_group: string | null;
  max_employees: number;
  short_name: string | null;
  importance: string;
  sort_order: number;
};

type ApiEmployee = {
  id: string;
  first_name: string;
  last_name: string;
  is_backup: boolean;
};

type ApiSkill = {
  employee_id: string;
  machine_id: string;
  level?: SkillLevelOnMachine;
};

type ApiDailyAssignment = {
  id: string;
  day_date: string;
  employee_id: string;
  machine_id: string;
  time_slot_id: string | null;
};

type ApiWeeklyEmpStatus = {
  id: string;
  day_date: string;
  employee_id: string;
  status_id: string;
};

const GROUP_PALETTE: { color: string; textColor: string }[] = [
  { color: '#DBEAFE', textColor: '#1E40AF' },
  { color: '#FEF3C7', textColor: '#92400E' },
  { color: '#DCFCE7', textColor: '#166534' },
  { color: '#EDE9FE', textColor: '#5B21B6' },
  { color: '#FEE2E2', textColor: '#991B1B' },
  { color: '#E0F2FE', textColor: '#0369A1' },
];

export type PlanningApiPayload = {
  machines: ApiMachine[];
  employees: ApiEmployee[];
  time_slots: {
    id: string;
    name: string;
    short_name: string | null;
    color: string;
    sort_order: number;
  }[];
  statuses: { id: string; name: string; color: string; sort_order: number }[];
  skills: ApiSkill[];
  daily_assignments: ApiDailyAssignment[];
  weekly_employee_statuses: ApiWeeklyEmpStatus[];
};

export function buildPlanningBundleFromApi(
  payload: PlanningApiPayload,
  year: number,
  monthOneBased: number,
): PlanningDataBundle {
  const MONTH_IDX = monthOneBased - 1;
  const DAYS = new Date(year, MONTH_IDX + 1, 0).getDate();
  const MONTH_LABEL = `${MONTH_NAMES_FR[MONTH_IDX]} ${year}`;

  const first = new Date(Date.UTC(year, MONTH_IDX, 1));
  const MAY_1_DOW = first.getUTCDay();

  const DAY_NAMES_SHORT = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];

  function dowLabel(day: number): string {
    return DAY_NAMES_SHORT[(MAY_1_DOW + day - 1) % 7];
  }

  /**
   * Calendar Saturday or Sunday are not treated as closed days here.
   * Open or closed days follow database assignments and machine rules (for example
   * luxlait_machine_closed_weekdays), not a fixed weekend calendar flag.
   */
  function isWeekend(_day: number): boolean {
    return false;
  }

  const machinesSorted = [...payload.machines].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  const MACHINES: Machine[] = machinesSorted.map((m) => ({
    id: m.id,
    name: m.name,
    short: (m.short_name || m.name.slice(0, 3)).toUpperCase(),
    group: m.machine_group || 'Autres',
    importance: (m.importance || 'OPTIONAL') as Machine['importance'],
    maxEmp: m.max_employees ?? 1,
  }));

  const machinesById = new Map(machinesSorted.map((m) => [m.id, m]));

  const groupLabels = [
    ...new Set(MACHINES.map((m) => m.group).filter(Boolean)),
  ] as string[];

  const GROUPS: Group[] = groupLabels.map((label, i) => ({
    id: slugLabel(label),
    label,
    ...GROUP_PALETTE[i % GROUP_PALETTE.length],
    machines: MACHINES.filter((m) => m.group === label).map((m) => m.id),
  }));

  const defaultGroup: Group = GROUPS[0] ?? {
    id: 'equipe',
    label: 'Équipe',
    color: '#F1F5F9',
    textColor: '#475569',
    machines: [],
  };

  const skillsByEmp = new Map<string, string[]>();
  const skillLevelsByEmp = new Map<string, Record<string, SkillLevelOnMachine>>();
  payload.skills.forEach((sk) => {
    const empId = sk.employee_id;
    const mid = sk.machine_id;
    const lvl: SkillLevelOnMachine =
      sk.level === 'IN_TRAINING' ? 'IN_TRAINING' : 'AUTONOMOUS';
    const arr = skillsByEmp.get(empId) ?? [];
    if (!arr.includes(mid)) arr.push(mid);
    skillsByEmp.set(empId, arr);
    const lv = skillLevelsByEmp.get(empId) ?? {};
    lv[mid] = lvl;
    skillLevelsByEmp.set(empId, lv);
  });

  const EMPLOYEES: Employee[] = payload.employees.map((e) => {
    const ms = skillsByEmp.get(e.id) ?? [];
    const orderedMachines = ms
      .map((mid) => machinesById.get(mid))
      .filter(Boolean)
      .sort(
        (a, b) => (a!.sort_order ?? 0) - (b!.sort_order ?? 0),
      ) as ApiMachine[];

    const grpName =
      orderedMachines[0]?.machine_group ||
      groupLabels[0] ||
      defaultGroup.label;
    const g =
      GROUPS.find((x) => x.label === grpName) ||
      GROUPS.find((x) => x.id === slugLabel(grpName)) ||
      defaultGroup;

    return {
      id: e.id,
      nom: e.last_name,
      prenom: e.first_name,
      backup: e.is_backup,
      group: g.id,
      groupLabel: g.label,
      groupColor: g.color,
      groupText: g.textColor,
      skills: ms,
      skillLevels: skillLevelsByEmp.get(e.id) ?? {},
    };
  });

  const SHIFTS: Shift[] = [...payload.time_slots]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(mapTimeSlotToShift);

  const STATUSES: Status[] = [...payload.statuses]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(mapDbStatus);

  const defaultShiftId = SHIFTS[0]?.id ?? '';

  function dayInMonth(isoDate: string): number | null {
    const { y, m0, d } = parseIsoDay(isoDate);
    if (y !== year || m0 !== MONTH_IDX) return null;
    return d;
  }

  const assignments: Record<string, Assignment> = {};
  const workAssignmentByCell: Record<string, { id: string }> = {};
  const weeklyStatusRowByCell: Record<string, { id: string }> = {};
  const statusEntries: WeeklyStatusEntry[] = [];

  for (const row of payload.daily_assignments) {
    const day = dayInMonth(row.day_date);
    if (day === null) continue;
    const key = `${row.employee_id}-${day}`;
    if (row.id) {
      workAssignmentByCell[key] = { id: row.id };
    }
    const tsId = row.time_slot_id || defaultShiftId;
    if (!tsId) continue;
    const lvl = skillLevelsByEmp.get(row.employee_id)?.[row.machine_id];
    const training = lvl === 'IN_TRAINING';
    assignments[key] = {
      type: 'work',
      shift: tsId,
      machine: row.machine_id,
      shifts: [{ shift: tsId, machine: row.machine_id, training }],
    };
  }

  for (const row of payload.weekly_employee_statuses) {
    const day = dayInMonth(row.day_date);
    if (day === null) continue;
    const key = `${row.employee_id}-${day}`;
    const iso =
      typeof row.day_date === 'string'
        ? row.day_date.slice(0, 10)
        : new Date(row.day_date as unknown as string).toISOString().slice(0, 10);
    if (row.id) {
      weeklyStatusRowByCell[key] = { id: row.id };
      statusEntries.push({
        id: row.id,
        employeeId: row.employee_id,
        dayDate: iso,
        statusId: row.status_id,
      });
    }
    assignments[key] = { type: 'status', status: row.status_id };
  }

  const now = new Date();
  // TODAY is only meaningful within the currently displayed month.
  // For past or future months there is no "today" to highlight.
  const TODAY =
    now.getFullYear() === year && now.getMonth() === MONTH_IDX
      ? now.getDate()
      : 0;

  return {
    SHIFTS,
    STATUSES,
    MACHINES,
    EMPLOYEES,
    GROUPS: GROUPS.length ? GROUPS : [defaultGroup],
    assignments,
    workAssignmentByCell,
    weeklyStatusRowByCell,
    statusEntries,
    YEAR: year,
    MONTH_IDX,
    DAYS,
    MONTH_LABEL,
    MAY_1_DOW,
    TODAY,
    DAY_NAMES_SHORT,
    dowLabel,
    isWeekend,
  };
}

export function planningMonthRange(year: number, monthOneBased: number): {
  fromDate: string;
  toDate: string;
} {
  const m = monthOneBased;
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(year, m, 0).getDate();
  return {
    fromDate: `${year}-${pad(m)}-01`,
    toDate: `${year}-${pad(m)}-${pad(lastDay)}`,
  };
}
