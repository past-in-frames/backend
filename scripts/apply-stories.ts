/**
 * Upsert stories from a JSON file into the database.
 * Uses the body, media, and sources in the file. The text-only `story`
 * field is ignored so image blocks stay in place.
 *
 *   npm run db:tunnel
 *   npx tsx scripts/apply-stories.ts scripts/stories-updated.json [--dry-run] [--insert-only]
 *
 * --dry-run      Validate every story and say what would happen; write nothing.
 * --insert-only  Stop if a slug already exists, instead of overwriting that story.
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { parseStoryInput } from "../src/lib/story-input";
import { writeStory } from "../src/lib/story-repository";

async function main() {
  const args = process.argv.slice(2);
  const path = args.find((arg) => !arg.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const insertOnly = args.includes("--insert-only");
  if (!path) {
    throw new Error("Pass the JSON file, for example scripts/stories-updated.json");
  }

  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Expected a non-empty JSON array of stories");
  }

  const stories = raw.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("Each story must be an object");
    }
    const record = item as Record<string, unknown>;
    return parseStoryInput({
      slug: record.slug,
      title: record.title,
      summary: record.excerpt ?? record.summary,
      eventDate: record.eventDate,
      status: record.status,
      type: record.type,
      subtype: record.subtype,
      region: record.region,
      topics: record.topics,
      body: record.body,
      media: record.media,
      sources: record.sources,
    });
  });

  let updated = 0;
  let inserted = 0;
  for (const story of stories) {
    const existing = await prisma.story.findUnique({
      where: { slug: story.slug },
      select: { id: true, publishedAt: true },
    });
    if (existing && insertOnly) {
      throw new Error(`${story.slug} already exists; nothing was written for it (--insert-only)`);
    }
    if (dryRun) {
      console.log(`${existing ? "would update" : "would insert"} ${story.slug} (${story.status}, ${story.type}, ${story.media.length} media, ${story.sources.length} sources)`);
      continue;
    }
    await writeStory(story, existing);
    if (existing) {
      updated += 1;
      console.log(`updated ${story.slug}`);
    } else {
      inserted += 1;
      console.log(`inserted ${story.slug}`);
    }
  }

  console.log(dryRun ? `dry run finished, nothing written` : `done: updated=${updated} inserted=${inserted}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
