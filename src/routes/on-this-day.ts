import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { badRequest } from '../lib/http-error';
import { prisma } from '../lib/prisma';
import { summarySelect, toSummary } from '../lib/story-summary';

export const onThisDayRouter = Router();

const PUBLIC_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';

const SCOPES = ['all', 'us', 'world', 'science'] as const;
type Scope = (typeof SCOPES)[number];

/** Anniversaries are leap-agnostic, so every date is placed in a leap year (Feb 29 exists). */
const REFERENCE_YEAR = 2024;
/** "This week" is the days leading up to the chosen one. */
const WEEK_DAYS = 6;
const ALSO_LIMIT = 4;
const WEEK_LIMIT = 4;

function parseScope(value: unknown): Scope {
  const raw = Array.isArray(value) ? value[0] : value;
  return SCOPES.includes(raw as Scope) ? (raw as Scope) : 'all';
}

function parseNumber(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || !/^\d{1,2}$/.test(raw)) return NaN;
  return Number(raw);
}

function scopeSql(scope: Scope) {
  if (scope === 'us') return Prisma.sql`region = 'us'`;
  if (scope === 'world') return Prisma.sql`region = 'world'`;
  if (scope === 'science') {
    return Prisma.sql`(type = 'science' OR id IN (SELECT story_id FROM story_topics WHERE topic = 'science'))`;
  }
  return Prisma.sql`1 = 1`;
}

/** Month and day of the date `offset` days before the given one. */
function daysBefore(month: number, day: number, offset: number) {
  const date = new Date(Date.UTC(REFERENCE_YEAR, month - 1, day - offset));
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

async function storiesOnDays(
  days: { month: number; day: number }[],
  scope: Scope,
  limit?: number,
) {
  const match = Prisma.join(
    days.map((d) => Prisma.sql`(MONTH(event_date) = ${d.month} AND DAY(event_date) = ${d.day})`),
    ' OR ',
  );
  // `limit` is a clamped integer from this file; MySQL rejects bound LIMIT parameters.
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM stories
    WHERE status = 'published' AND ${scopeSql(scope)} AND (${match})
    ORDER BY event_date DESC, id DESC
    ${limit ? Prisma.raw(`LIMIT ${limit}`) : Prisma.empty}
  `;
  const ids = rows.map((row) => Number(row.id));
  if (ids.length === 0) return [];

  const stories = await prisma.story.findMany({
    where: { id: { in: ids } },
    select: summarySelect,
  });
  const rank = new Map(ids.map((id, index) => [id, index]));
  return stories.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

/** Number of the day in the reference (leap) year, 1 to 366. */
function dayOfYear(month: number, day: number) {
  const start = Date.UTC(REFERENCE_YEAR, 0, 1);
  return Math.round((Date.UTC(REFERENCE_YEAR, month - 1, day) - start) / 86_400_000) + 1;
}

/** Days between a story's calendar day and the chosen one, going the short way round the year. */
function distanceSql(target: number) {
  const doy = Prisma.sql`DAYOFYEAR(DATE(CONCAT('${Prisma.raw(String(REFERENCE_YEAR))}-', LPAD(MONTH(event_date), 2, '0'), '-', LPAD(DAY(event_date), 2, '0'))))`;
  return Prisma.sql`LEAST(ABS(${doy} - ${target}), 366 - ABS(${doy} - ${target}))`;
}

function parseDay(query: Record<string, unknown>) {
  const month = parseNumber(query.month);
  const day = parseNumber(query.day);
  const probe = new Date(Date.UTC(REFERENCE_YEAR, month - 1, day));
  if (
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw badRequest('month and day must be a real calendar day');
  }
  return { month, day };
}

async function summariesInOrder(ids: number[]) {
  if (ids.length === 0) return [];
  const stories = await prisma.story.findMany({ where: { id: { in: ids } }, select: summarySelect });
  const rank = new Map(ids.map((id, index) => [id, index]));
  return stories.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

/**
 * The home page's sections for one day: for every story type, its stories nearest to that calendar
 * day (the day itself first, then the days around it), so every section has something to show.
 */
onThisDayRouter.get(
  '/sections',
  asyncHandler(async (req, res) => {
    const { month, day } = parseDay(req.query);
    const scope = parseScope(req.query.scope);
    const per = Math.min(Math.max(parseNumber(req.query.per) || 8, 1), 12);
    const target = dayOfYear(month, day);

    const rows = await prisma.$queryRaw<{ id: number; rn: number }[]>`
      SELECT id, rn FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY type ORDER BY ${distanceSql(target)} ASC, event_date DESC, id DESC
        ) AS rn
        FROM stories
        WHERE status = 'published' AND type IS NOT NULL AND ${scopeSql(scope)}
      ) ranked
      WHERE rn <= ${per}
    `;
    const rank = new Map(rows.map((row) => [Number(row.id), Number(row.rn)]));
    const stories = await prisma.story.findMany({ where: { id: { in: [...rank.keys()] } }, select: summarySelect });

    // Each story goes under its own type, nearest first.
    const sections: Record<string, ReturnType<typeof toSummary>[]> = {};
    for (const story of stories.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))) {
      if (!story.type) continue;
      (sections[story.type] ??= []).push(toSummary(story));
    }
    res.set('Cache-Control', PUBLIC_CACHE).json({ month, day, scope, sections });
  }),
);

/** The Shorts whose stories are nearest to one calendar day, for the AI recreations block. */
onThisDayRouter.get(
  '/shorts',
  asyncHandler(async (req, res) => {
    const { month, day } = parseDay(req.query);
    const scope = parseScope(req.query.scope);
    const limit = Math.min(Math.max(parseNumber(req.query.limit) || 4, 1), 12);
    const target = dayOfYear(month, day);

    const rows = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM stories
      WHERE status = 'published' AND ${scopeSql(scope)}
        AND EXISTS (
          SELECT 1 FROM story_media m
          WHERE m.story_id = stories.id AND m.type = 'video' AND m.url LIKE '%/shorts/%'
        )
      ORDER BY ${distanceSql(target)} ASC, event_date DESC, id DESC
      LIMIT ${limit}
    `;
    const stories = await summariesInOrder(rows.map((row) => Number(row.id)));
    res.set('Cache-Control', PUBLIC_CACHE).json(stories.map(toSummary));
  }),
);

