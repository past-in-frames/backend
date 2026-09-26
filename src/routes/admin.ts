import { Prisma } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler';
import { badRequest, conflict, notFound, unauthorized } from '../lib/http-error';
import { routeParam } from '../lib/params';
import { createSessionToken, hashSessionToken, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { uploadStoryImage } from '../lib/s3';
import { parseStoryBody, type NormalizedStory, type StoryBodyBlock } from '../lib/story-input';
import { validateBody } from '../lib/validate';

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const receiveImage: RequestHandler = (req, res, next) => {
  imageUpload.single('file')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    const code =
      error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    next(badRequest(code === 'LIMIT_FILE_SIZE' ? 'Image file is too large' : 'Image file is required'));
  });
};

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const loginSchema = z.object({
  password: z.string(),
});

export const adminRouter = Router();

adminRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const credential = await prisma.adminCredential.findUnique({ where: { id: 1 } });
    const password = String(req.body.password);
    const matches =
      credential !== null && (await verifyPassword(password, credential.passwordHash));

    if (!matches) {
      throw unauthorized('Incorrect password');
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await prisma.adminSession.create({
      data: {
        tokenHash: hashSessionToken(token),
        expiresAt,
      },
    });

    res.json({ token, expiresAt: expiresAt.toISOString() });
  }),
);

adminRouter.get(
  '/session',
  asyncHandler(async (req, res) => {
    await requireAdmin(req);
    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/stories',
  asyncHandler(async (req, res) => {
    await requireAdmin(req);
    const stories = await prisma.story.findMany({
      orderBy: [{ eventDate: 'desc' }, { id: 'desc' }],
      select: {
        slug: true,
        title: true,
        summary: true,
        eventDate: true,
        category: true,
        status: true,
      },
    });

    res.json(
      stories.map((story) => ({
        slug: story.slug,
        title: story.title,
        summary: story.summary,
        eventDate: formatDateOnly(story.eventDate),
        category: story.category,
        status: story.status,
      })),
    );
  }),
);

adminRouter.get(
  '/stories/:slug',
  asyncHandler(async (req, res) => {
    await requireAdmin(req);
    res.json(await readStory(routeParam(req.params.slug)));
  }),
);

adminRouter.post(
  '/stories',
  asyncHandler(async (req, res) => {
    await requireAdmin(req);
    const input = parseStoryBody(req.body);
    const saved = await writeStory(input, null);
    res.status(201).json(saved);
  }),
);

adminRouter.put(
  '/stories/:slug',
  asyncHandler(async (req, res) => {
    await requireAdmin(req);
    const existing = await prisma.story.findUnique({
      where: { slug: routeParam(req.params.slug) },
    });
    if (!existing) {
      throw notFound('Story not found');
    }

    const input = parseStoryBody(req.body);
    const saved = await writeStory(input, existing);
    res.json(saved);
  }),
);

adminRouter.delete(
  '/stories/:slug',
  asyncHandler(async (req, res) => {
    await requireAdmin(req);
    const existing = await prisma.story.findUnique({
      where: { slug: routeParam(req.params.slug) },
    });
    if (!existing) {
      throw notFound('Story not found');
    }

    await prisma.story.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/uploads',
  (req, _res, next) => {
    void requireAdmin(req).then(() => next()).catch(next);
  },
  receiveImage,
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      throw badRequest('Image file is required');
    }
    const uploaded = await uploadStoryImage({
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    });
    const slug = textField(req.body, 'slug');
    const mediaKey = textField(req.body, 'mediaKey') || uploaded.mediaKey;
    if (slug) {
      await saveMediaUrl(slug, mediaKey, uploaded.url);
    }
    res.status(201).json({ url: uploaded.url, mediaKey });
  }),
);

async function saveMediaUrl(slug: string, key: string, url: string) {
  if (!key || key.length > 191) {
    throw badRequest('Each media item needs a key');
  }
  if (!/^https?:\/\//.test(url) || url.length > 512) {
    throw badRequest('Media URL must be an http(s) address or empty');
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
    data: {
      storyId: story.id,
      key,
      type: 'image',
      url,
      sortOrder,
    },
  });
}

function textField(body: unknown, name: string) {
  if (!body || typeof body !== 'object' || !(name in body)) return '';
  const value = (body as Record<string, unknown>)[name];
  return typeof value === 'string' ? value.trim() : '';
}

async function readStory(slug: string) {
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

  const body = readBody(story.body);
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

async function writeStory(
  input: NormalizedStory,
  existing: { id: number; publishedAt: Date | null } | null,
) {
  const publishedAt =
    input.status === 'published' ? (existing?.publishedAt ?? new Date()) : null;

  try {
    const saved = await prisma.$transaction(
      async (tx) => {
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

    return readStory(saved.slug);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('A story with that slug already exists');
    }
    throw error;
  }
}

function readBody(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const blocks: StoryBodyBlock[] = [];
  for (const block of parsed) {
    if (!block || typeof block !== 'object') continue;
    const record = block as Record<string, unknown>;
    if (record.type === 'paragraph' && typeof record.text === 'string') {
      blocks.push({ type: 'paragraph', text: record.text });
    } else if (record.type === 'heading' && typeof record.text === 'string') {
      blocks.push({ type: 'heading', text: record.text });
    } else if (record.type === 'image' && typeof record.mediaKey === 'string') {
      blocks.push({ type: 'image', mediaKey: record.mediaKey });
    }
  }
  return blocks;
}

async function requireAdmin(req: { header(name: string): string | undefined }) {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) {
    throw unauthorized('Not signed in');
  }

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
  });

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) {
      await prisma.adminSession.delete({ where: { tokenHash: session.tokenHash } });
    }
    throw unauthorized('Not signed in');
  }
}

function formatDateOnly(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
