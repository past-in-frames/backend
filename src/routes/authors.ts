import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler';
import { notFound } from '../lib/http-error';
import { routeId } from '../lib/params';
import { prisma } from '../lib/prisma';
import { validateBody } from '../lib/validate';

const createAuthorSchema = z.object({
  name: z.string().min(1),
});

export const authorsRouter = Router();

authorsRouter.post(
  '/',
  validateBody(createAuthorSchema),
  asyncHandler(async (req, res) => {
    const author = await prisma.author.create({ data: req.body });
    res.status(201).json(author);
  }),
);

authorsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const authors = await prisma.author.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(authors);
  }),
);

authorsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = routeId(req.params.id);
    const author = await prisma.author.findUnique({
      where: { id },
      include: { articles: true },
    });

    if (!author) {
      throw notFound(`Author ${id} not found`);
    }

    res.json(author);
  }),
);
