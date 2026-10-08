import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { notFound } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { param } from '../lib/request';
import { formatDateOnly, parseStoredBody } from '../lib/story-view';

export const storiesRouter = Router();

/**
 * Readers arrive from social links and mostly hit the same few stories, so every
 * public response is cacheable by the CDN and revalidated in the background.
 */
const PUBLIC_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';

const published = { status: 'published' as const };

/** A page of the home feed or a category. Callers that need the whole set omit it. */
const MAX_LIMIT = 50;
const MAX_OFFSET = 10_000;

function parseLimit(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return undefined;
  return Math.min(parsed, MAX_LIMIT);
}

function parseOffset(value: unknown) {
  if (typeof value !== 'string') return 0;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return 0;
  return Math.min(parsed, MAX_OFFSET);
}

storiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const typeQuery = typeof req.query.type === 'string' ? req.query.type.trim() : '';
    const type = typeQuery === 'science' || typeQuery === 'history' ? typeQuery : '';
    const titleQuery = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 191) : '';
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    // Seeded stories share a publishedAt, so id breaks the tie by insertion order.
    const orderBy =
      req.query.sort === 'latest'
        ? [{ publishedAt: 'desc' as const }, { id: 'desc' as const }]
        : [{ eventDate: 'desc' as const }, { id: 'desc' as const }];
    const where = {
      ...published,
      ...(category ? { category } : {}),
      ...(type ? { type } : {}),
      ...(titleQuery ? { title: { contains: titleQuery } } : {}),
    };

    const [stories, total] = await Promise.all([
      prisma.story.findMany({
        where,
        orderBy,
        ...(offset ? { skip: offset } : {}),
        ...(limit ? { take: limit } : {}),
        select: {
          slug: true,
          title: true,
          summary: true,
          eventDate: true,
          updatedAt: true,
          category: true,
          media: {
            where: { type: 'image', url: { not: null } },
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { url: true, altText: true },
          },
        },
      }),
      prisma.story.count({ where }),
    ]);

    res.set('Cache-Control', PUBLIC_CACHE).set('X-Total-Count', String(total)).json(
      stories.map((story) => ({
        slug: story.slug,
        title: story.title,
        summary: story.summary,
        eventDate: formatDateOnly(story.eventDate),
        updatedAt: story.updatedAt.toISOString(),
        category: story.category,
        coverUrl: story.media[0]?.url ?? null,
        coverAlt: story.media[0]?.altText ?? null,
      })),
    );
  }),
);

storiesRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const grouped = await prisma.story.groupBy({
      by: ['category'],
      where: published,
      _count: { _all: true },
      orderBy: { category: 'asc' },
    });

    res.set('Cache-Control', PUBLIC_CACHE).json(
      grouped.map((row) => ({ name: row.category, count: row._count._all })),
    );
  }),
);

storiesRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const story = await prisma.story.findFirst({
      where: { slug: param(req, 'slug'), ...published },
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
        sources: { orderBy: { id: 'asc' } },
      },
    });

    if (!story) {
      throw notFound('Story not found');
    }

    res.set('Cache-Control', PUBLIC_CACHE).json({
      slug: story.slug,
      title: story.title,
      summary: story.summary,
      eventDate: formatDateOnly(story.eventDate),
      publishedAt: story.publishedAt?.toISOString() ?? null,
      updatedAt: story.updatedAt.toISOString(),
      category: story.category,
      body: parseStoredBody(story.body),
      media: story.media.map((item) => ({
        key: item.key,
        type: item.type,
        url: item.url,
        caption: item.caption,
        altText: item.altText,
        credit: item.credit,
        isAiGenerated: item.isAiGenerated,
      })),
      sources: story.sources.map((source) => ({
        title: source.title,
        url: source.url,
        publisher: source.publisher,
      })),
    });
  }),
);
