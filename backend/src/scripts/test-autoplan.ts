/**
 * Stand alone autoplan smoke test.
 *
 * Replicates the data shaping done by routes/autoplan.ts then calls the
 * solver_service /solve endpoint several times with different constraint
 * profiles so we can pinpoint which limit (if any) makes the model
 * infeasible.
 *
 * Run with: docker compose exec backend npx ts-node src/scripts/test-autoplan.ts
 */
import prisma from "../lib/prisma";

const SOLVER_URL = process.env.SOLVER_SERVICE_URL ?? "http://solver_service:8000";
const SOLVER_SECRET = process.env.SOLVER_SERVICE_SECRET;

const parseYYYYMMDD = (s: string): Date => new Date(`${s}T00:00:00.000Z`);
const toYYYYMMDD = (d: Date): string => d.toISOString().slice(0, 10);
const GLOBAL_SHIFT_MIN_DATE = parseYYYYMMDD("1970-01-01");

const listDateRange = (from: Date, to: Date): string[] => {
  const out: string[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    out.push(toYYYYMMDD(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
};

const isoWeekUtc = (d: Date): { year: number; week: number } => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dow + 3);
  const year = t.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(Date.UTC(year, 0, 4 - jan4Dow));
  const week = 1 + Math.round((t.getTime() - week1Monday.getTime()) / (7 * 86_400_000));
  return { year, week };
};

const listIsoWeeks = (from: Date, to: Date) => {
  const seen = new Set<string>();
  const out: Array<{ year: number; week: number }> = [];
  const cur = new Date(from);
  while (cur <= to) {
    const { year, week } = isoWeekUtc(cur);
    const k = `${year}|${week}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ year, week });
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
};

const expandWeeklyClosedShifts = (
  from: Date,
  to: Date,
  rows: Array<{ machineId: string; year: number; isoWeek: number; weekday: number; timeSlotId: string }>,
) => {
  const out: Array<{ machine_id: string; day_date: string; time_slot_id: string }> = [];
  const cur = new Date(from);
  while (cur <= to) {
    const { year, week } = isoWeekUtc(cur);
    const wd = cur.getUTCDay();
    const dayDate = toYYYYMMDD(cur);
    for (const r of rows) {
      if (r.year === year && r.isoWeek === week && r.weekday === wd) {
        out.push({ machine_id: r.machineId, day_date: dayDate, time_slot_id: r.timeSlotId });
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
};

interface SolveResponse {
  ok: boolean;
  assignments: Array<{ employee_id: string; machine_id: string; day_date: string; time_slot_id: string }>;
  stats?: Record<string, unknown>;
  error?: string;
}

const callSolver = async (request: unknown): Promise<SolveResponse> => {
  const res = await fetch(`${SOLVER_URL}/solve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(SOLVER_SECRET ? { "x-solver-secret": SOLVER_SECRET } : {}),
    },
    body: JSON.stringify(request),
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as SolveResponse;
  } catch {
    throw new Error(`Non JSON response (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
};

const main = async () => {
  const fromDate = process.argv[2] ?? "2026-05-01";
  const toDate = process.argv[3] ?? "2026-05-31";
  const lockExisting = process.argv[4] !== "free";

  const from = parseYYYYMMDD(fromDate);
  const to = parseYYYYMMDD(toDate);

  console.log(`\n=== AUTOPLAN SMOKE TEST ${fromDate} → ${toDate} (lockExisting=${lockExisting}) ===\n`);

  const isoKeys = listIsoWeeks(from, to);

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
    existingAssignments,
  ] = await Promise.all([
    prisma.luxlaitEmployee.findMany({ where: { active: true }, orderBy: { lastName: "asc" } }),
    prisma.luxlaitMachine.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.luxlaitMachineOpenShift.findMany(),
    prisma.luxlaitEmployeeMachineSkill.findMany(),
    prisma.luxlaitTimeSlot.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.luxlaitWeeklyEmployeeStatus.findMany({ where: { dayDate: { gte: from, lte: to } } }),
    prisma.luxlaitWeeklyEmployeeShiftStatus.findMany({ where: { dayDate: { gte: from, lte: to } } }),
    prisma.luxlaitMachineDowntime.findMany({ where: { dayDate: { gte: from, lte: to } } }),
    prisma.luxlaitMachineDowntimeShift.findMany({ where: { dayDate: { gte: from, lte: to } } }),
    isoKeys.length
      ? prisma.luxlaitWeeklyMachineClosedShift.findMany({
          where: { OR: isoKeys.map(({ year, week }) => ({ year, isoWeek: week })) },
        })
      : Promise.resolve([] as Array<{
          machineId: string;
          year: number;
          isoWeek: number;
          weekday: number;
          timeSlotId: string;
        }>),
    prisma.luxlaitMachineStaffingRequirement.findMany({ where: { dayDate: GLOBAL_SHIFT_MIN_DATE } }),
    lockExisting
      ? prisma.luxlaitDailyAssignment.findMany({ where: { dayDate: { gte: from, lte: to } } })
      : Promise.resolve([]),
  ]);

  const planningDates = listDateRange(from, to);
  const expandedClosed = expandWeeklyClosedShifts(from, to, weeklyMachineClosedShifts);

  const openByMachine: Record<string, string[]> = {};
  for (const o of openShifts) {
    (openByMachine[o.machineId] ??= []).push(o.timeSlotId);
  }

  const downtimesByMachine: Record<string, string[]> = {};
  for (const dt of machineDowntimes) {
    (downtimesByMachine[dt.machineId] ??= []).push(toYYYYMMDD(dt.dayDate));
  }

  const machineClosedShifts = [
    ...machineDowntimeShifts.map((row) => ({
      machine_id: row.machineId,
      day_date: toYYYYMMDD(row.dayDate),
      time_slot_id: row.timeSlotId,
    })),
    ...expandedClosed,
  ];
  const closedShiftKeySet = new Set(machineClosedShifts.map((r) => `${r.machine_id}|${r.day_date}|${r.time_slot_id}`));
  const downtimeDayKeySet = new Set(
    machines.flatMap((m) => (downtimesByMachine[m.id] ?? []).map((dd) => `${m.id}|${dd}`)),
  );

  const expandedMin = staffingRequirements
    .flatMap((row) =>
      planningDates.map((dayDate) => ({
        machine_id: row.machineId,
        day_date: dayDate,
        time_slot_id: row.timeSlotId,
        min_employees: row.minEmployees,
      })),
    )
    .filter((req) => {
      const sk = `${req.machine_id}|${req.day_date}|${req.time_slot_id}`;
      const dk = `${req.machine_id}|${req.day_date}`;
      return !closedShiftKeySet.has(sk) && !downtimeDayKeySet.has(dk);
    });

  const totalShiftDemand = expandedMin.reduce((s, r) => s + r.min_employees, 0);
  console.log(`Employees active=${employees.length}  Machines=${machines.length}  Skills=${skills.length}`);
  console.log(`Planning days=${planningDates.length}  Closed shifts=${machineClosedShifts.length}`);
  console.log(`Total min staffing demand (closures applied) = ${totalShiftDemand} employee-days`);
  console.log(
    `Locked existing assignments=${existingAssignments.length} (lockExisting=${lockExisting})`,
  );

  // Per ISO week capacity vs demand sanity check.
  const demandByWeek = new Map<string, number>();
  for (const r of expandedMin) {
    const d = parseYYYYMMDD(r.day_date);
    const k = `${isoWeekUtc(d).year}|${isoWeekUtc(d).week}`;
    demandByWeek.set(k, (demandByWeek.get(k) ?? 0) + r.min_employees);
  }
  console.log(`\nWeek demand vs employee capacity (35 emps × 5 d/w = 175):`);
  for (const [k, v] of [...demandByWeek.entries()].sort()) {
    console.log(`  week ${k}: demand=${v}  ratio=${(v / 175).toFixed(2)}`);
  }

  const buildRequest = (constraints: Record<string, number | boolean>) => ({
    from_date: fromDate,
    to_date: toDate,
    employees: employees.map((e) => ({ id: e.id, is_backup: e.isBackup })),
    machines: machines.map((m) => ({
      id: m.id,
      max_employees: m.maxEmployees,
      importance: m.importance ?? "OPTIONAL",
      open_time_slot_ids: openByMachine[m.id] ?? [],
      downtime_dates: downtimesByMachine[m.id] ?? [],
    })),
    skills: skills.map((s) => ({ employee_id: s.employeeId, machine_id: s.machineId, level: s.level })),
    time_slots: timeSlots.map((ts) => ({
      id: ts.id,
      name: ts.name,
      short_name: ts.shortName,
      color: ts.color,
      sort_order: ts.sortOrder,
    })),
    unavailable_days: unavailableDays.map((u) => ({
      employee_id: u.employeeId,
      day_date: toYYYYMMDD(u.dayDate),
      status_id: u.statusId,
    })),
    unavailable_shifts: unavailableShiftRows.map((u) => ({
      employee_id: u.employeeId,
      day_date: toYYYYMMDD(u.dayDate),
      time_slot_id: u.timeSlotId,
      status_id: u.statusId,
    })),
    machine_closed_shifts: machineClosedShifts,
    machine_shift_min_requirements: expandedMin,
    existing_assignments: lockExisting
      ? (existingAssignments as any[]).map((a) => ({
          day_date: toYYYYMMDD(a.dayDate),
          employee_id: a.employeeId,
          machine_id: a.machineId,
          time_slot_id: a.timeSlotId ?? null,
        }))
      : [],
    reference_assignments: [],
    constraints: {
      fairness_weight: 1,
      priority_machine_weight: 50,
      solve_time_limit_seconds: 30,
      enforce_time_slot_when_assigned: true,
      stability_weight: 0,
      ...constraints,
    },
  });

  const profiles: Array<{ name: string; constraints: Record<string, number | boolean> }> = [
    { name: "no caps", constraints: { max_work_days_per_week: 0, min_rest_days_per_week: 0, max_consecutive_work_days: 0 } },
    { name: "max_work=6", constraints: { max_work_days_per_week: 6, min_rest_days_per_week: 0, max_consecutive_work_days: 0 } },
    { name: "max_work=7 only", constraints: { max_work_days_per_week: 7, min_rest_days_per_week: 0, max_consecutive_work_days: 0 } },
    { name: "max_consec=10", constraints: { max_work_days_per_week: 0, min_rest_days_per_week: 0, max_consecutive_work_days: 10 } },
    { name: "max_consec=14", constraints: { max_work_days_per_week: 0, min_rest_days_per_week: 0, max_consecutive_work_days: 14 } },
    { name: "max_work=6, max_consec=6", constraints: { max_work_days_per_week: 6, min_rest_days_per_week: 0, max_consecutive_work_days: 6 } },
    { name: "DB defaults (6/1/6)", constraints: { max_work_days_per_week: 6, min_rest_days_per_week: 1, max_consecutive_work_days: 6 } },
  ];

  for (const p of profiles) {
    const req = buildRequest(p.constraints);
    const t0 = Date.now();
    let result: SolveResponse;
    try {
      result = await callSolver(req);
    } catch (e: any) {
      console.log(`\n[${p.name}] FETCH ERROR: ${e?.message ?? e}`);
      continue;
    }
    const ms = Date.now() - t0;
    const status = result.ok ? "OK" : "FAIL";
    const count = (result.assignments || []).length;

    if (result.ok) {
      // distribution of days per employee
      const byEmp = new Map<string, Set<string>>();
      for (const a of result.assignments) {
        if (!byEmp.has(a.employee_id)) byEmp.set(a.employee_id, new Set());
        byEmp.get(a.employee_id)!.add(a.day_date);
      }
      const counts = [...byEmp.values()].map((s) => s.size).sort((a, b) => b - a);
      const max = counts[0] ?? 0;
      const min = counts[counts.length - 1] ?? 0;
      const avg = counts.length ? (counts.reduce((s, x) => s + x, 0) / counts.length).toFixed(1) : "0";
      const above6 = counts.filter((c) => c > 6).length;
      const above7 = counts.filter((c) => c > 7).length;
      const wasteCount = counts.length;
      console.log(
        `\n[${p.name}]  ${status}  count=${count}  ${ms}ms  emp_with_assignments=${wasteCount}  perEmp(min/avg/max)=${min}/${avg}/${max}  emps_with_>6_days=${above6}  emps_with_>7_days=${above7}`,
      );
    } else {
      console.log(`\n[${p.name}]  ${status}  count=${count}  ${ms}ms  err=${result.error ?? "-"}  stats=${JSON.stringify(result.stats ?? {})}`);
    }
  }

  await prisma.$disconnect();
};

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
