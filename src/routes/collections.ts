import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { notFound } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { param } from '../lib/request';
import { summarySelect, toSummary } from '../lib/story-summary';

export const collectionsRouter = Router();

const PUBLIC_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';
const MAX_LIMIT = 50;

const publishedStories = {
  where: { story: { status: 'published' as const } },
  orderBy: [{ sortOrder: 'asc' as const }, { storyId: 'asc' as const }],
};

collectionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = Number.parseInt(typeof req.query.limit === 'string' ? req.query.limit : '', 10);
    const limit = Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : undefined;

    const collections = await prisma.collection.findMany({
      where: { status: 'published' },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      ...(limit ? { take: limit } : {}),
      include: {
        stories: {
          ...publishedStories,
          include: { story: { select: summarySelect } },
        },
      },
    });

    res.set('Cache-Control', PUBLIC_CACHE).json(
      collections.map((collection) => {
        const firstCover = collection.stories
          .map((link) => toSummary(link.story).coverUrl)
          .find((url) => url);
        return {
          slug: collection.slug,
          title: collection.title,
          description: collection.description,
          coverUrl: collection.coverUrl ?? firstCover ?? null,
          storyCount: collection.stories.length,
        };
      }),
    );
  }),
);

collectionsRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const collection = await prisma.collection.findFirst({
      where: { slug: param(req, 'slug'), status: 'published' },
      include: {
        stories: {
          ...publishedStories,
          include: { story: { select: summarySelect } },
        },
      },
    });
    if (!collection) {
      throw notFound('Collection not found');
    }

    const stories = collection.stories.map((link) => toSummary(link.story));
    res.set('Cache-Control', PUBLIC_CACHE).json({
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      coverUrl: collection.coverUrl ?? stories.find((story) => story.coverUrl)?.coverUrl ?? null,
      stories,
    });
  }),
);
