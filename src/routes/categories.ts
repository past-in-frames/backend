import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler';
import { notFound } from '../lib/http-error';
import { routeId } from '../lib/params';
import { prisma } from '../lib/prisma';
import { validateBody } from '../lib/validate';

const slugSchema = z.string().regex(/^[a-z0-9-]+$/);
const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: slugSchema,
});
const updateCategorySchema = createCategorySchema.partial();

export const categoriesRouter = Router();

categoriesRouter.post(
  '/',
  validateBody(createCategorySchema),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.create({ data: req.body });
    res.status(201).json(category);
  }),
);

categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { articles: true } } },
    });
    res.json(categories);
  }),
);

categoriesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = routeId(req.params.id);
    const category = await prisma.category.findUnique({
      where: { id },
      include: { articles: true },
    });

    if (!category) {
      throw notFound(`Category ${id} not found`);
    }

    res.json(category);
  }),
);

categoriesRouter.patch(
  '/:id',
  validateBody(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const id = routeId(req.params.id);
    const existing = await prisma.category.findUnique({ where: { id } });

    if (!existing) {
      throw notFound(`Category ${id} not found`);
    }

    const category = await prisma.category.update({
      where: { id },
      data: req.body,
    });
    res.json(category);
  }),
);

categoriesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = routeId(req.params.id);
    const existing = await prisma.category.findUnique({ where: { id } });

    if (!existing) {
      throw notFound(`Category ${id} not found`);
    }

    await prisma.category.delete({ where: { id } });
    res.json(existing);
  }),
);
