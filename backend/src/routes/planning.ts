import express, { Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = express.Router();

const toYYYYMMDD = (d: Date): string => d.toISOString().slice(0, 10);
const parseYYYYMMDD = (s: string): Date => new Date(`${s}T00:00:00.000Z`);

function isAdminOrManager(roles: string[] | undefined): boolean {
  const normalized = (roles ?? []).map((r) => String(r).toLowerCase());
  return normalized.some((r) => r.includes('admin') || r.includes('manager'));
}

// -----------------------------------------------------------------------------
// Select helpers (convert Prisma/camelCase -> frontend/snake_case)
// -----------------------------------------------------------------------------
function mapTeam(t: any) {
  return {
    id: t.id,
    name: t.name,
    color: t.color,
    sort_order: t.sortOrder,
    created_at: t.createdAt ? toYYYYMMDD(new Date(t.createdAt)) : null,
  };
}

function mapMachine(m: any) {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    sort_order: m.sortOrder,
    machine_group: m.machineGroup,
    max_employees: m.maxEmployees,
    short_name: m.shortName,
    importance: m.importance,
    created_at: m.createdAt ? toYYYYMMDD(new Date(m.createdAt)) : null,
  };
}

function mapEmployee(e: any) {
  return {
    id: e.id,
    first_name: e.firstName,
    last_name: e.lastName,
    default_team_id: e.defaultTeamId,
    is_team_leader: e.isTeamLeader,
    is_backup: e.isBackup,
    active: e.active,
    created_at: e.createdAt ? toYYYYMMDD(new Date(e.createdAt)) : null,
  };
}

function mapStatus(s: any) {
  return {
    id: s.id,
    name: s.name,
    color: s.color,
    sort_order: s.sortOrder,
    created_at: s.createdAt ? toYYYYMMDD(new Date(s.createdAt)) : null,
  };
}

function mapTimeSlot(ts: any) {
  return {
    id: ts.id,
    name: ts.name,
    short_name: ts.shortName,
    color: ts.color,
    sort_order: ts.sortOrder,
    created_at: ts.createdAt ? toYYYYMMDD(new Date(ts.createdAt)) : null,
  };
}

function mapSkill(sk: any) {
  return {
    id: sk.id,
    employee_id: sk.employeeId,
    machine_id: sk.machineId,
  };
}

function mapDailyAssignment(a: any) {
  return {
    id: a.id,
    day_date: toYYYYMMDD(a.dayDate),
    employee_id: a.employeeId,
    machine_id: a.machineId,
    time_slot_id: a.timeSlotId,
    team_id: a.teamId,
    created_at: a.createdAt ? toYYYYMMDD(new Date(a.createdAt)) : null,
  };
}

function mapWeeklyEmployeeStatus(es: any) {
  return {
    id: es.id,
    day_date: toYYYYMMDD(es.dayDate),
    employee_id: es.employeeId,
    status_id: es.statusId,
    created_at: es.createdAt ? toYYYYMMDD(new Date(es.createdAt)) : null,
  };
}

function mapMachineOpenShift(os: any) {
  return {
    id: os.id,
    machine_id: os.machineId,
    time_slot_id: os.timeSlotId,
  };
}

function mapMachineDowntime(dt: any) {
  return {
    id: dt.id,
    machine_id: dt.machineId,
    day_date: toYYYYMMDD(dt.dayDate),
    reason: dt.reason,
    created_at: dt.createdAt ? toYYYYMMDD(new Date(dt.createdAt)) : null,
  };
}

// -----------------------------------------------------------------------------
// Planning selects (used by Planning.tsx)
// -----------------------------------------------------------------------------

