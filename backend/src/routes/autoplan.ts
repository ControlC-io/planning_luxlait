import express, { Request, Response } from "express";
import prisma from "../lib/prisma";

const router = express.Router();

const parseYYYYMMDD = (s: string): Date => new Date(`${s}T00:00:00.000Z`);
const toYYYYMMDD = (d: Date): string => d.toISOString().slice(0, 10);
const GLOBAL_SHIFT_MIN_DATE = parseYYYYMMDD("1970-01-01");

function listDateRange(from: Date, to: Date): string[] {
  const dates: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    dates.push(toYYYYMMDD(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Compute the ISO 8601 year and week number of a UTC date.
 * Mirrors the admin ISO week calculation (see frontend lib/machineWeeklyClosures.ts)
 * but uses UTC consistently with how planning dates are stored and iterated.
 */
function isoWeekUtc(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const isoDow = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - isoDow + 3);
  const year = t.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(Date.UTC(year, 0, 4 - jan4Dow));
  const week = 1 + Math.round((t.getTime() - week1Monday.getTime()) / (7 * 86_400_000));
  return { year, week };
}

/**
 * List the distinct (year, isoWeek) pairs covered by a planning range.
 * Used to scope the luxlait_weekly_machine_closed_shifts query.
 */
function listIsoWeeksInRange(from: Date, to: Date): Array<{ year: number; week: number }> {
  const seen = new Set<string>();
  const out: Array<{ year: number; week: number }> = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const { year, week } = isoWeekUtc(cursor);
    const k = `${year}|${week}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ year, week });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * Expand luxlait_weekly_machine_closed_shifts rows into concrete dated
 * (machine, date, time_slot) closures within [from, to].
 *
 * Each row carries (year, isoWeek, weekday, machineId, timeSlotId) where
 * weekday matches JavaScript getDay (0 = Sunday). A given calendar day is
 * closed for that machine and slot if its (isoWeekUtc.year, isoWeekUtc.week,
 * UTC weekday) matches the row.
 */
function expandWeeklyClosedShifts(
  from: Date,
  to: Date,
  rows: Array<{ machineId: string; year: number; isoWeek: number; weekday: number; timeSlotId: string }>
): Array<{ machine_id: string; day_date: string; time_slot_id: string }> {
  if (!rows.length) return [];

  const byKey = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = `${r.year}|${r.isoWeek}|${r.weekday}|${r.machineId}`;
    if (!byKey.has(key)) byKey.set(key, new Set<string>());
    byKey.get(key)!.add(r.timeSlotId);
  }

  const out: Array<{ machine_id: string; day_date: string; time_slot_id: string }> = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const weekday = cursor.getUTCDay();
    const { year, week } = isoWeekUtc(cursor);
    const dayDate = toYYYYMMDD(cursor);
    for (const [key, slots] of byKey.entries()) {
      const [yearStr, weekStr, wdStr, machineId] = key.split('|');
      if (Number(yearStr) !== year) continue;
      if (Number(weekStr) !== week) continue;
      if (Number(wdStr) !== weekday) continue;
      for (const timeSlotId of slots) {
        out.push({ machine_id: machineId, day_date: dayDate, time_slot_id: timeSlotId });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

const SOLVER_SETTING_KEYS = {
  fairnessWeight: "planning_solver_fairness_weight",
  priorityMachineWeight: "planning_solver_priority_machine_weight",
  solveTimeLimitSeconds: "planning_solver_solve_time_limit_seconds",
  enforceTimeSlotWhenAssigned: "planning_solver_enforce_time_slot_when_assigned",
  stabilityWeight: "planning_solver_stability_weight",
  maxWorkDaysPerWeek: "planning_solver_max_work_days_per_week",
  minRestDaysPerWeek: "planning_solver_min_rest_days_per_week",
  maxConsecutiveWorkDays: "planning_solver_max_consecutive_work_days",
} as const;

function readNumberFromProviderConfig(config: unknown, defaultValue: number): number {
  if (typeof config === "number" && Number.isFinite(config)) return config;
  if (config && typeof config === "object" && "value" in config) {
    const v = (config as any).value;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return defaultValue;
}

function readBooleanFromProviderConfig(config: unknown, defaultValue: boolean): boolean {
  if (typeof config === "boolean") return config;
  if (config && typeof config === "object" && "value" in config) {
    const v = (config as any).value;
    if (typeof v === "boolean") return v;
  }
  return defaultValue;
}

function isManager(roles: string[] | undefined): boolean {
  const normalized = (roles ?? []).map((r) => String(r).toLowerCase());
  return normalized.some((r) => r.includes("manager") || r.includes("admin"));
}

async function getActiveEmployees() {
  return prisma.luxlaitEmployee.findMany({
    where: { active: true },
    orderBy: { lastName: "asc" },
  });
}

router.post("/auto_plan", async (req: Request, res: Response) => {
  try {
    if (!isManager(req.userRoles)) {
      res.status(403).json({ error: "Forbidden: admin or manager role required" });
      return;
    }

    const body = req.body as {
      fromDate: string;
      toDate: string;
      constraints?: {
        fairness_weight?: number;
        priority_machine_weight?: number;
        solve_time_limit_seconds?: number;
        enforce_time_slot_when_assigned?: boolean;
      };
      lockExisting?: boolean;
      replanFromDate?: string;
    };

    const isReplan = !!body?.replanFromDate;

    if (!isReplan && (!body?.fromDate || !body?.toDate)) {
      res.status(400).json({ error: "fromDate and toDate are required" });
      return;
    }

    let from: Date;
    let to: Date;
    let replanBoundary: Date | null = null;

    if (isReplan) {
      replanBoundary = parseYYYYMMDD(body.replanFromDate!);
      if (Number.isNaN(replanBoundary.getTime())) {
        res.status(400).json({ error: "Invalid replanFromDate format" });
        return;
      }
      const monthStart = new Date(Date.UTC(replanBoundary.getUTCFullYear(), replanBoundary.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(replanBoundary.getUTCFullYear(), replanBoundary.getUTCMonth() + 1, 0));
      from = monthStart;
      to = monthEnd;
    } else {
      from = parseYYYYMMDD(body.fromDate);
      to = parseYYYYMMDD(body.toDate);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        res.status(400).json({ error: "Invalid fromDate or toDate format" });
        return;
      }
    }

    const lockExisting = isReplan ? true : (body.lockExisting ?? true);

    const t0 = performance.now();

    const isoWeekKeys = listIsoWeeksInRange(from, to);

    const [
      employees,
      machines,
      openShifts,
      skills,
      timeSlots,
      unavailableDays,
      unavailableShiftRows,
      machineDowntimes,
      machineDowntimeShifts,
      weeklyMachineClosedShifts,
      staffingRequirements,
      settings,
      existingAssignments,
    ] = await Promise.all([
      getActiveEmployees(),
      prisma.luxlaitMachine.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.luxlaitMachineOpenShift.findMany(),
      prisma.luxlaitEmployeeMachineSkill.findMany(),
      prisma.luxlaitTimeSlot.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.luxlaitWeeklyEmployeeStatus.findMany({
        where: { dayDate: { gte: from, lte: to } },
      }),
      prisma.luxlaitWeeklyEmployeeShiftStatus.findMany({
        where: { dayDate: { gte: from, lte: to } },
      }),
      prisma.luxlaitMachineDowntime.findMany({
        where: { dayDate: { gte: from, lte: to } },
      }),
      prisma.luxlaitMachineDowntimeShift.findMany({
        where: { dayDate: { gte: from, lte: to } },
      }),
      isoWeekKeys.length
        ? prisma.luxlaitWeeklyMachineClosedShift.findMany({
            where: {
              OR: isoWeekKeys.map(({ year, week }) => ({ year, isoWeek: week })),
            },
          })
        : Promise.resolve([] as Array<{
            machineId: string;
            year: number;
            isoWeek: number;
            weekday: number;
            timeSlotId: string;
          }>),
      prisma.luxlaitMachineStaffingRequirement.findMany({
        where: { dayDate: GLOBAL_SHIFT_MIN_DATE },
      }),
      prisma.systemSettings.findMany({
        where: {
          settingKey: {
            in: [
              SOLVER_SETTING_KEYS.fairnessWeight,
              SOLVER_SETTING_KEYS.priorityMachineWeight,
              SOLVER_SETTING_KEYS.solveTimeLimitSeconds,
              SOLVER_SETTING_KEYS.enforceTimeSlotWhenAssigned,
              SOLVER_SETTING_KEYS.stabilityWeight,
              SOLVER_SETTING_KEYS.maxWorkDaysPerWeek,
              SOLVER_SETTING_KEYS.minRestDaysPerWeek,
              SOLVER_SETTING_KEYS.maxConsecutiveWorkDays,
            ],
          },
        },
      }),
      (lockExisting || isReplan)
        ? prisma.luxlaitDailyAssignment.findMany({
            where: { dayDate: { gte: from, lte: to } },
          })
        : Promise.resolve([]),
    ]);

    const t1 = performance.now();

    const settingByKey = new Map(
      (settings as any[]).map((s) => [s.settingKey as string, s.providerConfig] as const)
    );

    const dbFairnessWeight = readNumberFromProviderConfig(
      settingByKey.get(SOLVER_SETTING_KEYS.fairnessWeight),
      1
    );
    const dbSolveTimeLimitSeconds = readNumberFromProviderConfig(
      settingByKey.get(SOLVER_SETTING_KEYS.solveTimeLimitSeconds),
      30
    );
    const dbEnforceTimeSlotWhenAssigned = readBooleanFromProviderConfig(
      settingByKey.get(SOLVER_SETTING_KEYS.enforceTimeSlotWhenAssigned),
      true
    );

    const dbPriorityMachineWeight = readNumberFromProviderConfig(
      settingByKey.get(SOLVER_SETTING_KEYS.priorityMachineWeight),
      50
    );
    const dbStabilityWeight = readNumberFromProviderConfig(
      settingByKey.get(SOLVER_SETTING_KEYS.stabilityWeight),
      100
    );
    const dbMaxWorkDaysPerWeek = readNumberFromProviderConfig(
      settingByKey.get(SOLVER_SETTING_KEYS.maxWorkDaysPerWeek),
      6
    );
    const dbMinRestDaysPerWeek = readNumberFromProviderConfig(
      settingByKey.get(SOLVER_SETTING_KEYS.minRestDaysPerWeek),
      1
    );
    const dbMaxConsecutiveWorkDays = readNumberFromProviderConfig(
      settingByKey.get(SOLVER_SETTING_KEYS.maxConsecutiveWorkDays),
      6
    );

    const openShiftsByMachineId: Record<string, string[]> = {};
    for (const os of openShifts) {
      if (!openShiftsByMachineId[os.machineId]) openShiftsByMachineId[os.machineId] = [];
      openShiftsByMachineId[os.machineId]!.push(os.timeSlotId);
    }

    const downtimesByMachineId: Record<string, string[]> = {};
    for (const dt of machineDowntimes) {
      if (!downtimesByMachineId[dt.machineId]) downtimesByMachineId[dt.machineId] = [];
      downtimesByMachineId[dt.machineId]!.push(dt.dayDate.toISOString().slice(0, 10));
    }

    /*
     * Recurring weekday closures are now driven by luxlait_weekly_machine_closed_shifts
     * (per ISO week, per shift). The legacy luxlait_machine_closed_weekday and
     * luxlait_machine_closed_weekday_shift tables are no longer consumed by the solver.
     * Full day closures still come from luxlait_machine_downtimes (one off events).
     */
    const mergedDowntimesByMachineId: Record<string, string[]> = {};
    for (const m of machines) {
      const dated = downtimesByMachineId[m.id] ?? [];
      mergedDowntimesByMachineId[m.id] = [...new Set(dated)].sort();
    }
    const planningDates = listDateRange(from, to);

    const expandedWeeklyClosedShifts = expandWeeklyClosedShifts(
      from,
      to,
      weeklyMachineClosedShifts,
    );
    const machineClosedShifts = [
      ...machineDowntimeShifts.map((row) => ({
        machine_id: row.machineId,
        day_date: row.dayDate.toISOString().slice(0, 10),
        time_slot_id: row.timeSlotId,
      })),
      ...expandedWeeklyClosedShifts,
    ];
    const closedShiftKeySet = new Set(
      machineClosedShifts.map((row) => `${row.machine_id}|${row.day_date}|${row.time_slot_id}`)
    );
    const machineDowntimeDayKeySet = new Set(
      machines.flatMap((m) => (mergedDowntimesByMachineId[m.id] ?? []).map((dayDate) => `${m.id}|${dayDate}`))
    );
    const expandedMinRequirements = staffingRequirements.flatMap((row) =>
      planningDates
        .map((dayDate) => ({
          machine_id: row.machineId,
          day_date: dayDate,
          time_slot_id: row.timeSlotId,
          min_employees: row.minEmployees,
        }))
        .filter((reqRow) => {
          const shiftKey = `${reqRow.machine_id}|${reqRow.day_date}|${reqRow.time_slot_id}`;
          const dayKey = `${reqRow.machine_id}|${reqRow.day_date}`;
          return !closedShiftKeySet.has(shiftKey) && !machineDowntimeDayKeySet.has(dayKey);
        })
    );
    const unavailableShifts = unavailableShiftRows.map((row) => ({
      employee_id: row.employeeId,
      day_date: row.dayDate.toISOString().slice(0, 10),
      time_slot_id: row.timeSlotId,
      status_id: row.statusId,
    }));

    const allAssignmentRows = (existingAssignments as any[]).map((a) => ({
      day_date: a.dayDate.toISOString().slice(0, 10),
      employee_id: a.employeeId,
      machine_id: a.machineId,
      time_slot_id: a.timeSlotId,
    }));

    let lockedAssignmentRows = allAssignmentRows;
    let referenceAssignmentRows: typeof allAssignmentRows = [];
    let freedPairs = new Set<string>();
    let affectedDays = new Set<string>();

    if (!isReplan && lockExisting) {
      const assignedCountByShift = new Map<string, number>();
      for (const a of allAssignmentRows) {
        if (!a.time_slot_id) continue;
        const key = `${a.day_date}|${a.machine_id}|${a.time_slot_id}`;
        assignedCountByShift.set(key, (assignedCountByShift.get(key) ?? 0) + 1);
      }

      const deficitDays = new Set<string>();
      for (const reqRow of expandedMinRequirements) {
        const key = `${reqRow.day_date}|${reqRow.machine_id}|${reqRow.time_slot_id}`;
        const assigned = assignedCountByShift.get(key) ?? 0;
        if (assigned < reqRow.min_employees) {
          deficitDays.add(reqRow.day_date);
        }
      }

      if (deficitDays.size > 0) {
        lockedAssignmentRows = allAssignmentRows.filter((a) => !deficitDays.has(a.day_date));
        referenceAssignmentRows = allAssignmentRows.filter((a) => deficitDays.has(a.day_date));
      }
    }

    if (isReplan && replanBoundary) {
      const boundaryStr = replanBoundary.toISOString().slice(0, 10);

      const beforeBoundary = allAssignmentRows.filter((a) => a.day_date < boundaryStr);
      const afterBoundary = allAssignmentRows.filter((a) => a.day_date >= boundaryStr);

      const assignmentCreatedAt = new Map<string, Date>();
      for (const a of existingAssignments as any[]) {
        const dayStr = a.dayDate.toISOString().slice(0, 10);
        assignmentCreatedAt.set(`${a.employeeId}|${dayStr}`, a.createdAt);
      }

      const statusCreatedAt = new Map<string, Date>();
      for (const u of unavailableDays) {
        const dayStr = (u as any).dayDate.toISOString().slice(0, 10);
        statusCreatedAt.set(`${(u as any).employeeId}|${dayStr}`, (u as any).createdAt);
      }

      const shiftStatusCreatedAt = new Map<string, Date>();
      for (const u of unavailableShiftRows) {
        const dayStr = (u as any).dayDate.toISOString().slice(0, 10);
        shiftStatusCreatedAt.set(`${(u as any).employeeId}|${dayStr}|${(u as any).timeSlotId}`, (u as any).createdAt);
      }

      freedPairs = new Set<string>();
      affectedDays = new Set<string>();

      for (const a of afterBoundary) {
        const empDayKey = `${a.employee_id}|${a.day_date}`;
        const aCreated = assignmentCreatedAt.get(empDayKey);

        const sCreated = statusCreatedAt.get(empDayKey);
        if (sCreated && aCreated && sCreated > aCreated) {
          freedPairs.add(empDayKey);
          affectedDays.add(a.day_date);
          continue;
        }

        if (a.time_slot_id) {
          const shiftKey = `${a.employee_id}|${a.day_date}|${a.time_slot_id}`;
          const shCreated = shiftStatusCreatedAt.get(shiftKey);
          if (shCreated && aCreated && shCreated > aCreated) {
            freedPairs.add(empDayKey);
            affectedDays.add(a.day_date);
          }
        }
      }

      for (const a of afterBoundary) {
        if (affectedDays.has(a.day_date)) {
          freedPairs.add(`${a.employee_id}|${a.day_date}`);
        }
      }

      if (freedPairs.size > 0) {
        lockedAssignmentRows = [
          ...beforeBoundary,
          ...afterBoundary.filter((a) => !freedPairs.has(`${a.employee_id}|${a.day_date}`)),
        ];
        referenceAssignmentRows = afterBoundary.filter((a) => freedPairs.has(`${a.employee_id}|${a.day_date}`));
      } else {
        /* No status-after-assignment conflicts: still replan from the boundary onward.
           Lock only days before the boundary; current plan from the boundary date on
           becomes reference (stability objective + hints), not hard-locked rows. */
        lockedAssignmentRows = beforeBoundary;
        referenceAssignmentRows = afterBoundary;
      }
    }

    // ── Boundary assignments ──────────────────────────────────────────────────
    // Fetch assignments from days that are outside [from, to] but belong to
    // the same ISO week as the start or end of the planning window (partial
    // boundary weeks). The solver uses them to count already-worked days
    // toward weekly and consecutive caps without re-planning those days.
    const getMondayOfIsoWeek = (d: Date): Date => {
      const dow = (d.getUTCDay() + 6) % 7; // 0 = Mon … 6 = Sun
      const m = new Date(d);
      m.setUTCDate(d.getUTCDate() - dow);
      return m;
    };
    const getSundayOfIsoWeek = (d: Date): Date => {
      const dow = (d.getUTCDay() + 6) % 7;
      const s = new Date(d);
      s.setUTCDate(d.getUTCDate() + (6 - dow));
      return s;
    };

    const weekStart = getMondayOfIsoWeek(from);
    const weekEnd = getSundayOfIsoWeek(to);

    const boundaryDates: Date[] = [];
    // Pre-window days: Monday of start-week up to day before `from`
    for (const cur = new Date(weekStart); cur < from; cur.setUTCDate(cur.getUTCDate() + 1)) {
      boundaryDates.push(new Date(cur));
    }
    // Post-window days: day after `to` up to Sunday of end-week
    const dayAfterTo = new Date(to);
    dayAfterTo.setUTCDate(to.getUTCDate() + 1);
    for (const cur = new Date(dayAfterTo); cur <= weekEnd; cur.setUTCDate(cur.getUTCDate() + 1)) {
      boundaryDates.push(new Date(cur));
    }

    let boundaryAssignmentRows: Array<{
      day_date: string;
      employee_id: string;
      machine_id: string;
      time_slot_id: string | null;
    }> = [];

    if (boundaryDates.length > 0) {
      const minBoundary = boundaryDates[0]!;
      const maxBoundary = boundaryDates[boundaryDates.length - 1]!;
      const rawBoundary = await prisma.luxlaitDailyAssignment.findMany({
        where: { dayDate: { gte: minBoundary, lte: maxBoundary } },
      });
      boundaryAssignmentRows = (rawBoundary as any[]).map((a) => ({
        day_date: (a.dayDate as Date).toISOString().slice(0, 10),
        employee_id: a.employeeId,
        machine_id: a.machineId,
        time_slot_id: a.timeSlotId ?? null,
      }));
    }

    const solverFromDate = isReplan ? from.toISOString().slice(0, 10) : body.fromDate;
    const solverToDate = isReplan ? to.toISOString().slice(0, 10) : body.toDate;

    const solverRequest = {
      from_date: solverFromDate,
      to_date: solverToDate,
      employees: employees.map((e) => ({
        id: e.id,
        is_backup: e.isBackup,
      })),
      machines: machines.map((m) => ({
        id: m.id,
        max_employees: m.maxEmployees,
        importance: m.importance ?? "OPTIONAL",
        open_time_slot_ids: openShiftsByMachineId[m.id] ?? [],
        downtime_dates: mergedDowntimesByMachineId[m.id] ?? [],
      })),
      skills: skills.map((sk) => ({
        employee_id: sk.employeeId,
        machine_id: sk.machineId,
        level: sk.level,
      })),
      time_slots: timeSlots.map((ts) => ({
        id: ts.id,
        name: ts.name,
        short_name: ts.shortName,
        color: ts.color,
        sort_order: ts.sortOrder,
      })),
      unavailable_days: unavailableDays.map((es) => ({
        employee_id: es.employeeId,
        day_date: es.dayDate.toISOString().slice(0, 10),
        status_id: es.statusId,
      })),
      unavailable_shifts: unavailableShifts,
      machine_closed_shifts: machineClosedShifts,
      machine_shift_min_requirements: expandedMinRequirements,
      existing_assignments: lockedAssignmentRows,
      reference_assignments: referenceAssignmentRows,
      boundary_assignments: boundaryAssignmentRows,
      constraints: {
        fairness_weight: body.constraints?.fairness_weight ?? dbFairnessWeight,
        priority_machine_weight:
          body.constraints?.priority_machine_weight ?? dbPriorityMachineWeight,
        solve_time_limit_seconds:
          body.constraints?.solve_time_limit_seconds ?? dbSolveTimeLimitSeconds,
        enforce_time_slot_when_assigned:
          body.constraints?.enforce_time_slot_when_assigned ?? dbEnforceTimeSlotWhenAssigned,
        stability_weight: isReplan ? dbStabilityWeight : 0,
        max_work_days_per_week: dbMaxWorkDaysPerWeek,
        min_rest_days_per_week: dbMinRestDaysPerWeek,
        max_consecutive_work_days: dbMaxConsecutiveWorkDays,
      },
    };

    const t2 = performance.now();

    const solverUrl = process.env.SOLVER_SERVICE_URL ?? "http://solver_service:8000";
    const solverSecret = process.env.SOLVER_SERVICE_SECRET;

    const response = await fetch(`${solverUrl}/solve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(solverSecret ? { "x-solver-secret": solverSecret } : {}),
      },
      body: JSON.stringify(solverRequest),
    });

    let json: any = null;
    try {
      json = (await response.json()) as any;
    } catch {
      const text = await response.text().catch(() => "");
      res.status(response.status >= 500 ? 502 : 500).json({
        ok: false,
        error: "Solver returned non JSON response",
        solverHttpStatus: response.status,
        solverBodyPreview: text.slice(0, 500),
      });
      return;
    }

    if (!response.ok) {
      res.status(response.status >= 500 ? 502 : 500).json({
        ok: false,
        error: "Solver request failed",
        solverHttpStatus: response.status,
        solverBodyPreview: json?.error ?? json ?? null,
      });
      return;
    }

    const t3 = performance.now();

    if (!json?.ok) {
      res.status(200).json(json);
      return;
    }

    json.timingMs = {
      dbQueries: Math.round(t1 - t0),
      dataTransform: Math.round(t2 - t1),
      solverRoundTrip: Math.round(t3 - t2),
      total: Math.round(t3 - t0),
    };

    if (isReplan && replanBoundary) {
      const boundaryStr = replanBoundary.toISOString().slice(0, 10);
      const solverAssignments: any[] = json.assignments ?? [];

      const existingByEmpDay = new Map<string, { machine_id: string; time_slot_id: string | null }>();
      for (const a of existingAssignments as any[]) {
        const dayDate = a.dayDate.toISOString().slice(0, 10);
        if (dayDate < boundaryStr) continue;
        existingByEmpDay.set(`${a.employeeId}|${dayDate}`, {
          machine_id: a.machineId,
          time_slot_id: a.timeSlotId ?? null,
        });
      }

      json.assignments = solverAssignments.filter((a: any) => a.day_date >= boundaryStr);

      const changesCount = json.assignments.filter((a: any) => {
        const key = `${a.employee_id}|${a.day_date}`;
        const existing = existingByEmpDay.get(key);
        if (!existing) return true;
        const proposedTs = a.time_slot_id ?? null;
        return existing.machine_id !== a.machine_id || existing.time_slot_id !== proposedTs;
      }).length;

      json.replanDebug = {
        directConflicts: [...affectedDays].length,
        affectedDays: [...affectedDays].sort(),
        freedPairsCount: freedPairs.size,
        referencesSent: referenceAssignmentRows.length,
        solverReturnedTotal: solverAssignments.length,
        assignmentsForAffectedDays: json.assignments.length,
        actualChanges: changesCount,
      };
    }

    res.status(200).json(json);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Unexpected error" });
  }
});

export default router;

