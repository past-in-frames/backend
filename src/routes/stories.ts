import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { notFound } from '../lib/http-error';
import { routeParam } from '../lib/params';
import { prisma } from '../lib/prisma';

export const storiesRouter = Router();

storiesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const stories = await prisma.story.findMany({
      orderBy: [{ eventDate: 'desc' }, { id: 'desc' }],
      select: {
        slug: true,
        title: true,
        summary: true,
        eventDate: true,
        category: true,
        media: {
          where: { type: 'image', url: { not: null } },
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { url: true, altText: true },
        },
      },
    });

    res.json(
      stories.map((story) => ({
        slug: story.slug,
        title: story.title,
        summary: story.summary,
        eventDate: formatDateOnly(story.eventDate),
        category: story.category,
        coverUrl: story.media[0]?.url ?? null,
        coverAlt: story.media[0]?.altText ?? null,
      })),
    );
  }),
);

storiesRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const slug = routeParam(req.params.slug);
    const story = await prisma.story.findUnique({
      where: { slug },
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
        sources: { orderBy: { id: 'asc' } },
      },
    });

    if (!story) {
      throw notFound('Story not found');
    }

    res.json({
      slug: story.slug,
      title: story.title,
      summary: story.summary,
      eventDate: formatDateOnly(story.eventDate),
      category: story.category,
      body: JSON.parse(story.body) as unknown,
      media: story.media.map((item) => ({
        key: item.key,
        type: item.type,
        url: item.url,
        caption: item.caption,
        altText: item.altText,
      })),
      sources: story.sources.map((source) => ({
        title: source.title,
        url: source.url,
        publisher: source.publisher,
      })),
    });
  }),
);

function formatDateOnly(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
