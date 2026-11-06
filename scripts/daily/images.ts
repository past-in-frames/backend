/**
 * Image tools for the daily story batch. Every command prints JSON.
 *
 *   npx tsx scripts/daily/images.ts search "Apollo 11 launch"       Find free images on Wikimedia Commons
 *   npx tsx scripts/daily/images.ts fetch "File:Apollo_11.jpg" out/a.jpg   Download one and print its credit
 *   npx tsx scripts/daily/images.ts generate "prompt text" out/a.png       Make an illustration with OpenAI
 *   npx tsx scripts/daily/images.ts upload out/a.jpg                       Compress to WebP (200 KB or less), put it on S3
 *
 * `upload` is the only command that writes anywhere outside the local disk (the
 * S3 bucket the site already uses). It never touches the database.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { uploadStoryImage } from '../../src/lib/s3';

dotenv.config({ override: true, quiet: true });

const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'PastInFramesStoryTool/1.0 (editorial image lookup)';
const ALLOWED = /^(public domain|cc0|cc by(?:-sa)?\b|pd\b|no restrictions)/i;
const THUMB_WIDTH = 1600;

type CommonsPage = {
  title: string;
  imageinfo?: {
    url: string;
    thumburl?: string;
    descriptionurl: string;
    width: number;
    height: number;
    mime: string;
    extmetadata?: Record<string, { value: string }>;
  }[];
};

function plain(html: string | undefined) {
  return (html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function commons(params: Record<string, string>) {
  const url = `${COMMONS}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  // Commons answers 429 when it is asked too fast; wait and ask again.
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (response.ok) return (await response.json()) as { query?: { pages?: Record<string, CommonsPage> } };
    if (response.status !== 429 && response.status < 500) throw new Error(`Commons responded with ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 4000 * (attempt + 1)));
  }
  throw new Error('Commons is busy, try again in a minute');
}

function describe(page: CommonsPage) {
  const info = page.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const license = plain(meta.LicenseShortName?.value) || plain(meta.UsageTerms?.value);
  const author = plain(meta.Artist?.value) || plain(meta.Credit?.value) || 'Unknown author';
  return {
    title: page.title,
    license,
    allowed: ALLOWED.test(license),
    author,
    width: info?.width,
    height: info?.height,
    mime: info?.mime,
    description: plain(meta.ImageDescription?.value).slice(0, 200),
    date: plain(meta.DateTimeOriginal?.value),
    page: info?.descriptionurl,
    imageUrl: info?.thumburl ?? info?.url,
  };
}

async function search(query: string) {
  const data = await commons({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(THUMB_WIDTH),
  });
  const pages = Object.values(data.query?.pages ?? {});
  const found = pages.map(describe).filter((item) => item.allowed && (item.width ?? 0) >= 600);
  console.log(JSON.stringify(found, null, 2));
}

async function fetchImage(title: string, out: string) {
  const data = await commons({
    action: 'query',
    titles: title.startsWith('File:') ? title : `File:${title}`,
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(THUMB_WIDTH),
  });
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page?.imageinfo) throw new Error(`Not found on Commons: ${title}`);
  const item = describe(page);
  if (!item.allowed) throw new Error(`License not allowed (${item.license || 'unknown'}) for ${title}`);
  if (!item.imageUrl) throw new Error('No image URL');

  const response = await fetch(item.imageUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Download failed with ${response.status}`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(await response.arrayBuffer()));

  console.log(
    JSON.stringify({
      file: out,
      credit: `${item.author} · Wikimedia Commons · ${item.license}`,
      license: item.license,
      sourcePage: item.page,
      description: item.description,
    }),
  );
}

async function generate(prompt: string, out: string) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY is not set in backend/.env');
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2';

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, size: '1536x1024', quality: 'medium', n: 1 }),
  });
  if (!response.ok) {
    const detail = ((await response.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(`OpenAI responded with ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  const body = (await response.json()) as { data?: { b64_json?: string; url?: string }[] };
  const image = body.data?.[0];
  let buffer: Buffer;
  if (image?.b64_json) buffer = Buffer.from(image.b64_json, 'base64');
  else if (image?.url) buffer = Buffer.from(await (await fetch(image.url)).arrayBuffer());
  else throw new Error('OpenAI returned no image');

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, buffer);
  console.log(JSON.stringify({ file: out, model, isAiGenerated: true }));
}

async function upload(file: string) {
  const buffer = await readFile(file);
  const meta = await sharp(buffer).metadata();
  const mimetype = `image/${meta.format === 'jpg' ? 'jpeg' : meta.format}`;
  const uploaded = await uploadStoryImage({ buffer, mimetype, size: buffer.length });
  console.log(JSON.stringify({ url: uploaded.url, mediaKey: uploaded.mediaKey }));
}

async function main() {
  const [command, first, second] = process.argv.slice(2);
  if (command === 'search' && first) return search(first);
  if (command === 'fetch' && first && second) return fetchImage(first, second);
  if (command === 'generate' && first && second) return generate(first, second);
  if (command === 'upload' && first) return upload(first);
  throw new Error('Usage: images.ts search <query> | fetch <File:Title> <out> | generate <prompt> <out> | upload <file>');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
