import type { Assignment, Employee, WorkShiftPair } from '@/data/planningData';

/** Normalized work segments for one calendar cell (single or split shifts). */
export function workAssignmentSegments(a: Assignment | undefined): WorkShiftPair[] {
  if (!a || a.type !== 'work') return [];
  if (a.shifts?.length) return a.shifts;
  return [{ shift: a.shift, machine: a.machine }];
}

/** True if this employee works this machine on this shift on this cell. */
export function employeeWorksMachineShift(
  a: Assignment | undefined,
  machineId: string,
  shiftId: string,
): boolean {
  if (!a || a.type !== 'work') return false;
  return workAssignmentSegments(a).some(
    (s) => s.machine === machineId && s.shift === shiftId,
  );
}

/** Formation vs autonome for one segment (explicit flag wins, then skill matrix). */
export function segmentIsTraining(s: WorkShiftPair, emp?: Employee): boolean {
  if (s.training === true) return true;
  if (s.training === false) return false;
  return emp?.skillLevels?.[s.machine] === 'IN_TRAINING';
}

/** Stable string for comparing two work cells (includes formation flag when set). */
export function workAssignmentFingerprint(a: Assignment): string {
  if (a.type !== 'work') return '';
  return workAssignmentSegments(a)
    .map((s) => {
      const tag =
        s.training === true ? 'F' : s.training === false ? 'A' : '?';
      return `${s.machine}|${s.shift}|${tag}`;
    })
    .join(';');
}
