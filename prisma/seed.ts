import { redactSecrets } from "../src/lib/database-url";
import { prisma } from "../src/lib/prisma";

const storySeeds: StorySeed[] = [];

interface StorySeed {
  slug: string;
  title: string;
  summary: string;
  body: any[];
  eventDate: Date;
  category: string;
  type: string | null;
  subtype: string | null;
  status: "draft" | "published";
  publishedAt: Date | null;
  sources?: {
    title: string;
    url: string;
    publisher: string;
  }[];
  media?: {
    key: string;
    type: "image" | "video";
    url: string | null;
    caption: string | null;
    altText: string | null;
    credit: string | null;
    isAiGenerated: boolean;
    sortOrder: number;
  }[];
}

const adminPasswordHash =
  "scrypt$S1Dj3nw1Z5bhqJLJOZBwpg$a1aZfYSzs3yutsmLJ7XnS45HiP8pK_UfRy_oOBGPYBU";

async function main() {
  await prisma.adminCredential.upsert({
    where: { id: 1 },
    create: { id: 1, passwordHash: adminPasswordHash },
    update: { passwordHash: adminPasswordHash },
  });
  console.log("seeded admin credential");

  for (const storySeed of storySeeds) {
    const body = JSON.stringify(storySeed.body);

    for (const item of storySeed.media ?? []) {
      if (item.url !== null && !/^https?:\/\//.test(item.url)) {
        throw new Error(
          "Story media URL must be a real http(s) address or null. Do not invent one.",
        );
      }
    }

    const story = await prisma.$transaction(
      async (tx) => {
        const saved = await tx.story.upsert({
          where: { slug: storySeed.slug },
          create: {
            slug: storySeed.slug,
            title: storySeed.title,
            summary: storySeed.summary,
            body,
            eventDate: storySeed.eventDate,
            category: storySeed.category,
            type: storySeed.type,
            subtype: storySeed.subtype,
            status: storySeed.status,
            publishedAt: storySeed.publishedAt,
          },
          update: {
            title: storySeed.title,
            summary: storySeed.summary,
            body,
            eventDate: storySeed.eventDate,
            category: storySeed.category,
            type: storySeed.type,
            subtype: storySeed.subtype,
            status: storySeed.status,
            publishedAt: storySeed.publishedAt,
          },
        });

        for (const source of storySeed.sources ?? []) {
          await tx.storySource.upsert({
            where: {
              storyId_url: {
                storyId: saved.id,
                url: source.url,
              },
            },
            create: {
              storyId: saved.id,
              title: source.title,
              url: source.url,
              publisher: source.publisher,
            },
            update: {
              title: source.title,
              publisher: source.publisher,
            },
          });
        }

        for (const item of storySeed.media ?? []) {
          const data = {
            type: item.type,
            url: item.url,
            caption: item.caption,
            altText: item.altText,
            credit: item.credit,
            isAiGenerated: item.isAiGenerated,
            sortOrder: item.sortOrder,
          };
          await tx.storyMedia.upsert({
            where: {
              storyId_key: {
                storyId: saved.id,
                key: item.key,
              },
            },
            create: {
              storyId: saved.id,
              key: item.key,
              ...data,
            },
            update: data,
          });
        }

        return saved;
      },
      { timeout: 30_000 },
    );

    const [stories, sources, media] = await Promise.all([
      prisma.story.count({ where: { slug: storySeed.slug } }),
      prisma.storySource.count({ where: { storyId: story.id } }),
      prisma.storyMedia.count({ where: { storyId: story.id } }),
    ]);

    console.log(
      `seeded slug=${storySeed.slug} stories=${stories} sources=${sources} media=${media}`,
    );
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redactSecrets(message));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