router.get('/luxlait_teams', async (req: Request, res: Response) => {
  try {
    const teams = await prisma.luxlaitTeam.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    res.json(teams.map(mapTeam));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.get('/luxlait_machines', async (req: Request, res: Response) => {
  try {
    const machines = await prisma.luxlaitMachine.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    res.json(machines.map(mapMachine));
  } catch {
    res.status(500).json({ error: 'Failed to fetch machines' });
  }
});

router.get('/luxlait_employees', async (req: Request, res: Response) => {
  try {
    const activeParam = req.query.active;
    const active =
      typeof activeParam === 'string'
        ? activeParam.toLowerCase() === 'true'
        : true;

    const employees = await prisma.luxlaitEmployee.findMany({
      where: { active },
      orderBy: { lastName: 'asc' },
    });
    res.json(employees.map(mapEmployee));
  } catch {
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

router.get('/luxlait_statuses', async (_req: Request, res: Response) => {
  try {
    const statuses = await prisma.luxlaitStatus.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    res.json(statuses.map(mapStatus));
  } catch {
    res.status(500).json({ error: 'Failed to fetch statuses' });
  }
});

router.get('/luxlait_time_slots', async (_req: Request, res: Response) => {
  try {
    const timeSlots = await prisma.luxlaitTimeSlot.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    res.json(timeSlots.map(mapTimeSlot));
  } catch {
    res.status(500).json({ error: 'Failed to fetch time slots' });
  }
});

router.get('/luxlait_machine_open_shifts', async (_req: Request, res: Response) => {
  try {
    const openShifts = await prisma.luxlaitMachineOpenShift.findMany({
      orderBy: [{ machineId: 'asc' }, { timeSlotId: 'asc' }],
    });
    res.json(openShifts.map(mapMachineOpenShift));
  } catch {
    res.status(500).json({ error: 'Failed to fetch machine open shifts' });
  }
});

router.get('/luxlait_machine_downtimes', async (req: Request, res: Response) => {
  try {
    const from = (req.query.fromDate ?? req.query.from) as string | undefined;
    const to = (req.query.toDate ?? req.query.to) as string | undefined;

    const where =
      from && to
        ? {
            dayDate: { gte: parseYYYYMMDD(from), lte: parseYYYYMMDD(to) },
          }
        : undefined;

    const downtimes = await prisma.luxlaitMachineDowntime.findMany({
      where,
      orderBy: [{ machineId: 'asc' }, { dayDate: 'asc' }],
    });

    res.json(downtimes.map(mapMachineDowntime));
  } catch {
    res.status(500).json({ error: 'Failed to fetch machine downtimes' });
  }
});

router.get('/luxlait_employee_machine_skills', async (_req: Request, res: Response) => {
  try {
    const skills = await prisma.luxlaitEmployeeMachineSkill.findMany();
    res.json(skills.map(mapSkill));
  } catch {
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

router.get('/luxlait_daily_assignments', async (req: Request, res: Response) => {
  try {
    const from = req.query.fromDate as string | undefined;
    const to = req.query.toDate as string | undefined;

    if (!from || !to) {
      res.status(400).json({ error: 'fromDate and toDate are required' });
      return;
    }

    const assignments = await prisma.luxlaitDailyAssignment.findMany({
      where: {
        dayDate: { gte: parseYYYYMMDD(from), lte: parseYYYYMMDD(to) },
      },
    });
    res.json(assignments.map(mapDailyAssignment));
  } catch {
    res.status(500).json({ error: 'Failed to fetch daily assignments' });
  }
});

router.get('/luxlait_weekly_employee_statuses', async (req: Request, res: Response) => {
  try {
    const from = req.query.fromDate as string | undefined;
    const to = req.query.toDate as string | undefined;

    if (!from || !to) {
      res.status(400).json({ error: 'fromDate and toDate are required' });
      return;
    }

    const statuses = await prisma.luxlaitWeeklyEmployeeStatus.findMany({
      where: {
        dayDate: { gte: parseYYYYMMDD(from), lte: parseYYYYMMDD(to) },
      },
    });
    res.json(statuses.map(mapWeeklyEmployeeStatus));
  } catch {
    res.status(500).json({ error: 'Failed to fetch weekly employee statuses' });
  }
});

// -----------------------------------------------------------------------------
// Mutations (used by Planning.tsx)
// -----------------------------------------------------------------------------

router.post('/luxlait_daily_assignments', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      day_date: string;
      employee_id: string;
      machine_id: string;
      time_slot_id: string | null;
      team_id: string;
    };

    const created = await prisma.luxlaitDailyAssignment.create({
      data: {
        dayDate: parseYYYYMMDD(body.day_date),
        employeeId: body.employee_id,
        machineId: body.machine_id,
        timeSlotId: body.time_slot_id ?? null,
        teamId: body.team_id,
      },
    });

    res.json({ data: mapDailyAssignment(created) });
  } catch {
    res.status(500).json({ error: 'Failed to create daily assignment' });
  }
});

router.post('/luxlait_daily_assignments/upsert', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      rows: Array<{
        day_date: string;
        employee_id: string;
        machine_id: string;
        time_slot_id: string | null;
        team_id: string;
      }>;
    };

    const rows = Array.isArray(body?.rows) ? body.rows : [];

    // Prisma can't do true bulk upsert; upsert per row using the unique(day_date,employee_id) constraint.
    await prisma.$transaction(
      rows.map((r) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma.luxlaitDailyAssignment as any).upsert({
          where: {
            dayDate_employeeId: {
              dayDate: parseYYYYMMDD(r.day_date),
              employeeId: r.employee_id,
            },
          },
          update: {
            machineId: r.machine_id,
            timeSlotId: r.time_slot_id ?? null,
            teamId: r.team_id,
          },
          create: {
            dayDate: parseYYYYMMDD(r.day_date),
            employeeId: r.employee_id,
            machineId: r.machine_id,
            timeSlotId: r.time_slot_id ?? null,
            teamId: r.team_id,
          },
        })
      )
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to upsert daily assignments' });
  }
});

router.post('/luxlait_daily_assignments/bulk_upsert', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      rows: Array<{
        day_date: string;
        employee_id: string;
        machine_id: string;
        time_slot_id: string | null;
        team_id: string;
      }>;
    };

    const rows = Array.isArray(body?.rows) ? body.rows : [];

    await prisma.$transaction(
      rows.map((r) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prisma.luxlaitDailyAssignment as any).upsert({
          where: {
            dayDate_employeeId: {
              dayDate: parseYYYYMMDD(r.day_date),
              employeeId: r.employee_id,
            },
          },
          update: {
            machineId: r.machine_id,
            timeSlotId: r.time_slot_id ?? null,
            teamId: r.team_id,
          },
          create: {
            dayDate: parseYYYYMMDD(r.day_date),
            employeeId: r.employee_id,
            machineId: r.machine_id,
            timeSlotId: r.time_slot_id ?? null,
            teamId: r.team_id,
          },
        })
      )
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to bulk upsert daily assignments' });
  }
});

