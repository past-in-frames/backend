/**
 * Checks a daily batch file before anyone reads it. Reads the database (never writes).
 *
 *   npm run db:tunnel
 *   npx tsx scripts/daily/check-batch.ts scripts/daily/batches/2026-11-06.json 11-06
 *
 * The second argument is the calendar day (MM-DD) every story must fall on.
 * Exit code 1 means at least one error. Warnings need a human look but do not fail.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';
import { prisma } from '../../src/lib/prisma';
import { parseStoryInput } from '../../src/lib/story-input';
import { STORY_TYPES } from '../../src/lib/story-types';

dotenv.config({ override: true, quiet: true });

type Config = {
  perDay: { long: number; short: number };
  tiers: Record<'long' | 'short', { paragraphWords: [number, number]; sections: [number, number]; sources: [number, number] }>;
  sources: { blockedDomains: string[]; okStatuses: number[] };
  forbiddenWords: string[];
  region: string[];
  topics: string[];
  images: { maxBytes: number };
  status: string;
};

const config = JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf8')) as Config;
const USER_AGENT = 'Mozilla/5.0 (compatible; PastInFramesChecker/1.0)';

type Item = Record<string, unknown> & { tier?: string };
type Report = { errors: string[]; warnings: string[] };

const words = (text: string) => text.split(/\s+/).filter(Boolean);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fetchText(url: string) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const text = response.ok && /text|html|xml|json/.test(response.headers.get('content-type') ?? '') ? await response.text() : '';
    return { status: response.status, text };
  } catch {
    return { status: 0, text: '' };
  }
}

async function imageBytes(url: string) {
  try {
    const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(20000) });
    const length = Number(head.headers.get('content-length'));
    if (head.ok && length > 0) return { status: head.status, bytes: length };
    const get = await fetch(url, { signal: AbortSignal.timeout(20000) });
    return { status: get.status, bytes: get.ok ? (await get.arrayBuffer()).byteLength : 0 };
  } catch {
    return { status: 0, bytes: 0 };
  }
}

function plainText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function longestSharedRun(story: string[], source: string[]) {
  const seen = new Set<string>();
  const size = 8;
  for (let i = 0; i + size <= source.length; i++) seen.add(source.slice(i, i + size).join(' '));
  for (let i = 0; i + size <= story.length; i++) {
    if (seen.has(story.slice(i, i + size).join(' '))) return story.slice(i, i + size).join(' ');
  }
  return null;
}

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'over', 'after', 'its', 'his', 'her', 'are', 'was', 'is', 'in', 'on', 'of', 'to', 'a', 'an', 'at', 'by']);
const keywords = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9']+/g)?.filter((word) => word.length > 2 && !STOP.has(word)) ?? []);

type Existing = { slugs: Set<string>; byDate: Map<string, { slug: string; title: string }[]> };

async function checkStory(item: Item, day: string, existing: Existing, seenSlugs: Set<string>): Promise<Report> {
  const report: Report = { errors: [], warnings: [] };
  const fail = (message: string) => report.errors.push(message);
  const warn = (message: string) => report.warnings.push(message);

  let story: ReturnType<typeof parseStoryInput>;
  try {
    story = parseStoryInput(item);
  } catch (error) {
    fail(`invalid shape: ${error instanceof Error ? error.message : String(error)}`);
    return report;
  }

  const tier = item.tier === 'long' || item.tier === 'short' ? item.tier : null;
  if (!tier) fail('tier must be "long" or "short"');
  const rules = tier ? config.tiers[tier] : null;

  if (story.status !== config.status) fail(`status must be "${config.status}" (it is "${story.status}")`);
  if (!story.type || !(STORY_TYPES as readonly string[]).includes(story.type)) fail(`unknown type "${story.type}"`);
  if (!story.region || !config.region.includes(story.region)) fail('region must be "us" or "world"');
  if (story.topics.some((topic) => !config.topics.includes(topic))) fail('unknown topic');
  const iso = story.eventDate.toISOString().slice(0, 10);
  if (iso.slice(5) !== day) fail(`eventDate ${iso} is not on ${day}`);
  if (seenSlugs.has(story.slug)) fail(`slug "${story.slug}" appears twice in this batch`);
  seenSlugs.add(story.slug);
  if (existing.slugs.has(story.slug)) fail(`slug "${story.slug}" already exists in the database`);
  // The same event can sit in the database under another slug, so compare stories of the same date by title words.
  for (const other of existing.byDate.get(iso) ?? []) {
    const mine = keywords(story.title);
    const shared = [...keywords(other.title)].filter((word) => mine.has(word));
    const message = `a story from ${iso} already exists: ${other.slug} ("${other.title}")`;
    if (shared.length >= 2) fail(`likely duplicate: ${message}`);
    else warn(`${message}; check that it is a different event`);
  }
  if (story.summary.length > 320) warn(`summary is ${story.summary.length} characters`);

  const paragraphs = story.body.flatMap((block) => (block.type === 'paragraph' ? [block.text] : []));
  const headings = story.body.filter((block) => block.type === 'heading').length;
  const wordCount = words(paragraphs.join(' ')).length;
  if (rules) {
    if (wordCount < rules.paragraphWords[0] || wordCount > rules.paragraphWords[1]) {
      fail(`${wordCount} words; ${tier} stories need ${rules.paragraphWords.join('-')}`);
    }
    if (headings < rules.sections[0] || headings > rules.sections[1]) fail(`${headings} sections; ${tier} stories need ${rules.sections.join('-')}`);
    if (story.sources.length < rules.sources[0] || story.sources.length > rules.sources[1]) {
      fail(`${story.sources.length} sources; ${tier} stories need ${rules.sources.join('-')}`);
    }
  }

  const fullText = [story.title, story.summary, ...story.body.flatMap((block) => ('text' in block ? [block.text] : []))].join('\n');
  for (const word of config.forbiddenWords) {
    if (new RegExp(`\\b${escapeRegex(word)}\\b`, 'i').test(fullText)) fail(`forbidden word: "${word}"`);
  }
  for (const match of fullText.matchAll(/["“]([^"”]{1,400})["”]/g)) {
    if (words(match[1]).length > 5) fail(`quotation longer than a few words: “${match[1].slice(0, 60)}…”`);
  }

  // Sources: allowed domain, reachable, and the text must not copy them.
  const storyWords = words(plainText(paragraphs.join(' ')));
  const sourceTexts: string[] = [];
  await Promise.all(
    story.sources.map(async (source) => {
      let host = '';
      try {
        host = new URL(source.url).hostname.toLowerCase();
      } catch {
        fail(`bad source URL: ${source.url}`);
        return;
      }
      if (config.sources.blockedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
        fail(`blocked source: ${host}`);
        return;
      }
      const { status, text } = await fetchText(source.url);
      if (!config.sources.okStatuses.includes(status)) {
        fail(`source did not open (${status || 'no response'}): ${source.url}`);
        return;
      }
      if (text) sourceTexts.push(plainText(text));
    }),
  );
  for (const text of sourceTexts) {
    const copied = longestSharedRun(storyWords, words(text));
    if (copied) fail(`copies a source word for word: "${copied}…"`);
  }
  if (sourceTexts.length > 0) {
    const haystack = sourceTexts.join(' ');
    const missing = [...new Set(paragraphs.join(' ').match(/\b\d[\d,.]*\d\b|\b\d\b/g) ?? [])]
      .filter((token) => !haystack.includes(token.toLowerCase()) && !haystack.includes(token.replace(/,/g, '')))
      .slice(0, 8);
    if (missing.length > 0) warn(`numbers not found in the readable sources: ${missing.join(', ')}`);
  } else {
    warn('no source text could be read, so numbers were not cross-checked');
  }

  // Images: one at least, on our CDN, 200 KB or less, with a credit.
  const images = story.media.filter((item) => item.type === 'image');
  if (images.length === 0) fail('no image');
  const cdn = process.env.CLOUDFRONT_URL?.trim().replace(/\/+$/, '');
  for (const image of images) {
    if (!image.url || !cdn || !image.url.startsWith(`${cdn}/`)) {
      fail(`image ${image.key} is not on the CloudFront host`);
      continue;
    }
    if (!image.altText) fail(`image ${image.key} has no alt text`);
    if (!image.credit) fail(`image ${image.key} has no credit`);
    const { status, bytes } = await imageBytes(image.url);
    if (status !== 200) fail(`image ${image.key} does not open (${status || 'no response'})`);
    else if (bytes > config.images.maxBytes) fail(`image ${image.key} is ${Math.round(bytes / 1024)} KB`);
  }
  return report;
}

async function main() {
  const [path, day] = process.argv.slice(2);
  if (!path || !day || !/^\d\d-\d\d$/.test(day)) throw new Error('Usage: check-batch.ts <batch.json> <MM-DD>');

  const items = JSON.parse(readFileSync(path, 'utf8')) as Item[];
  if (!Array.isArray(items)) throw new Error('The batch must be a JSON array');

  const rows = await prisma.story.findMany({ select: { slug: true, title: true, eventDate: true } });
  const existing: Existing = { slugs: new Set(rows.map((row) => row.slug)), byDate: new Map() };
  for (const row of rows) {
    const key = row.eventDate.toISOString().slice(0, 10);
    existing.byDate.set(key, [...(existing.byDate.get(key) ?? []), { slug: row.slug, title: row.title }]);
  }
  const seen = new Set<string>();

  let errors = 0;
  let warnings = 0;
  const tiers = { long: 0, short: 0 };
  for (const item of items) {
    if (item.tier === 'long' || item.tier === 'short') tiers[item.tier]++;
    const report = await checkStory(item, day, existing, seen);
    errors += report.errors.length;
    warnings += report.warnings.length;
    const mark = report.errors.length ? 'FAIL' : report.warnings.length ? 'WARN' : 'OK  ';
    console.log(`${mark}  [${item.tier ?? '?'}] ${String(item.type)}  ${String(item.slug)}`);
    for (const message of report.errors) console.log(`        error: ${message}`);
    for (const message of report.warnings) console.log(`        warning: ${message}`);
  }

  console.log(`\n${items.length} stories (${tiers.long} long, ${tiers.short} short); ${errors} errors, ${warnings} warnings`);
  if (items.length !== config.perDay.long + config.perDay.short) {
    console.log(`note: the config asks for ${config.perDay.long + config.perDay.short} a day`);
  }
  if (tiers.long !== config.perDay.long || tiers.short !== config.perDay.short) {
    console.log(`note: the config asks for ${config.perDay.long} long and ${config.perDay.short} short`);
  }
  await prisma.$disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await prisma.$disconnect();
  process.exit(1);
});
