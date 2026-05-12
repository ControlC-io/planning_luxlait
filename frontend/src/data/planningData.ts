// planning_data — 150 employés, 5 groupes, données déterministes (port du handoff)

export type Shift = {
  id: string;
  label: string;
  short: string;
  chipBg: string;
  chipText: string;
  cellBg: string;
  cellText: string;
};

export type Status = {
  id: string;
  label: string;
  bg: string;
  color: string;
};

export type Machine = {
  id: string;
  name: string;
  short: string;
  group: string;
  importance: 'MANDATORY' | 'PRIORITY' | 'OPTIONAL';
  maxEmp: number;
};

export type Group = {
  id: string;
  label: string;
  color: string;
  textColor: string;
  machines: string[];
};

export type SkillLevelOnMachine = 'AUTONOMOUS' | 'IN_TRAINING';

export type Employee = {
  id: string;
  nom: string;
  prenom: string;
  backup: boolean;
  group: string;
  groupLabel: string;
  groupColor: string;
  groupText: string;
  skills: string[];
  /** From luxlait_employee_machine_skills: machine_id -> level */
  skillLevels?: Record<string, SkillLevelOnMachine>;
};

/** One machine plus shift slot; training marks IN_TRAINING qualification on that machine. */
export type WorkShiftPair = {
  shift: string;
  machine: string;
  /** True when skill level is IN_TRAINING for this machine (formation). */
  training?: boolean;
};

export type Assignment =
  | { type: 'weekend' }
  | { type: 'status'; status: string }
  | {
      type: 'work';
      shift: string;
      machine: string;
      shifts: WorkShiftPair[];
    };

/** One DB row from luxlait_weekly_employee_statuses for DELETE by id */
export type WeeklyStatusEntry = {
  id: string;
  employeeId: string;
  dayDate: string;
  statusId: string;
};

export type PlanningDataBundle = {
  SHIFTS: Shift[];
  STATUSES: Status[];
  MACHINES: Machine[];
  EMPLOYEES: Employee[];
  GROUPS: Group[];
  assignments: Record<string, Assignment>;
  /** Row id from luxlait_daily_assignments for PATCH/DELETE when cell shows work */
  workAssignmentByCell: Record<string, { id: string }>;
  /** Row id from luxlait_weekly_employee_statuses for DELETE when cell shows status */
  weeklyStatusRowByCell: Record<string, { id: string }>;
  /** Full weekly status rows for bulk DELETE by range */
  statusEntries: WeeklyStatusEntry[];
  YEAR: number;
  MONTH_IDX: number;
  DAYS: number;
  MONTH_LABEL: string;
  MAY_1_DOW: number;
  TODAY: number;
  DAY_NAMES_SHORT: string[];
  dowLabel: (day: number) => string;
  isWeekend: (day: number) => boolean;
};

