/**
 * Change only the `type` of stories listed in a mapping file. Nothing else is touched.
 *
 *   npm run db:tunnel
 *   npx tsx scripts/export-stories.ts scripts/daily/backups/<date>-before-retype.json   # backup first
 *   npx tsx scripts/retype-stories.ts scripts/daily/batches/retype-other.json --dry-run
 *   npx tsx scripts/retype-stories.ts scripts/daily/batches/retype-other.json
 *
 * The file is a JSON array of { slug, from, to }. A story is changed only when its
 * current type is `from`, so running the script twice, or on a story someone has
 * already moved, does nothing.
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { isStoryType } from "../src/lib/story-types";

type Move = { slug: string; from: string; to: string };

async function main() {
  const args = process.argv.slice(2);
  const path = args.find((arg) => !arg.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  if (!path) throw new Error("Pass the mapping file, for example scripts/daily/batches/retype-other.json");

  const moves = JSON.parse(readFileSync(path, "utf8")) as Move[];
  if (!Array.isArray(moves) || moves.length === 0) throw new Error("Expected a non-empty JSON array");
  const slugs = new Set<string>();
  for (const move of moves) {
    if (!move.slug || slugs.has(move.slug)) throw new Error(`Missing or repeated slug: ${move.slug}`);
    slugs.add(move.slug);
    if (!isStoryType(move.to)) throw new Error(`${move.slug}: "${move.to}" is not a story type`);
  }

  const rows = await prisma.story.findMany({ where: { slug: { in: [...slugs] } }, select: { slug: true, type: true } });
  const current = new Map(rows.map((row) => [row.slug, row.type]));

  let changed = 0;
  let skipped = 0;
  const perType: Record<string, number> = {};
  for (const move of moves) {
    const now = current.get(move.slug);
    if (now === undefined) {
      console.log(`missing   ${move.slug}`);
      skipped += 1;
    } else if (now !== move.from) {
      console.log(`skipped   ${move.slug} (type is ${now}, not ${move.from})`);
      skipped += 1;
    } else {
      if (!dryRun) await prisma.story.updateMany({ where: { slug: move.slug, type: move.from }, data: { type: move.to } });
      perType[move.to] = (perType[move.to] ?? 0) + 1;
      changed += 1;
    }
  }
  console.log(`${dryRun ? "would change" : "changed"} ${changed}, skipped ${skipped}`, perType);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
