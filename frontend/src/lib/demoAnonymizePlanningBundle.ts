import type {
  Employee,
  Group,
  Machine,
  PlanningDataBundle,
} from '@/data/planningData';

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deterministicShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let rng = seed || 1;
  const next = () => {
    rng = (Math.imul(rng, 1103515245) + 12345) >>> 0;
    return rng / 0xffffffff;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const t = a[i];
    a[i] = a[j]!;
    a[j] = t!;
  }
  return a;
}

const DEMO_FIRST_NAMES = [
  'Alexandre',
  'Camille',
  'Julien',
  'Marine',
  'Nicolas',
  'Sarah',
  'Thomas',
  'Emma',
  'Lucas',
  'Léa',
  'Hugo',
  'Chloé',
  'Louis',
  'Manon',
  'Antoine',
  'Clara',
  'Paul',
  'Julie',
  'Maxime',
  'Laura',
  'Pierre',
  'Élodie',
  'Romain',
  'Céline',
  'Vincent',
  'Audrey',
  'Florian',
  'Marion',
  'Benjamin',
  'Pauline',
  'Guillaume',
  'Sophie',
  'David',
  'Anne',
  'Olivier',
  'Isabelle',
  'Sébastien',
  'Valérie',
  'Fabien',
  'Nathalie',
  'Jérémy',
  'Caroline',
  'Mathieu',
  'Stéphanie',
  'Adrien',
  'Aurélie',
  'Damien',
  'Émilie',
  'Quentin',
  'Jessica',
];

const DEMO_LAST_NAMES = [
  'Bernard',
  'Dubois',
  'Thomas',
  'Robert',
  'Richard',
  'Petit',
  'Durand',
  'Leroy',
  'Moreau',
  'Simon',
  'Laurent',
  'Lefebvre',
  'Michel',
  'Garcia',
  'David',
  'Bertrand',
  'Roux',
  'Vincent',
  'Fournier',
  'Girard',
  'Bonnet',
  'Dupont',
  'Lambert',
  'Fontaine',
  'Rousseau',
  'Mathieu',
  'Blanc',
  'Guerin',
  'Muller',
  'Henry',
  'Roussel',
  'Nicolas',
  'Perrin',
  'Morin',
  'Mathis',
  'Clement',
  'Gauthier',
  'Dumont',
  'Lopez',
  'Fabre',
  'Robin',
  'Martinez',
  'Aubert',
  'Barbier',
  'Brun',
  'Caron',
  'Colin',
  'Denis',
  'Dupuis',
  'Garnier',
];

function buildShuffledNamePairs(seed: number): [string, string][] {
  const pairs: [string, string][] = [];
  for (const f of DEMO_FIRST_NAMES) {
    for (const l of DEMO_LAST_NAMES) {
      pairs.push([f, l]);
    }
  }
  return deterministicShuffle(pairs, seed);
}

/**
 * Returns a deep copy of the bundle with employee names, machine labels, and
 * group labels replaced for public demos. IDs and graph structure are unchanged.
 */
export function anonymizePlanningBundleForDemo(
  bundle: PlanningDataBundle,
): PlanningDataBundle {
  const { dowLabel, isWeekend, ...serializable } = bundle;
  const out = structuredClone(serializable) as Omit<
    PlanningDataBundle,
    'dowLabel' | 'isWeekend'
  >;

  const empIdsSorted = [...out.EMPLOYEES]
    .map((e) => e.id)
    .sort((a, b) => a.localeCompare(b));
  const seed = hashString(empIdsSorted.join('|'));
  const namePairs = buildShuffledNamePairs(seed);

  const sortedEmps = [...out.EMPLOYEES].sort((a, b) => a.id.localeCompare(b.id));
  const nameByEmpId = new Map<string, { prenom: string; nom: string }>();
  sortedEmps.forEach((e, i) => {
    const [prenom, nom] = namePairs[i % namePairs.length]!;
    nameByEmpId.set(e.id, { prenom, nom });
  });

  const machinesSorted = [...out.MACHINES].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const machineDisplay = new Map<string, { name: string; short: string }>();
  machinesSorted.forEach((m, i) => {
    const n = i + 1;
    const num = String(n).padStart(2, '0');
    machineDisplay.set(m.id, { name: `Poste ${num}`, short: `P${num}` });
  });

  const uniqueMachineGroups = [
    ...new Set(out.MACHINES.map((m) => m.group).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const groupLabelMap = new Map<string, string>();
  uniqueMachineGroups.forEach((g, i) => {
    groupLabelMap.set(g, `Groupe ${String(i + 1).padStart(2, '0')}`);
  });

  out.MACHINES = out.MACHINES.map((m): Machine => {
    const d = machineDisplay.get(m.id)!;
    const newGroup = groupLabelMap.get(m.group) ?? m.group;
    return { ...m, name: d.name, short: d.short, group: newGroup };
  });

  out.GROUPS = out.GROUPS.map((g): Group => {
    const newLabel = groupLabelMap.get(g.label) ?? g.label;
    return { ...g, label: newLabel };
  });

  const groupById = new Map(out.GROUPS.map((g) => [g.id, g]));

  out.EMPLOYEES = out.EMPLOYEES.map((e): Employee => {
    const names = nameByEmpId.get(e.id) ?? { prenom: 'A', nom: 'B' };
    const g = groupById.get(e.group);
    return {
      ...e,
      prenom: names.prenom,
      nom: names.nom,
      groupLabel: g?.label ?? e.groupLabel,
    };
  });

  return { ...out, dowLabel, isWeekend };
}
