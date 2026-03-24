import express, { Request, Response } from "express";
import prisma from "../lib/prisma";

const router = express.Router();

const parseYYYYMMDD = (s: string): Date => new Date(`${s}T00:00:00.000Z`);

const SOLVER_SETTING_KEYS = {
  fairnessWeight: "planning_solver_fairness_weight",
  priorityMachineWeight: "planning_solver_priority_machine_weight",
  solveTimeLimitSeconds: "planning_solver_solve_time_limit_seconds",
  enforceTimeSlotWhenAssigned: "planning_solver_enforce_time_slot_when_assigned",
  closedWeekdays: "planning_closed_weekdays",
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

function parseClosedWeekdays(config: unknown): number[] {
  const raw = Array.isArray(config)
    ? config
    : config && typeof config === "object" && "value" in config
      ? (config as any).value
      : [];
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    )
  ).sort((a, b) => a - b);
}

function listDatesInRange(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
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
    };

    if (!body?.fromDate || !body?.toDate) {
      res.status(400).json({ error: "fromDate and toDate are required" });
      return;
    }

    const from = parseYYYYMMDD(body.fromDate);
    const to = parseYYYYMMDD(body.toDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      res.status(400).json({ error: "Invalid fromDate or toDate format" });
      return;
    }

    const lockExisting = body.lockExisting ?? true;

    const [
      employees,
      machines,
      openShifts,
      skills,
      timeSlots,
      unavailableDays,
      machineDowntimes,
      closedDaysByDate,
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
      prisma.luxlaitMachineDowntime.findMany({
        where: { dayDate: { gte: from, lte: to } },
      }),
      prisma.$queryRawUnsafe<Array<{ day_date: Date }>>(
        `SELECT day_date
         FROM luxlait_closed_days
         WHERE day_date >= $1::date AND day_date <= $2::date`,
        body.fromDate,
        body.toDate
      ),
      prisma.systemSettings.findMany({
        where: {
          settingKey: {
            in: [
              SOLVER_SETTING_KEYS.fairnessWeight,
              SOLVER_SETTING_KEYS.priorityMachineWeight,
              SOLVER_SETTING_KEYS.solveTimeLimitSeconds,
              SOLVER_SETTING_KEYS.enforceTimeSlotWhenAssigned,
              SOLVER_SETTING_KEYS.closedWeekdays,
            ],
          },
        },
      }),
      lockExisting
        ? prisma.luxlaitDailyAssignment.findMany({
            where: { dayDate: { gte: from, lte: to } },
          })
        : Promise.resolve([]),
    ]);

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
    const closedWeekdays = parseClosedWeekdays(
      settingByKey.get(SOLVER_SETTING_KEYS.closedWeekdays)
    );

    const closedDaySet = new Set<string>(
      (closedDaysByDate as Array<{ day_date: Date }>).map((d) =>
        new Date(d.day_date).toISOString().slice(0, 10)
      )
    );
    if (closedWeekdays.length > 0) {
      const weekdaySet = new Set(closedWeekdays);
      for (const dateText of listDatesInRange(from, to)) {
        const day = new Date(`${dateText}T00:00:00.000Z`).getUTCDay();
        if (weekdaySet.has(day)) closedDaySet.add(dateText);
      }
    }

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

    const solverRequest = {
      from_date: body.fromDate,
      to_date: body.toDate,
      employees: employees.map((e) => ({
        id: e.id,
        is_backup: e.isBackup,
      })),
      machines: machines.map((m) => ({
        id: m.id,
        max_employees: m.maxEmployees,
        importance: m.importance ?? "OPTIONAL",
        open_time_slot_ids: openShiftsByMachineId[m.id] ?? [],
        downtime_dates: downtimesByMachineId[m.id] ?? [],
      })),
      skills: skills.map((sk) => ({
        employee_id: sk.employeeId,
        machine_id: sk.machineId,
      })),
      time_slots: timeSlots.map((ts) => ({
        id: ts.id,
        name: ts.name,
        short_name: ts.shortName,
        color: ts.color,
      })),
      unavailable_days: unavailableDays.map((es) => ({
        employee_id: es.employeeId,
        day_date: es.dayDate.toISOString().slice(0, 10),
        status_id: es.statusId,
      })),
      existing_assignments: (existingAssignments as any[]).map((a) => ({
        day_date: a.dayDate.toISOString().slice(0, 10),
        employee_id: a.employeeId,
        machine_id: a.machineId,
        time_slot_id: a.timeSlotId,
      })),
      closed_days: Array.from(closedDaySet).sort(),
      constraints: {
        fairness_weight: body.constraints?.fairness_weight ?? dbFairnessWeight,
        priority_machine_weight:
          body.constraints?.priority_machine_weight ?? dbPriorityMachineWeight,
        solve_time_limit_seconds:
          body.constraints?.solve_time_limit_seconds ?? dbSolveTimeLimitSeconds,
        enforce_time_slot_when_assigned:
          body.constraints?.enforce_time_slot_when_assigned ?? dbEnforceTimeSlotWhenAssigned,
      },
    };

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

    if (!json?.ok) {
      // Important: return HTTP 200 so the browser does not treat this as a network failure.
      res.status(200).json(json);
      return;
    }

    res.status(200).json(json);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Unexpected error" });
  }
});

export default router;

