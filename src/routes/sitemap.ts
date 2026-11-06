import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { prisma } from '../lib/prisma';
import { STORY_TYPES } from '../lib/story-types';

export const sitemapRouter = Router();

const PUBLIC_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';
const SECTION_TYPES: string[] = [...STORY_TYPES];

function newest(...dates: (Date | null | undefined)[]) {
  const times = dates.flatMap((date) => (date ? [date.getTime()] : []));
  return times.length ? new Date(Math.max(...times)) : null;
}

/**
 * Everything the sitemap lists, in one small response: every published story
 * with its last change and first image, the calendar days that have stories,
 * collections, topics and sections with the date of their newest story.
 */
sitemapRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [stories, days, topics, collections, video] = await Promise.all([
      prisma.story.findMany({
        where: { status: 'published', type: { in: SECTION_TYPES } },
        orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
        select: {
          slug: true,
          type: true,
          updatedAt: true,
          media: {
            where: { type: 'image', url: { not: null } },
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { url: true },
          },
        },
      }),
      prisma.$queryRaw<{ md: string; updated: Date }[]>`
        SELECT DATE_FORMAT(event_date, '%m-%d') AS md, MAX(updated_at) AS updated
        FROM stories WHERE status = 'published' GROUP BY md ORDER BY md
      `,
      prisma.$queryRaw<{ topic: string; updated: Date }[]>`
        SELECT t.topic AS topic, MAX(s.updated_at) AS updated
        FROM story_topics t JOIN stories s ON s.id = t.story_id
        WHERE s.status = 'published' GROUP BY t.topic
      `,
      prisma.collection.findMany({
        where: { status: 'published' },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: {
          slug: true,
          updatedAt: true,
          stories: { where: { story: { status: 'published' } }, select: { story: { select: { updatedAt: true } } } },
        },
      }),
      prisma.story.findFirst({
        where: { status: 'published', media: { some: { type: 'video', url: { not: null } } } },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    const sections: Record<string, Date | null> = {};
    for (const type of SECTION_TYPES) {
      sections[type] = newest(...stories.filter((story) => story.type === type).map((story) => story.updatedAt));
    }
    const topicDates: Record<string, Date | null> = {};
    for (const row of topics) topicDates[row.topic] = new Date(row.updated);
    // Science is also a section, so its newest change counts for the topic as well.
    topicDates.science = newest(topicDates.science, sections.science);

    res.set('Cache-Control', PUBLIC_CACHE).json({
      generatedAt: new Date().toISOString(),
      latest: newest(...stories.map((story) => story.updatedAt))?.toISOString() ?? null,
      stories: stories.map((story) => ({
        slug: story.slug,
        type: story.type,
        updatedAt: story.updatedAt.toISOString(),
        image: story.media[0]?.url ?? null,
      })),
      days: days.map((row) => ({ day: row.md, updatedAt: new Date(row.updated).toISOString() })),
      topics: Object.fromEntries(Object.entries(topicDates).map(([topic, date]) => [topic, date?.toISOString() ?? null])),
      sections: Object.fromEntries(Object.entries(sections).map(([type, date]) => [type, date?.toISOString() ?? null])),
      // A collection with no published stories would be an empty page, so it is left out.
      collections: collections
        .filter((collection) => collection.stories.length > 0)
        .map((collection) => ({
          slug: collection.slug,
          updatedAt: (newest(collection.updatedAt, ...collection.stories.map((link) => link.story.updatedAt)) as Date).toISOString(),
          storyCount: collection.stories.length,
        })),
      watch: video?.updatedAt.toISOString() ?? null,
    });
  }),
);
