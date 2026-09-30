import { Router, type RequestHandler } from "express";
import multer from "multer";
import { asyncHandler } from "../lib/async-handler";
import { badRequest, notFound, unauthorized } from "../lib/http-error";
import {
  createSessionToken,
  hashSessionToken,
  verifyPassword,
} from "../lib/password";
import { prisma } from "../lib/prisma";
import { param } from "../lib/request";
import { uploadStoryImage, MAX_IMAGE_BYTES } from "../lib/s3";
import { parseStoryInput } from "../lib/story-input";
import {
  attachUploadedImage,
  readStoryForAdmin,
  writeStory,
} from "../lib/story-repository";
import { formatDateOnly } from "../lib/story-view";
import { requireAdmin } from "../middleware/admin-auth";
import { rateLimit } from "../middleware/rate-limit";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

const receiveImage: RequestHandler = (req, res, next) => {
  imageUpload.single("file")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    next(
      badRequest(
        code === "LIMIT_FILE_SIZE"
          ? "Image file is too large"
          : "Image file is required",
      ),
    );
  });
};

export const adminRouter = Router();

adminRouter.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }),
  asyncHandler(async (req, res) => {
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";
    const credential = await prisma.adminCredential.findUnique({
      where: { id: 1 },
    });
    const matches =
      credential !== null &&
      (await verifyPassword(password, credential.passwordHash));

    if (!matches) {
      throw unauthorized("Incorrect password");
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await prisma.adminSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    await prisma.adminSession.create({
      data: { tokenHash: hashSessionToken(token), expiresAt },
    });

    res.json({ token, expiresAt: expiresAt.toISOString() });
  }),
);

// Everything below this line requires a valid session.
adminRouter.use(requireAdmin);

adminRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = (req.header("authorization") ?? "")
      .slice("Bearer ".length)
      .trim();
    await prisma.adminSession.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
    res.json({ ok: true });
  }),
);

adminRouter.get("/session", (_req, res) => {
  res.json({ ok: true });
});

adminRouter.get(
  "/stories",
  asyncHandler(async (_req, res) => {
    const stories = await prisma.story.findMany({
      orderBy: [{ eventDate: "desc" }, { id: "desc" }],
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
        ...story,
        eventDate: formatDateOnly(story.eventDate),
      })),
    );
  }),
);

adminRouter.get(
  "/stories/:slug",
  asyncHandler(async (req, res) => {
    res.json(await readStoryForAdmin(param(req, "slug")));
  }),
);

adminRouter.post(
  "/stories",
  asyncHandler(async (req, res) => {
    const saved = await writeStory(parseStoryInput(req.body), null);
    res.status(201).json(saved);
  }),
);

adminRouter.put(
  "/stories/:slug",
  asyncHandler(async (req, res) => {
    const existing = await prisma.story.findUnique({
      where: { slug: param(req, "slug") },
      select: { id: true, publishedAt: true },
    });
    if (!existing) {
      throw notFound("Story not found");
    }

    res.json(await writeStory(parseStoryInput(req.body), existing));
  }),
);

adminRouter.delete(
  "/stories/:slug",
  asyncHandler(async (req, res) => {
    const deleted = await prisma.story.deleteMany({
      where: { slug: param(req, "slug") },
    });
    if (deleted.count === 0) {
      throw notFound("Story not found");
    }
    res.json({ ok: true });
  }),
);

adminRouter.post(
  "/uploads",
  receiveImage,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw badRequest("Image file is required");
    }

    const uploaded = await uploadStoryImage(req.file);
    const slug = textField(req.body, "slug");
    const mediaKey = textField(req.body, "mediaKey") || uploaded.mediaKey;

    if (slug) {
      await attachUploadedImage(slug, mediaKey, uploaded.url);
    }

    res.status(201).json({ url: uploaded.url, mediaKey });
  }),
);

function textField(body: unknown, name: string) {
  if (!body || typeof body !== "object") return "";
  const value = (body as Record<string, unknown>)[name];
  return typeof value === "string" ? value.trim() : "";
}
