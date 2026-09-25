import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler';
import { notFound } from '../lib/http-error';
import { routeId, routeParam } from '../lib/params';
import { prisma } from '../lib/prisma';
import { validateBody } from '../lib/validate';

const articleInclude = {
  category: true,
  author: true,
  tags: true,
} as const;

const createArticleSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  dek: z.string().min(1),
  body: z.string().min(1),
  imageLabel: z.string().optional(),
  gradient: z.string().optional(),
  readTimeMin: z.number().int().min(1).optional(),
  featured: z.boolean().optional(),
  trending: z.boolean().optional(),
  publishedAt: z.iso.datetime().optional(),
  categoryId: z.number().int().positive(),
  authorId: z.number().int().positive(),
  tags: z.array(z.string()).optional(),
});
const updateArticleSchema = createArticleSchema.partial();

export const articlesRouter = Router();

articlesRouter.post(
  '/',
  validateBody(createArticleSchema),
  asyncHandler(async (req, res) => {
    const { tags = [], publishedAt, ...data } = req.body;
    const article = await prisma.article.create({
      data: {
        ...data,
        publishedAt: publishedAt ? new Date(publishedAt) : undefined,
        tags: {
          connectOrCreate: tags.map((name: string) => ({
            where: { name },
            create: { name },
          })),
        },
      },
      include: articleInclude,
    });
    res.status(201).json(article);
  }),
);

articlesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const categorySlug =
      typeof req.query.category === 'string' ? req.query.category : undefined;
    const articles = await prisma.article.findMany({
      where: categorySlug ? { category: { slug: categorySlug } } : undefined,
      orderBy: { publishedAt: 'desc' },
      include: articleInclude,
    });
    res.json(articles);
  }),
);

articlesRouter.get(
  '/slug/:slug',
  asyncHandler(async (req, res) => {
    const slug = routeParam(req.params.slug);
    const article = await prisma.article.findUnique({
      where: { slug },
      include: articleInclude,
    });

    if (!article) {
      throw notFound(`Article ${slug} not found`);
    }

    res.json(article);
  }),
);

articlesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = routeId(req.params.id);
    const article = await prisma.article.findUnique({
      where: { id },
      include: articleInclude,
    });

    if (!article) {
      throw notFound(`Article ${id} not found`);
    }

    res.json(article);
  }),
);

articlesRouter.patch(
  '/:id',
  validateBody(updateArticleSchema),
  asyncHandler(async (req, res) => {
    const id = routeId(req.params.id);
    const existing = await prisma.article.findUnique({ where: { id } });

    if (!existing) {
      throw notFound(`Article ${id} not found`);
    }

    const { tags, publishedAt, ...data } = req.body;
    const article = await prisma.article.update({
      where: { id },
      data: {
        ...data,
        publishedAt: publishedAt ? new Date(publishedAt) : undefined,
        tags: tags
          ? {
              set: [],
              connectOrCreate: tags.map((name: string) => ({
                where: { name },
                create: { name },
              })),
            }
          : undefined,
      },
      include: articleInclude,
    });
    res.json(article);
  }),
);

articlesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = routeId(req.params.id);
    const existing = await prisma.article.findUnique({
      where: { id },
      include: articleInclude,
    });

    if (!existing) {
      throw notFound(`Article ${id} not found`);
    }

    await prisma.article.delete({ where: { id } });
    res.json(existing);
  }),
);
