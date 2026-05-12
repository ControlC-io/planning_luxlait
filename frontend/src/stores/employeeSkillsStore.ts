import { create } from 'zustand';
import type { Employee, SkillLevelOnMachine } from '@/data/planningData';
import { planningFetch } from '@/lib/planningApi';

function cloneSkills(
  src: Record<string, Set<string>>,
): Record<string, Set<string>> {
  const o: Record<string, Set<string>> = {};
  Object.keys(src).forEach((k) => {
    o[k] = new Set(src[k]);
  });
  return o;
}

function cloneLevels(
  src: Record<string, Record<string, SkillLevelOnMachine>>,
): Record<string, Record<string, SkillLevelOnMachine>> {
  const o: Record<string, Record<string, SkillLevelOnMachine>> = {};
  Object.keys(src).forEach((k) => {
    o[k] = { ...src[k] };
  });
  return o;
}

export const useEmployeeSkillsStore = create<{
  skillsByEmpId: Record<string, Set<string>>;
  baselineSkills: Record<string, Set<string>>;
  skillLevelsByEmpId: Record<string, Record<string, SkillLevelOnMachine>>;
  baselineSkillLevels: Record<string, Record<string, SkillLevelOnMachine>>;
  hydrateFromPlanning: (employees: Employee[]) => void;
  toggleEmpMachine: (empId: string, machineId: string) => Promise<void>;
  resetSkills: () => void;
}>((set, get) => ({
  skillsByEmpId: {},
  baselineSkills: {},
  skillLevelsByEmpId: {},
  baselineSkillLevels: {},
  hydrateFromPlanning: (employees) => {
    const baseline: Record<string, Set<string>> = {};
    const baselineLv: Record<string, Record<string, SkillLevelOnMachine>> = {};
    employees.forEach((e) => {
      baseline[e.id] = new Set(e.skills);
      baselineLv[e.id] = { ...(e.skillLevels ?? {}) };
    });
    set({
      baselineSkills: baseline,
      skillsByEmpId: cloneSkills(baseline),
      baselineSkillLevels: baselineLv,
      skillLevelsByEmpId: cloneLevels(baselineLv),
    });
  },
  toggleEmpMachine: async (empId, machineId) => {
    const state = get();
    const prev = new Set(state.skillsByEmpId[empId] ?? []);
    const wasOn = prev.has(machineId);
    const prevLevelsSnapshot = { ...(state.skillLevelsByEmpId[empId] ?? {}) };
    const next = new Set(prev);
    const prevLv = { ...(state.skillLevelsByEmpId[empId] ?? {}) };
    if (wasOn) {
      next.delete(machineId);
      delete prevLv[machineId];
    } else {
      next.add(machineId);
      prevLv[machineId] = 'AUTONOMOUS';
    }

    set({
      skillsByEmpId: { ...state.skillsByEmpId, [empId]: next },
      skillLevelsByEmpId: { ...state.skillLevelsByEmpId, [empId]: prevLv },
    });

    const jsonHeaders = { 'Content-Type': 'application/json' };
    try {
      const res = wasOn
        ? await planningFetch('/luxlait_employee_machine_skills', {
            method: 'DELETE',
            headers: jsonHeaders,
            body: JSON.stringify({
              employee_id: empId,
              machine_id: machineId,
            }),
          })
        : await planningFetch('/luxlait_employee_machine_skills', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({
              employee_id: empId,
              machine_id: machineId,
            }),
          });

      if (res.status === 401) return;
      if (!res.ok) {
        throw new Error(await res.text());
      }

      const baselineSkills = { ...get().baselineSkills };
      baselineSkills[empId] = new Set(next);
      const baselineLv = { ...get().baselineSkillLevels };
      baselineLv[empId] = { ...(get().skillLevelsByEmpId[empId] ?? {}) };
      set({ baselineSkills, baselineSkillLevels: baselineLv });
    } catch {
      set({
        skillsByEmpId: {
          ...get().skillsByEmpId,
          [empId]: prev,
        },
        skillLevelsByEmpId: {
          ...get().skillLevelsByEmpId,
          [empId]: prevLevelsSnapshot,
        },
      });
    }
  },
  resetSkills: () =>
    set({
      skillsByEmpId: cloneSkills(get().baselineSkills),
      skillLevelsByEmpId: cloneLevels(get().baselineSkillLevels),
    }),
}));

export function skillIdsForEmp(
  skillsByEmpId: Record<string, Set<string>>,
  empId: string,
): Set<string> {
  return skillsByEmpId[empId] ?? new Set();
}

export function hasEmpSkill(
  skillsByEmpId: Record<string, Set<string>>,
  empId: string,
  machineId: string,
): boolean {
  return skillsByEmpId[empId]?.has(machineId) ?? false;
}