/** Every calendar day (`MM-DD`) that has at least one published story, for the sitemap. */
onThisDayRouter.get(
  '/days',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.$queryRaw<{ md: string }[]>`
      SELECT DISTINCT DATE_FORMAT(event_date, '%m-%d') AS md FROM stories
      WHERE status = 'published' ORDER BY md
    `;
    res.set('Cache-Control', PUBLIC_CACHE).json(rows.map((row) => row.md));
  }),
);

/**
 * Everything the On This Day page shows for one calendar day: the lead story,
 * the other anniversaries of that day, and the week leading up to it.
 */
onThisDayRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const month = parseNumber(req.query.month);
    const day = parseNumber(req.query.day);
    const scope = parseScope(req.query.scope);
    const probe = new Date(Date.UTC(REFERENCE_YEAR, month - 1, day));
    if (
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      probe.getUTCMonth() !== month - 1 ||
      probe.getUTCDate() !== day
    ) {
      throw badRequest('month and day must be a real calendar day');
    }

    const [sameDay, week] = await Promise.all([
      storiesOnDays([{ month, day }], scope),
      storiesOnDays(
        Array.from({ length: WEEK_DAYS }, (_, index) => daysBefore(month, day, index + 1)),
        scope,
        WEEK_LIMIT,
      ),
    ]);

    // Newest year leads, but a story with a picture beats one without it.
    const leadIndex = Math.max(
      0,
      sameDay.findIndex((story) => story.media.some((item) => item.type === 'image')),
    );
    const lead = sameDay[leadIndex];
    const others = sameDay.filter((_, index) => index !== leadIndex);

    res.set('Cache-Control', PUBLIC_CACHE).json({
      month,
      day,
      scope,
      featured: lead ? toSummary(lead) : null,
      also: others.slice(0, ALSO_LIMIT).map(toSummary),
      week: week.map(toSummary),
    });
  }),
);
