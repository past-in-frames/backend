import { z } from 'zod';
import { badRequest } from './http-error';

const storySchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  eventDate: z.string(),
  status: z.enum(['draft', 'published']),
  type: z.string().nullable().optional(),
  subtype: z.string().nullable().optional(),
  body: z.array(
    z.object({
      type: z.enum(['paragraph', 'heading', 'image']),
      text: z.string().optional(),
      mediaKey: z.string().optional(),
    }),
  ),
  media: z.array(
    z.object({
      key: z.string(),
      type: z.enum(['image', 'video']),
      url: z.string().nullable().optional(),
      altText: z.string().nullable().optional(),
      caption: z.string().nullable().optional(),
      credit: z.string().nullable().optional(),
      isAiGenerated: z.boolean().optional(),
    }),
  ),
  sources: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      publisher: z.string(),
    }),
  ),
});

export type StoryBodyBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'image'; mediaKey: string };

export type NormalizedStory = {
  slug: string;
  title: string;
  summary: string;
  eventDate: Date;
  status: 'draft' | 'published';
  type: string | null;
  subtype: string | null;
  body: StoryBodyBlock[];
  media: {
    key: string;
    type: 'image' | 'video';
    url: string | null;
    altText: string | null;
    caption: string | null;
    credit: string | null;
    isAiGenerated: boolean;
  }[];
  sources: { title: string; url: string; publisher: string }[];
};

export function parseStoryInput(body: unknown) {
  const parsed = storySchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((issue) => issue.message).join('; '));
  }

  return normalizeStory(parsed.data);
}

function normalizeStory(input: z.infer<typeof storySchema>): NormalizedStory {
  const slug = input.slug.trim();
  const title = input.title.trim();
  const summary = input.summary.trim();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 191) {
    throw badRequest('Slug can use lowercase letters, numbers, and hyphens');
  }
  if (!title || title.length > 191) {
    throw badRequest('Title is required');
  }
  if (!summary || summary.length > 10000) {
    throw badRequest('Summary is required');
  }
  if (input.body.length > 200 || input.media.length > 50 || input.sources.length > 50) {
    throw badRequest('This story has too many sections');
  }

  const body = input.body.map((block) => {
    if (block.type === 'image') {
      const mediaKey = block.mediaKey?.trim() ?? '';
      if (!mediaKey || mediaKey.length > 191) {
        throw badRequest('Each image block needs a media key');
      }
      return { type: 'image' as const, mediaKey };
    }

    const text = block.text?.trim() ?? '';
    if (!text || text.length > 20000) {
      throw badRequest(
        block.type === 'heading' ? 'Each heading needs text' : 'Each paragraph needs text',
      );
    }
    return { type: block.type, text };
  });

  const media = input.media.map((item) => {
    const key = item.key.trim();
    if (!key || key.length > 191) {
      throw badRequest('Each media item needs a key');
    }
    return {
      key,
      type: item.type,
      url: optionalUrl(item.url, 'Media URL must be an http(s) address or empty'),
      altText: optionalText(item.altText),
      caption: optionalText(item.caption),
      credit: optionalText(item.credit),
      isAiGenerated: item.isAiGenerated ?? false,
    };
  });

  const sources = input.sources.map((source) => {
    const titleText = source.title.trim();
    const publisher = source.publisher.trim();
    const url = source.url.trim();
    if (!titleText || titleText.length > 191) {
      throw badRequest('Each source needs a title');
    }
    if (!publisher || publisher.length > 191) {
      throw badRequest('Each source needs a publisher');
    }
    if (!/^https?:\/\//.test(url) || url.length > 512) {
      throw badRequest('Each source needs an http(s) URL');
    }
    return { title: titleText, url, publisher };
  });

  const mediaKeys = new Set(media.map((item) => item.key));
  if (mediaKeys.size !== media.length) {
    throw badRequest('Media keys must be unique');
  }
  for (const block of body) {
    if (block.type !== 'image' || mediaKeys.has(block.mediaKey)) continue;
    media.push({
      key: block.mediaKey,
      type: 'image',
      url: null,
      altText: null,
      caption: null,
      credit: null,
      isAiGenerated: false,
    });
    mediaKeys.add(block.mediaKey);
  }
  if (media.length > 50) {
    throw badRequest('This story has too many sections');
  }

  const sourceUrls = new Set(sources.map((source) => source.url));
  if (sourceUrls.size !== sources.length) {
    throw badRequest('Source URLs must be unique');
  }

  return {
    slug,
    title,
    summary,
    eventDate: eventDateFromInput(input.eventDate),
    status: input.status,
    type: optionalText(input.type),
    subtype: optionalText(input.subtype),
    body,
    media,
    sources,
  };
}

function optionalText(value: string | null | undefined) {
  const text = value?.trim() ?? '';
  if (text.length > 5000) {
    throw badRequest('One of the text fields is too long');
  }
  return text === '' ? null : text;
}

function optionalUrl(value: string | null | undefined, message: string) {
  const url = value?.trim() ?? '';
  if (url === '') return null;
  if (!/^https?:\/\//.test(url) || url.length > 512) {
    throw badRequest(message);
  }
  return url;
}

function eventDateFromInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw badRequest('Event date must be YYYY-MM-DD');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw badRequest('Event date is not a real calendar date');
  }

  return date;
}
