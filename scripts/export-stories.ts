/**
 * Copy every story from the database into scripts/stories.json.
 *
 *   npm run db:tunnel
 *   npx tsx scripts/export-stories.ts
 */
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import type { StoryBodyBlock } from "../src/lib/story-input";
import { formatDateOnly, parseStoredBody } from "../src/lib/story-view";

/** Text sections in the shape scripts/import_stories.py reads back. */
function storySections(blocks: StoryBodyBlock[]) {
  const sections: { heading?: string; text?: string }[] = [];
  for (const block of blocks) {
    if (block.type === "image") continue;
    if (block.type === "heading") {
      sections.push({ heading: block.text });
      continue;
    }
    const previous = sections.at(-1);
    if (previous?.heading && previous.text === undefined) {
      previous.text = block.text;
      continue;
    }
    sections.push({ text: block.text });
  }
  return sections;
}

async function main() {
  const rows = await prisma.story.findMany({
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      sources: { orderBy: { id: "asc" } },
    },
    orderBy: [{ eventDate: "asc" }, { slug: "asc" }],
  });

  const stories = rows.map((story) => {
    const body = parseStoredBody(story.body);
    return {
      slug: story.slug,
      title: story.title,
      excerpt: story.summary,
      eventDate: formatDateOnly(story.eventDate),
      type: story.type,
      subtype: story.subtype,
      status: story.status,
      story: storySections(body),
      body,
      media: story.media.map((item) => ({
        key: item.key,
        type: item.type,
        url: item.url,
        altText: item.altText,
        caption: item.caption,
        credit: item.credit,
        isAiGenerated: item.isAiGenerated,
      })),
      sources: story.sources.map((source) => ({
        title: source.title,
        url: source.url,
        publisher: source.publisher,
      })),
    };
  });

  const target = new URL("./stories.json", import.meta.url);
  writeFileSync(target, `${JSON.stringify(stories, null, 2)}\n`);
  console.log(`wrote ${stories.length} stories`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
