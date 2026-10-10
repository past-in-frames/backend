import { Prisma } from '@prisma/client';
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

/** A page of the home feed or a section. Callers that need the whole set omit it. */
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

const publicSorts = ['latest', 'year', 'year-asc', 'month-day', 'month-day-desc'] as const;
type PublicSort = (typeof publicSorts)[number];

function parseSort(value: unknown): PublicSort {
  const raw = Array.isArray(value) ? value[0] : value;
  return publicSorts.includes(raw as PublicSort) ? (raw as PublicSort) : 'month-day-desc';
}

/** Year follows the calendar date. Day & month groups the same anniversary across years. */
function chronologicalOrder(sort: 'latest' | 'year' | 'year-asc') {
  if (sort === 'latest') return [{ publishedAt: 'desc' as const }, { id: 'desc' as const }];
  if (sort === 'year-asc') return [{ eventDate: 'asc' as const }, { id: 'asc' as const }];
  return [{ eventDate: 'desc' as const }, { id: 'desc' as const }];
}

function monthDayOrder(sort: 'month-day' | 'month-day-desc') {
  return sort === 'month-day'
    ? Prisma.sql`MONTH(event_date) ASC, DAY(event_date) ASC, event_date DESC, id DESC`
    : Prisma.sql`MONTH(event_date) DESC, DAY(event_date) DESC, event_date DESC, id DESC`;
}

const summarySelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  eventDate: true,
  updatedAt: true,
  type: true,
  media: {
    where: { type: 'image' as const, url: { not: null } },
    orderBy: { sortOrder: 'asc' as const },
    take: 1,
    select: { url: true, altText: true },
  },
};

async function idsByMonthAndDay(
  whereSql: Prisma.Sql,
  sort: 'month-day' | 'month-day-desc',
  limit: number | undefined,
  offset: number,
) {
  const order = monthDayOrder(sort);
  const take = limit ?? (offset > 0 ? MAX_OFFSET + MAX_LIMIT : undefined);
  // Limit and offset are already clamped integers. MySQL rejects them as bound parameters.
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM stories
    WHERE ${whereSql}
    ORDER BY ${order}
    ${take ? Prisma.raw(`LIMIT ${take}`) : Prisma.empty}
    ${offset > 0 ? Prisma.raw(`OFFSET ${offset}`) : Prisma.empty}
  `;
  return rows.map((row) => Number(row.id));
}

storiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const typeQuery = typeof req.query.type === 'string' ? req.query.type.trim() : '';
    const type =
      typeQuery === 'science' || typeQuery === 'history' || typeQuery === 'other' ? typeQuery : '';
    const excludeOther = req.query.exclude === 'other';
    const titleQuery = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 191) : '';
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    const sort = parseSort(req.query.sort);
    const where = {
      ...published,
      ...(type ? { type } : {}),
      // Home leaves type unset and asks to hide M&I. Null type still belongs there.
      ...(!type && excludeOther ? { OR: [{ type: null }, { type: { not: 'other' } }] } : {}),
      ...(titleQuery ? { title: { contains: titleQuery } } : {}),
    };
    const whereSql = Prisma.join(
      [
        Prisma.sql`status = 'published'`,
        ...(type ? [Prisma.sql`type = ${type}`] : []),
        ...(!type && excludeOther ? [Prisma.sql`(type IS NULL OR type <> 'other')`] : []),
        ...(titleQuery ? [Prisma.sql`title LIKE CONCAT('%', ${titleQuery}, '%')`] : []),
      ],
      ' AND ',
    );

    const total = await prisma.story.count({ where });
    const stories =
      sort === 'month-day' || sort === 'month-day-desc'
        ? await storiesByMonthAndDay(where, whereSql, sort, limit, offset)
        : await prisma.story.findMany({
            where,
            // Seeded stories share a publishedAt, so id breaks the tie by insertion order.
            orderBy: chronologicalOrder(sort),
            ...(offset ? { skip: offset } : {}),
            ...(limit ? { take: limit } : {}),
            select: summarySelect,
          });

    res.set('Cache-Control', PUBLIC_CACHE).set('X-Total-Count', String(total)).json(
      stories.map((story) => ({
        slug: story.slug,
        title: story.title,
        summary: story.summary,
        eventDate: formatDateOnly(story.eventDate),
        updatedAt: story.updatedAt.toISOString(),
        type: story.type,
        coverUrl: story.media[0]?.url ?? null,
        coverAlt: story.media[0]?.altText ?? null,
      })),
    );
  }),
);

async function storiesByMonthAndDay(
  where: Prisma.StoryWhereInput,
  whereSql: Prisma.Sql,
  sort: 'month-day' | 'month-day-desc',
  limit: number | undefined,
  offset: number,
) {
  const ids = await idsByMonthAndDay(whereSql, sort, limit, offset);
  if (ids.length === 0) return [];

  const rows = await prisma.story.findMany({
    where: { ...where, id: { in: ids } },
    select: summarySelect,
  });
  const rank = new Map(ids.map((id, index) => [id, index]));
  return rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

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
      type: story.type,
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
