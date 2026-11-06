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
const WEEK_LIMIT = 3;

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