export const PLANNING_DATA: PlanningDataBundle = (() => {
  const SHIFTS: Shift[] = [
    {
      id: 'M',
      label: 'Matin',
      short: 'M',
      chipBg: '#F59E0B',
      chipText: '#fff',
      cellBg: '#FFFBEB',
      cellText: '#92400E',
    },
    {
      id: 'A',
      label: 'Après-midi',
      short: 'A',
      chipBg: '#0EA5E9',
      chipText: '#fff',
      cellBg: '#F0F9FF',
      cellText: '#075985',
    },
    {
      id: 'N',
      label: 'Nuit',
      short: 'N',
      chipBg: '#818CF8',
      chipText: '#fff',
      cellBg: '#EEF2FF',
      cellText: '#3730A3',
    },
  ];

  const STATUSES: Status[] = [
    { id: 'CP', label: 'Congé payé', bg: '#DCFCE7', color: '#166534' },
    { id: 'MAL', label: 'Maladie', bg: '#FEE2E2', color: '#991B1B' },
    { id: 'FORM', label: 'Formation', bg: '#EDE9FE', color: '#5B21B6' },
    { id: 'RTT', label: 'RTT', bg: '#DBEAFE', color: '#1E40AF' },
    { id: 'ABS', label: 'Absence non justifiée', bg: '#FEF9C3', color: '#854D0E' },
  ];

  const MACHINES: Machine[] = [
    {
      id: 'm1',
      name: 'Cond. Bouteilles 1L',
      short: 'CB1',
      group: 'Conditionnement',
      importance: 'MANDATORY',
      maxEmp: 3,
    },
    {
      id: 'm2',
      name: 'Cond. Bouteilles 500ml',
      short: 'CB5',
      group: 'Conditionnement',
      importance: 'PRIORITY',
      maxEmp: 2,
    },
    {
      id: 'm3',
      name: 'Beurrerie',
      short: 'BEU',
      group: 'Fromagerie',
      importance: 'PRIORITY',
      maxEmp: 2,
    },
    {
      id: 'm4',
      name: 'Pasteurisateur',
      short: 'PAS',
      group: 'Laiterie',
      importance: 'MANDATORY',
      maxEmp: 2,
    },
    {
      id: 'm5',
      name: 'Fromagerie A',
      short: 'FRA',
      group: 'Fromagerie',
      importance: 'MANDATORY',
      maxEmp: 3,
    },
    {
      id: 'm6',
      name: 'Yaourts',
      short: 'YAO',
      group: 'Fromagerie',
      importance: 'PRIORITY',
      maxEmp: 2,
    },
    {
      id: 'm7',
      name: 'UHT Ligne 1',
      short: 'UHT',
      group: 'Laiterie',
      importance: 'MANDATORY',
      maxEmp: 2,
    },
    {
      id: 'm8',
      name: 'Crème',
      short: 'CRM',
      group: 'Laiterie',
      importance: 'OPTIONAL',
      maxEmp: 1,
    },
  ];

  const GROUPS: Group[] = [
    {
      id: 'laiterie',
      label: 'Laiterie',
      color: '#DBEAFE',
      textColor: '#1E40AF',
      machines: ['m4', 'm7', 'm8'],
    },
    {
      id: 'fromagerie',
      label: 'Fromagerie',
      color: '#FEF3C7',
      textColor: '#92400E',
      machines: ['m5', 'm6', 'm3'],
    },
    {
      id: 'conditionnement',
      label: 'Conditionnement',
      color: '#DCFCE7',
      textColor: '#166534',
      machines: ['m1', 'm2'],
    },
    {
      id: 'logistique',
      label: 'Logistique',
      color: '#EDE9FE',
      textColor: '#5B21B6',
      machines: ['m1', 'm2', 'm8'],
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      color: '#FEE2E2',
      textColor: '#991B1B',
      machines: ['m4', 'm7', 'm1', 'm5'],
    },
  ];

  const PRENOMS_M = [
    'Marc',
    'Jan',
    'Pierre',
    'Luc',
    'Tom',
    'Max',
    'Nico',
    'Jean',
    'Paul',
    'André',
    'Gilles',
    'René',
    'Stéphane',
    'Laurent',
    'Thierry',
    'Christophe',
    'Julien',
    'Kevin',
    'Louis',
    'Martin',
    'Bruno',
    'David',
    'Éric',
    'François',
    'Alex',
    'Patrick',
    'Michel',
    'Henri',
    'Sébastien',
    'Xavier',
  ];
  const PRENOMS_F = [
    'Anna',
    'Claire',
    'Emma',
    'Julie',
    'Marie',
    'Sara',
    'Sophie',
    'Laura',
    'Camille',
    'Léa',
    'Lucie',
    'Manon',
    'Céline',
    'Élise',
    'Nathalie',
    'Isabelle',
    'Sandra',
    'Chantal',
    'Aurélie',
    'Virginie',
    'Laure',
    'Pauline',
    'Valérie',
    'Christine',
    'Brigitte',
    'Sylvie',
    'Dominique',
    'Corinne',
    'Agnès',
    'Florence',
  ];
  const NOMS = [
    'Schmitt',
    'Müller',
    'Becker',
    'Weber',
    'Klein',
    'Braun',
    'Fischer',
    'Meyer',
    'Wagner',
    'Hoffmann',
    'Koch',
    'Lehmann',
    'Engel',
    'Kremer',
    'Schulz',
    'Neumann',
    'Zimmermann',
    'Wolf',
    'Peters',
    'Roth',
    'Richter',
    'Lorenz',
    'Thomas',
    'Moreau',
    'Laurent',
    'Simon',
    'Bernard',
    'Leroy',
    'Dupont',
    'Dubois',
    'Martin',
    'Garcia',
    'David',
    'Bertrand',
    'Durand',
    'Lefevre',
    'Blanc',
    'Henry',
    'Vincent',
    'Fontaine',
    'Girard',
    'Bonnet',
    'Mercier',
    'Dupuis',
    'Lambert',
    'Denis',
    'Chevalier',
    'François',
    'Colin',
  ];

  const EMPLOYEES: Employee[] = [];
  let uid = 1;

  GROUPS.forEach((grp, gi) => {
    for (let i = 0; i < 30; i++) {
      const seed = uid * 13 + gi * 7 + i * 3;
      const female = seed % 3 === 0;
      const pool = female ? PRENOMS_F : PRENOMS_M;
      const prenom = pool[seed % pool.length];
      const nom = NOMS[(seed * 7 + i) % NOMS.length];
      const backup = seed % 9 === 0;

      const primary = [...grp.machines];
      const xMachineId = MACHINES[(seed * 3) % MACHINES.length].id;
      const skills =
        seed % 6 === 0 ? [...new Set([...primary, xMachineId])] : primary;

      EMPLOYEES.push({
        id: `e${uid}`,
        nom,
        prenom,
        backup,
        group: grp.id,
        groupLabel: grp.label,
        groupColor: grp.color,
        groupText: grp.textColor,
        skills,
      });
      uid++;
    }
  });

  const YEAR = 2026;
  const MONTH_IDX = 4;
  const DAYS = 31;
  const MONTH_LABEL = 'Mai 2026';
  const MAY_1_DOW = 5;
  const TODAY = 14;
  const DAY_NAMES_SHORT = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];

  function dowLabel(day: number): string {
    return DAY_NAMES_SHORT[(MAY_1_DOW + day - 1) % 7];
  }

  function isWeekend(day: number): boolean {
    const d = (MAY_1_DOW + day - 1) % 7;
    return d === 0 || d === 6;
  }

  const SHIFT_IDS = ['M', 'A', 'N'];

  function getSpecial(empIdx: number, day: number): string | null {
    const h = (empIdx * 17 + day * 31) % 100;
    if (h < 3) return 'CP';
    if (h < 5) return 'MAL';
    if (h < 6) return 'FORM';
    if (h < 7) return 'RTT';
    if (h === 7 && empIdx % 20 === 0) return 'ABS';
    return null;
  }

  const assignments: Record<string, Assignment> = {};
  EMPLOYEES.forEach((emp, ei) => {
    for (let day = 1; day <= DAYS; day++) {
      const key = `${emp.id}-${day}`;
      if (isWeekend(day)) {
        assignments[key] = { type: 'weekend' };
        continue;
      }

      const sp = getSpecial(ei, day);
      if (sp) {
        assignments[key] = { type: 'status', status: sp };
        continue;
      }

      const shiftIdx = (ei * 5 + day * 2 + Math.floor(ei / 10)) % 3;
      const shift = SHIFT_IDS[shiftIdx];

      const machineId = emp.skills[(day + ei * 2) % emp.skills.length];

      const isMulti = (ei * 13 + day * 7) % 12 === 0;
      if (isMulti) {
        const shift2Idx = (shiftIdx + 1 + ((ei + day) % 2)) % 3;
        const shift2 = SHIFT_IDS[shift2Idx];
        const machine2 = emp.skills[(day * 3 + ei + 1) % emp.skills.length];
        assignments[key] = {
          type: 'work',
          shifts: [
            { shift, machine: machineId },
            { shift: shift2, machine: machine2 },
          ],
          shift,
          machine: machineId,
        };
      } else {
        assignments[key] = {
          type: 'work',
          shift,
          machine: machineId,
          shifts: [{ shift, machine: machineId }],
        };
      }
    }
  });

  return {
    SHIFTS,
    STATUSES,
    MACHINES,
    EMPLOYEES,
    GROUPS,
    assignments,
    YEAR,
    MONTH_IDX,
    DAYS,
    MONTH_LABEL,
    MAY_1_DOW,
    TODAY,
    DAY_NAMES_SHORT,
    dowLabel,
    isWeekend,
    workAssignmentByCell: {},
    weeklyStatusRowByCell: {},
    statusEntries: [],
  };
})();
