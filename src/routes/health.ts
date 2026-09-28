import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const healthRouter = Router();

/** Coolify restarts the container when this stops reporting a usable database. */
healthRouter.get('/', (_req, res) => {
  void prisma
    .$queryRaw`SELECT 1`
    .then(
      () => res.json({ status: 'ok', database: 'up' }),
      () => res.status(503).json({ status: 'degraded', database: 'down' }),
    );
});
