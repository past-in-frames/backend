import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { notFound } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { param } from '../lib/request';
import { summarySelect, toSummary } from '../lib/story-summary';
import { matchingTitleIds } from '../lib/title-search';
import { formatDateOnly, parseStoredBody } from '../lib/story-view';
import { STORY_TOPICS, type StoryTopicName } from '../lib/story-input';
import { isStoryType } from '../lib/story-types';

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
  return publicSorts.includes(raw as PublicSort) ? (raw as PublicSort) : 'year';
}

/** Calendar filters are inclusive `YYYY-MM-DD` days. Anything else is ignored. */
function parseIsoDate(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const [year, month, day] = raw.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return undefined;
  }
  return raw;
}

/** Event dates are stored at noon UTC so the calendar day does not shift. */
function utcNoon(iso: string) {
  return new Date(`${iso}T12:00:00.000Z`);
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
    const type = isStoryType(typeQuery) ? typeQuery : '';
    const topicQuery = typeof req.query.topic === 'string' ? req.query.topic.trim() : '';
    const topic = STORY_TOPICS.includes(topicQuery as StoryTopicName) ? topicQuery : '';
    const photoStory = req.query.photoStory === 'true';
    const withVideo = req.query.video === 'true';
    const titleQuery = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 191) : '';
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);
    const sort = parseSort(req.query.sort);
    let from = parseIsoDate(req.query.from);
    let to = parseIsoDate(req.query.to);
    if (from && to && from > to) [from, to] = [to, from];
    const eventDate =
      from || to
        ? {
            ...(from ? { gte: utcNoon(from) } : {}),
            ...(to ? { lte: utcNoon(to) } : {}),
          }
        : undefined;
    // Full-text match on the title alone; null means "use LIKE" (see lib/title-search.ts).
    const titleIds = titleQuery ? await matchingTitleIds(titleQuery) : null;
    const where = {
      ...published,
      ...(type ? { type } : {}),
      ...(titleQuery ? (titleIds ? { id: { in: titleIds } } : { title: { contains: titleQuery } }) : {}),
      ...(eventDate ? { eventDate } : {}),
      // Science is its own section too, so both ways of being Science count.
      ...(topic === 'science'
        ? { AND: [{ OR: [{ type: 'science' }, { topics: { some: { topic } } }] }] }
        : topic
          ? { topics: { some: { topic } } }
          : {}),
      ...(photoStory ? { isPhotoStory: true } : {}),
      ...(withVideo ? { media: { some: { type: 'video' as const, url: { not: null } } } } : {}),
    };
    const whereSql = Prisma.join(
      [
        Prisma.sql`status = 'published'`,
        ...(type ? [Prisma.sql`type = ${type}`] : []),
        ...(titleQuery
          ? [
              titleIds
                ? titleIds.length > 0
                  ? Prisma.sql`id IN (${Prisma.join(titleIds)})`
                  : Prisma.sql`1 = 0`
                : Prisma.sql`title LIKE CONCAT('%', ${titleQuery}, '%')`,
            ]
          : []),
        ...(from ? [Prisma.sql`event_date >= ${from}`] : []),
        ...(to ? [Prisma.sql`event_date <= ${to}`] : []),
        ...(topic === 'science'
          ? [
              Prisma.sql`(type = 'science' OR id IN (SELECT story_id FROM story_topics WHERE topic = 'science'))`,
            ]
          : topic
            ? [Prisma.sql`id IN (SELECT story_id FROM story_topics WHERE topic = ${topic})`]
            : []),
        ...(photoStory ? [Prisma.sql`is_photo_story = 1`] : []),
        ...(withVideo
          ? [
              Prisma.sql`id IN (SELECT story_id FROM story_media WHERE type = 'video' AND url IS NOT NULL)`,
            ]
          : []),
      ],
      ' AND ',
    );

    const total = await prisma.story.count({ where });
    const stories =
      withVideo && sort === 'latest'
        ? await storiesByNewestVideo(where, limit, offset)
        : sort === 'month-day' || sort === 'month-day-desc'
        ? await storiesByMonthAndDay(where, whereSql, sort, limit, offset)
        : await prisma.story.findMany({
            where,
            // Seeded stories share a publishedAt, so id breaks the tie by insertion order.
            orderBy: chronologicalOrder(sort),
            ...(offset ? { skip: offset } : {}),
            ...(limit ? { take: limit } : {}),
            select: summarySelect,
          });

    res
      .set('Cache-Control', PUBLIC_CACHE)
      .set('X-Total-Count', String(total))
      .json(stories.map(toSummary));
  }),
);

/** A random published story, for "Surprise me". Never cached, or everyone would get the same one. */
storiesRouter.get(
  '/random',
  asyncHandler(async (_req, res) => {
    const where = { ...published, type: { not: null } };
    const count = await prisma.story.count({ where });
    if (count === 0) {
      throw notFound('No stories yet');
    }

    const story = await prisma.story.findFirst({
      where,
      orderBy: { id: 'asc' },
      skip: Math.floor(Math.random() * count),
      select: { slug: true, type: true },
    });
    if (!story) {
      throw notFound('No stories yet');
    }

    res.set('Cache-Control', 'no-store').json(story);
  }),
);

/** Watch lists the newest video first, whichever story it belongs to (a later video row is a newer video). */
async function storiesByNewestVideo(where: Prisma.StoryWhereInput, limit: number | undefined, offset: number) {
  const take = limit ?? MAX_OFFSET + MAX_LIMIT;
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT s.id FROM stories s
    JOIN story_media m ON m.story_id = s.id AND m.type = 'video' AND m.url IS NOT NULL
    WHERE s.status = 'published'
    GROUP BY s.id
    ORDER BY MAX(m.id) DESC
    ${Prisma.raw(`LIMIT ${take}`)}
    ${offset > 0 ? Prisma.raw(`OFFSET ${offset}`) : Prisma.empty}
  `;
  const ids = rows.map((row) => Number(row.id));
  if (ids.length === 0) return [];

  const found = await prisma.story.findMany({ where: { ...where, id: { in: ids } }, select: summarySelect });
  const rank = new Map(ids.map((id, index) => [id, index]));
  return found.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

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
