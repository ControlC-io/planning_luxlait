import express, { Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = express.Router();

router.get('/luxlait_solver_constraints', async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.luxlaitSolverConstraint.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
    res.json(
      rows.map((c) => ({
        id: c.id,
        cat: c.category.toLowerCase(),
        group: c.groupName,
        title: c.title,
        desc: c.description,
        metric: c.metric,
        impact: c.impact,
        weight: c.weight,
        active: c.active,
        editable: c.editable,
      })),
    );
  } catch (err) {
    console.error('luxlait_solver_constraints:', err);
    res.status(500).json({ error: 'Failed to load solver constraints' });
  }
});

export default router;
