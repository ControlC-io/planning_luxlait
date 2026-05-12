/**
 * Weekly machine shift closures (luxlait_weekly_machine_closed_shifts), aligned with admin fermetures UI.
 */

export type ApiWeeklyMachineClosedShiftRow = {
  id: string;
  year: number;
  iso_week: number;
  machine_id: string;
  weekday: number;
  time_slot_id: string;
};

export function jsWeekdayToUiIndex(js: number): number {
  return js === 0 ? 6 : js - 1;
}

export function uiIndexToJsWeekday(ui: number): number {
  return (ui + 1) % 7;
}

export function closedKey(machineId: string, uiDay: number, timeSlotId: string): string {
  return `${machineId}|${uiDay}|${timeSlotId}`;
}

export function buildClosedMapFromApi(
  rows: ApiWeeklyMachineClosedShiftRow[],
): Map<number, Set<string>> {
  const byWeek = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!byWeek.has(r.iso_week)) byWeek.set(r.iso_week, new Set());
    const ui = jsWeekdayToUiIndex(r.weekday);
    byWeek.get(r.iso_week)!.add(closedKey(r.machine_id, ui, r.time_slot_id));
  }
  return byWeek;
}

/** ISO week number for a local calendar date (same formula as admin fermetures). */
export function isoWeekNumberForDate(y: number, monthIdx: number, day: number): number {
  const d = new Date(y, monthIdx, day);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    )
  );
}

export function isWeeklyMachineShiftClosed(
  closedByWeek: Map<number, Set<string>>,
  year: number,
  monthIdx: number,
  dayOfMonth: number,
  machineId: string,
  timeSlotId: string,
): boolean {
  const isoWeek = isoWeekNumberForDate(year, monthIdx, dayOfMonth);
  const d = new Date(year, monthIdx, dayOfMonth);
  const uiDay = jsWeekdayToUiIndex(d.getDay());
  const key = closedKey(machineId, uiDay, timeSlotId);
  return closedByWeek.get(isoWeek)?.has(key) ?? false;
}
