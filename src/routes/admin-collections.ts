import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler';
import { badRequest, conflict, notFound } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { param } from '../lib/request';

/** Mounted under `/api/admin/collections`, after the admin session check. */
export const adminCollectionsRouter = Router();

const collectionSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  status: z.enum(['draft', 'published']),
  sortOrder: z.number().int().optional(),
  /** Story slugs, in the order readers see them. */
  stories: z.array(z.string()),
});

function normalize(body: unknown) {
  const parsed = collectionSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  const input = parsed.data;

  const slug = input.slug.trim();
  const title = input.title.trim();
  const description = input.description?.trim() || null;
  const coverUrl = input.coverUrl?.trim() || null;

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 191) {
    throw badRequest('Slug can use lowercase letters, numbers, and hyphens');
  }
  if (!title || title.length > 191) {
    throw badRequest('Title is required');
  }
  if (description && description.length > 5000) {
    throw badRequest('Description is too long');
  }
  if (coverUrl && (!/^https?:\/\//.test(coverUrl) || coverUrl.length > 512)) {
    throw badRequest('Cover must be an http(s) address or empty');
  }
  const stories = [...new Set(input.stories.map((item) => item.trim()).filter(Boolean))];
  if (stories.length > 200) {
    throw badRequest('This collection has too many stories');
  }

  return { slug, title, description, coverUrl, status: input.status, sortOrder: input.sortOrder ?? 0, stories };
}

async function readCollection(slug: string) {
  const collection = await prisma.collection.findUnique({
    where: { slug },
    include: {
      stories: {
        orderBy: [{ sortOrder: 'asc' }, { storyId: 'asc' }],
        include: { story: { select: { slug: true } } },
      },
    },
  });
  if (!collection) {
    throw notFound('Collection not found');
  }

  return {
    slug: collection.slug,
    title: collection.title,
    description: collection.description ?? '',
    coverUrl: collection.coverUrl ?? '',
    status: collection.status,
    sortOrder: collection.sortOrder,
    stories: collection.stories.map((link) => link.story.slug),
  };
}

async function save(input: ReturnType<typeof normalize>, existingId: number | null) {
  const found = await prisma.story.findMany({
    where: { slug: { in: input.stories } },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(found.map((story) => [story.slug, story.id]));
  const missing = input.stories.find((slug) => !idBySlug.has(slug));
  if (missing) {
    throw badRequest(`No story with the slug “${missing}”`);
  }

  const data = {
    slug: input.slug,
    title: input.title,
    description: input.description,
    coverUrl: input.coverUrl,
    status: input.status,
    sortOrder: input.sortOrder,
  };

  try {
    await prisma.$transaction(async (tx) => {
      const collection = existingId
        ? await tx.collection.update({ where: { id: existingId }, data })
        : await tx.collection.create({ data });

      await tx.collectionStory.deleteMany({ where: { collectionId: collection.id } });
      if (input.stories.length > 0) {
        await tx.collectionStory.createMany({
          data: input.stories.map((slug, index) => ({
            collectionId: collection.id,
            storyId: idBySlug.get(slug) as number,
            sortOrder: index,
          })),
        });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('A collection with that slug already exists');
    }
    throw error;
  }

  return readCollection(input.slug);
}

adminCollectionsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const collections = await prisma.collection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { stories: true } } },
    });
    res.json(
      collections.map((collection) => ({
        slug: collection.slug,
        title: collection.title,
        status: collection.status,
        sortOrder: collection.sortOrder,
        storyCount: collection._count.stories,
      })),
    );
  }),
);

adminCollectionsRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    res.json(await readCollection(param(req, 'slug')));
  }),
);

adminCollectionsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res.status(201).json(await save(normalize(req.body), null));
  }),
);

adminCollectionsRouter.put(
  '/:slug',
  asyncHandler(async (req, res) => {
    const existing = await prisma.collection.findUnique({
      where: { slug: param(req, 'slug') },
      select: { id: true },
    });
    if (!existing) {
      throw notFound('Collection not found');
    }
    res.json(await save(normalize(req.body), existing.id));
  }),
);

adminCollectionsRouter.delete(
  '/:slug',
  asyncHandler(async (req, res) => {
    const deleted = await prisma.collection.deleteMany({ where: { slug: param(req, 'slug') } });
    if (deleted.count === 0) {
      throw notFound('Collection not found');
    }
    res.json({ ok: true });
  }),
);