router.patch('/luxlait_daily_assignments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as { machine_id: string; time_slot_id: string | null };

    const updated = await prisma.luxlaitDailyAssignment.update({
      where: { id },
      data: {
        machineId: body.machine_id,
        timeSlotId: body.time_slot_id ?? null,
      },
    });

    res.json({ data: mapDailyAssignment(updated) });
  } catch {
    res.status(500).json({ error: 'Failed to update daily assignment' });
  }
});

router.delete('/luxlait_daily_assignments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.luxlaitDailyAssignment.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete daily assignment' });
  }
});

router.post('/luxlait_weekly_employee_statuses', async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      day_date: string;
      employee_id: string;
      status_id: string;
    };

    const created = await prisma.luxlaitWeeklyEmployeeStatus.create({
      data: {
        dayDate: parseYYYYMMDD(body.day_date),
        employeeId: body.employee_id,
        statusId: body.status_id,
      },
    });

    res.json({ data: mapWeeklyEmployeeStatus(created) });
  } catch {
    res.status(500).json({ error: 'Failed to create weekly employee status' });
  }
});

router.patch('/luxlait_weekly_employee_statuses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as { status_id: string };

    const updated = await prisma.luxlaitWeeklyEmployeeStatus.update({
      where: { id },
      data: { statusId: body.status_id },
    });

    res.json({ data: mapWeeklyEmployeeStatus(updated) });
  } catch {
    res.status(500).json({ error: 'Failed to update weekly employee status' });
  }
});

router.delete('/luxlait_weekly_employee_statuses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.luxlaitWeeklyEmployeeStatus.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete weekly employee status' });
  }
});

router.post('/luxlait_machines', async (req: Request, res: Response) => {
  try {
    if (!isAdminOrManager(req.userRoles)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const body = req.body as {
      name: string;
      description?: string | null;
      sort_order: number;
      machine_group?: string | null;
      short_name?: string | null;
      max_employees?: number;
      importance?: 'MANDATORY' | 'PRIORITY' | 'OPTIONAL';
    };

    const created = await prisma.luxlaitMachine.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        sortOrder: body.sort_order,
        machineGroup: body.machine_group ?? null,
        shortName: body.short_name ?? null,
        maxEmployees: body.max_employees ?? 1,
        importance: body.importance ?? 'OPTIONAL',
      },
    });

    res.json({ data: mapMachine(created) });
  } catch {
    res.status(500).json({ error: 'Failed to create machine' });
  }
});

router.patch('/luxlait_machines/:id', async (req: Request, res: Response) => {
  try {
    if (!isAdminOrManager(req.userRoles)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { id } = req.params;
    const body = req.body as {
      name?: string;
      description?: string | null;
      sort_order?: number;
      machine_group?: string | null;
      short_name?: string | null;
      max_employees?: number;
      importance?: 'MANDATORY' | 'PRIORITY' | 'OPTIONAL';
    };

    const updated = await prisma.luxlaitMachine.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.sort_order !== undefined ? { sortOrder: body.sort_order } : {}),
        ...(body.machine_group !== undefined ? { machineGroup: body.machine_group } : {}),
        ...(body.short_name !== undefined ? { shortName: body.short_name } : {}),
        ...(body.max_employees !== undefined ? { maxEmployees: body.max_employees } : {}),
        ...(body.importance !== undefined ? { importance: body.importance } : {}),
      },
    });

    res.json({ data: mapMachine(updated) });
  } catch (err) {
    console.error('Failed to update machine:', err);
    const detail = process.env.NODE_ENV === 'development' && err instanceof Error ? err.message : undefined;
    res.status(500).json({ error: 'Failed to update machine', detail });
  }
});

