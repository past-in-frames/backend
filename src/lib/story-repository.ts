import { Prisma } from '@prisma/client';
import { badRequest, conflict, notFound } from './http-error';
import { prisma } from './prisma';
import type { NormalizedStory } from './story-input';
import { formatDateOnly, parseStoredBody } from './story-view';

const storyDetail = {
  media: { orderBy: { sortOrder: 'asc' } },
  sources: { orderBy: { id: 'asc' } },
} satisfies Prisma.StoryInclude;

/**
 * Returns a story shaped for the admin form. Image blocks whose media row is
 * missing get an empty placeholder so the editor can still fill in a URL.
 */
export async function readStoryForAdmin(slug: string) {
  const story = await prisma.story.findUnique({ where: { slug }, include: storyDetail });
  if (!story) {
    throw notFound('Story not found');
  }

  const body = parseStoredBody(story.body);
  const media = story.media.map((item) => ({
    key: item.key,
    type: item.type,
    url: item.url ?? '',
    altText: item.altText ?? '',
    caption: item.caption ?? '',
    credit: item.credit ?? '',
    isAiGenerated: item.isAiGenerated,
  }));

  const knownKeys = new Set(media.map((item) => item.key));
  for (const block of body) {
    if (block.type !== 'image' || knownKeys.has(block.mediaKey)) continue;
    media.push({
      key: block.mediaKey,
      type: 'image',
      url: '',
      altText: '',
      caption: '',
      credit: '',
      isAiGenerated: false,
    });
    knownKeys.add(block.mediaKey);
  }

  return {
    slug: story.slug,
    title: story.title,
    summary: story.summary,
    eventDate: formatDateOnly(story.eventDate),
    category: story.category,
    status: story.status,
    type: story.type ?? '',
    subtype: story.subtype ?? '',
    body,
    media,
    sources: story.sources.map((source) => ({
      title: source.title,
      url: source.url,
      publisher: source.publisher,
    })),
  };
}

/**
 * Media and sources are replaced wholesale rather than diffed: the editor always
 * submits the complete story, and the row counts are small.
 */
export async function writeStory(
  input: NormalizedStory,
  existing: { id: number; publishedAt: Date | null } | null,
) {
  const publishedAt = input.status === 'published' ? (existing?.publishedAt ?? new Date()) : null;

  const data = {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    body: JSON.stringify(input.body),
    eventDate: input.eventDate,
    category: input.category,
    type: input.type,
    subtype: input.subtype,
    status: input.status,
    publishedAt,
  };

  try {
    const saved = await prisma.$transaction(
      async (tx) => {
        const story = existing
          ? await tx.story.update({ where: { id: existing.id }, data })
          : await tx.story.create({ data });

        await tx.storyMedia.deleteMany({ where: { storyId: story.id } });
        await tx.storySource.deleteMany({ where: { storyId: story.id } });

        if (input.media.length > 0) {
          await tx.storyMedia.createMany({
            data: input.media.map((item, index) => ({
              storyId: story.id,
              key: item.key,
              type: item.type,
              url: item.url,
              altText: item.altText,
              caption: item.caption,
              credit: item.credit,
              isAiGenerated: item.isAiGenerated,
              sortOrder: index,
            })),
          });
        }

        if (input.sources.length > 0) {
          await tx.storySource.createMany({
            data: input.sources.map((source) => ({
              storyId: story.id,
              title: source.title,
              url: source.url,
              publisher: source.publisher,
            })),
          });
        }

        return story;
      },
      { timeout: 30_000 },
    );

    return readStoryForAdmin(saved.slug);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('A story with that slug already exists');
    }
    throw error;
  }
}

/** Attaches a freshly uploaded image to a story that already exists. */
export async function attachUploadedImage(slug: string, key: string, url: string) {
  if (!key || key.length > 191) {
    throw badRequest('Each media item needs a key');
  }

  const story = await prisma.story.findUnique({
    where: { slug },
    include: { media: { select: { id: true, key: true, sortOrder: true } } },
  });
  if (!story) {
    throw notFound('Story not found');
  }

  const existing = story.media.find((item) => item.key === key);
  if (existing) {
    await prisma.storyMedia.update({
      where: { id: existing.id },
      data: { url, type: 'image' },
    });
    return;
  }

  const sortOrder = story.media.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
  await prisma.storyMedia.create({
    data: { storyId: story.id, key, type: 'image', url, sortOrder },
  });
}
