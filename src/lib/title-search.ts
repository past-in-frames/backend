import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Searching stories by title only.
 *
 * `LIKE '%word%'` cannot use an index, so it reads every title. With the
 * `stories_title_fulltext` index (see the title_fulltext migration) a search
 * finds titles that contain every typed word, and the last word may be a
 * prefix, so "apol" finds "Apollo". Until that index exists the search falls
 * back to LIKE, which returns the same stories, only slower.
 */

/** MySQL's own stopword list for InnoDB full-text indexes: words it never indexes. */
const STOPWORDS = new Set([
  'a', 'about', 'an', 'are', 'as', 'at', 'be', 'by', 'com', 'de', 'en', 'for', 'from', 'how', 'i', 'in', 'is',
  'it', 'la', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'what', 'when', 'where', 'who', 'will',
  'with', 'und', 'www',
]);

const MAX_WORDS = 8;
const MAX_WORD_LENGTH = 40;
const MAX_MATCHES = 5000;

/** Lower-case words made of letters and digits only, so no search operator can reach MySQL. */
export function titleWords(query: string): string[] {
  const words = query
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => !STOPWORDS.has(word))
    .map((word) => word.slice(0, MAX_WORD_LENGTH));
  return [...new Set(words)].slice(0, MAX_WORDS);
}

/** `+apollo +moon*`: every word is required, and each may continue into a longer word. */
export function booleanQuery(words: string[]) {
  return words.map((word) => `+${word}*`).join(' ');
}

/** Used to read the server's settings, and swapped for a scratch database in tests. */
type Db = Pick<typeof prisma, '$queryRaw'>;

let available = false;
/** Words shorter than this are not in the full-text index (InnoDB default: 3). */
let minToken = 3;
let checkedAt = 0;
const RECHECK_MS = 60_000;

/** True once the full-text index exists. A missing index is rechecked every minute, so no restart is needed after the migration. */
async function fulltextAvailable(db: Db) {
  if (available) return true;
  if (Date.now() - checkedAt < RECHECK_MS) return false;
  checkedAt = Date.now();
  try {
    const rows = await db.$queryRaw<{ min_token: bigint | number }[]>`
      SELECT @@innodb_ft_min_token_size AS min_token
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'stories'
        AND index_type = 'FULLTEXT' AND column_name = 'title'
      LIMIT 1
    `;
    available = rows.length > 0;
    if (available) minToken = Number(rows[0].min_token) || 3;
  } catch {
    available = false;
  }
  return available;
}

/**
 * Ids of the published stories whose title matches every word, or null when the
 * search has to fall back to LIKE (no index yet, or no word long enough to be
 * indexed). Words the index cannot hold, such as the 7 in "Venera 7", are
 * checked against the title directly.
 */
export async function matchingTitleIds(query: string, db: Db = prisma): Promise<number[] | null> {
  const words = titleWords(query);
  const indexed = words.filter((word) => word.length >= minToken);
  if (indexed.length === 0 || !(await fulltextAvailable(db))) return null;
  // minToken is read by the check above, so split again now that it is known.
  const long = words.filter((word) => word.length >= minToken);
  const short = words.filter((word) => word.length < minToken);
  if (long.length === 0) return null;

  try {
    // Words are only letters and digits, so they are safe in a pattern. `\\b` is a word boundary: the word must start a word.
    const checks = short.map((word) => Prisma.sql`AND title REGEXP ${`\\b${word}`}`);
    const rows = await db.$queryRaw<{ id: number }[]>`
      SELECT id FROM stories
      WHERE status = 'published' AND MATCH(title) AGAINST (${booleanQuery(long)} IN BOOLEAN MODE)
      ${checks.length > 0 ? Prisma.join(checks, ' ') : Prisma.empty}
      LIMIT ${Prisma.raw(String(MAX_MATCHES))}
    `;
    return rows.map((row) => Number(row.id));
  } catch {
    // If the index is dropped or broken, searching must keep working.
    available = false;
    return null;
  }
}