router.delete('/luxlait_machines/:id', async (req: Request, res: Response) => {
  try {
    if (!isAdminOrManager(req.userRoles)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { id } = req.params;
    await prisma.luxlaitMachine.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete machine' });
  }
});

router.post('/luxlait_machine_open_shifts', async (req: Request, res: Response) => {
  try {
    if (!isAdminOrManager(req.userRoles)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const body = req.body as { machine_id: string; time_slot_id: string };

    const created = await prisma.luxlaitMachineOpenShift.create({
      data: {
        machineId: body.machine_id,
        timeSlotId: body.time_slot_id,
      },
    });

    res.json({ data: mapMachineOpenShift(created) });
  } catch {
    res.status(500).json({ error: 'Failed to create machine open shift' });
  }
});

router.delete('/luxlait_machine_open_shifts/:id', async (req: Request, res: Response) => {
  try {
    if (!isAdminOrManager(req.userRoles)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { id } = req.params;
    await prisma.luxlaitMachineOpenShift.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete machine open shift' });
  }
});

router.put('/luxlait_machines/:id/open_shifts', async (req: Request, res: Response) => {
  try {
    if (!isAdminOrManager(req.userRoles)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { id } = req.params;
    const body = req.body as { timeSlotIds: string[] };

    const ids = Array.isArray(body?.timeSlotIds) ? body.timeSlotIds : [];

    await prisma.$transaction(async (tx) => {
      await tx.luxlaitMachineOpenShift.deleteMany({ where: { machineId: id } });
      if (ids.length === 0) return;
      await tx.luxlaitMachineOpenShift.createMany({
        data: ids.map((tsId) => ({ machineId: id, timeSlotId: tsId })),
        skipDuplicates: true,
      });
    });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to update machine open shifts' });
  }
});

router.post('/luxlait_machine_downtimes', async (req: Request, res: Response) => {
  try {
    if (!isAdminOrManager(req.userRoles)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const body = req.body as
      | { machine_id: string; day_date: string; reason?: string | null }
      | { machineId: string; dates: string[]; reason?: string | null };

    const hasBulkKeys = 'machineId' in body && Array.isArray((body as any).dates);

    const result = await prisma.$transaction(async (tx) => {
      if (hasBulkKeys) {
        const machineId = (body as any).machineId as string;
        const dates = (body as any).dates as string[];
        const reason = (body as any).reason ?? null;

        await Promise.all(
          dates.map((day) => {
            const dayDate = parseYYYYMMDD(day);
            return (tx.luxlaitMachineDowntime as any).upsert({
              where: {
                machineId_dayDate: { machineId, dayDate },
              },
              update: { reason },
              create: { machineId, dayDate, reason },
            });
          })
        );

        return { ok: true };
      }

      const single = body as any;
      const created = await tx.luxlaitMachineDowntime.create({
        data: {
          machineId: single.machine_id,
          dayDate: parseYYYYMMDD(single.day_date),
          reason: single.reason ?? null,
        },
      });

      return { data: mapMachineDowntime(created) };
    });

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to create machine downtime' });
  }
});

router.delete('/luxlait_machine_downtimes', async (req: Request, res: Response) => {
  try {
    if (!isAdminOrManager(req.userRoles)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const body = req.body as { machineId: string; dates: string[] };
    const machineId = body?.machineId;
    const dates = Array.isArray(body?.dates) ? body.dates : [];

    if (!machineId || dates.length === 0) {
      res.status(400).json({ error: 'machineId and dates are required' });
      return;
    }

    await prisma.luxlaitMachineDowntime.deleteMany({
      where: { machineId, dayDate: { in: dates.map((d) => parseYYYYMMDD(d)) } },
    });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete machine downtimes' });
  }
});

router.delete('/luxlait_machine_downtimes/:id', async (req: Request, res: Response) => {
  try {
    if (!isAdminOrManager(req.userRoles)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { id } = req.params;
    await prisma.luxlaitMachineDowntime.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete machine downtime' });
  }
});

export default router;

