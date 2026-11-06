import { prisma } from './prisma';
import { errorMessage } from './env';

/**
 * Videos on the channel become videos on the stories they were made from.
 *
 * YouTube publishes the latest 15 videos of every channel as an open RSS feed,
 * so this needs no API key. A video is matched to the published story that has
 * the same title, ignoring case and punctuation, and added to that story as a
 * video. Videos with no matching story are only reported. Running it twice
 * changes nothing the second time.
 */
const FEED_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
const SYNC_EVERY_MS = 30 * 60 * 1000;

export type YoutubeSyncResult = {
  fetched: number;
  attached: { videoId: string; slug: string }[];
  alreadyLinked: number;
  /** Videos whose link was rewritten because YouTube lists them as Shorts. */
  markedAsShort: number;
  unmatched: { videoId: string; title: string }[];
};

type FeedVideo = { id: string; title: string; short: boolean };

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" };

function decode(text: string) {
  return text.replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (match) => ENTITIES[match] ?? match);
}

/** "Chang’e 1 Enters Lunar Orbit" and "Chang'e 1 enters lunar orbit" are the same title. */
export function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[‘’ʼ']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function parseFeed(xml: string): FeedVideo[] {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap((entry) => {
    const id = /<yt:videoId>([\w-]{11})<\/yt:videoId>/.exec(entry[1])?.[1];
    const title = /<title>([\s\S]*?)<\/title>/.exec(entry[1])?.[1];
    // The feed links a Short to /shorts/<id> and any other video to /watch?v=<id>.
    const short = /<link rel="alternate" href="[^"]*\/shorts\/[\w-]{11}"/.test(entry[1]);
    return id && title ? [{ id, title: decode(title).trim(), short }] : [];
  });
}

export async function syncYoutubeVideos(channelId: string): Promise<YoutubeSyncResult> {
  const response = await fetch(`${FEED_URL}${encodeURIComponent(channelId)}`, {
    headers: { 'User-Agent': 'pastinframes-youtube-sync/1.0' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`YouTube feed responded with ${response.status}`);
  }
  const videos = parseFeed(await response.text());

  const stories = await prisma.story.findMany({
    where: { status: 'published' },
    select: { id: true, slug: true, title: true, media: { where: { type: 'video' }, select: { url: true, sortOrder: true } }, _count: { select: { media: true } } },
  });
  const byTitle = new Map<string, (typeof stories)[number][]>();
  for (const story of stories) {
    const key = normalizeTitle(story.title);
    byTitle.set(key, [...(byTitle.get(key) ?? []), story]);
  }

  const result: YoutubeSyncResult = { fetched: videos.length, attached: [], alreadyLinked: 0, markedAsShort: 0, unmatched: [] };

  for (const video of videos) {
    const matches = byTitle.get(normalizeTitle(video.title)) ?? [];
    // Two stories with one title would be a guess, so those are left for an editor.
    if (matches.length !== 1) {
      result.unmatched.push({ videoId: video.id, title: video.title });
      continue;
    }

    const story = matches[0];
    // Shorts are stored with a /shorts/ link, which is how the site knows to show them upright.
    const url = video.short ? `https://www.youtube.com/shorts/${video.id}` : `https://www.youtube.com/watch?v=${video.id}`;

    const linked = story.media.find((item) => item.url?.includes(video.id));
    if (linked) {
      result.alreadyLinked += 1;
      if (video.short && linked.url !== url) {
        await prisma.storyMedia.updateMany({ where: { storyId: story.id, url: linked.url }, data: { url } });
        result.markedAsShort += 1;
      }
      continue;
    }

    const last = await prisma.storyMedia.findFirst({ where: { storyId: story.id }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    await prisma.storyMedia.create({
      data: {
        storyId: story.id,
        key: `youtube-${video.id}`,
        type: 'video',
        url,
        caption: `${video.title}, a short video from Past in Frames.`,
        credit: 'Past in Frames',
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    result.attached.push({ videoId: video.id, slug: story.slug });
  }

  return result;
}

/** Checks the channel shortly after start and then every half hour. */
export function startYoutubeSync(channelId: string) {
  const run = async () => {
    try {
      const result = await syncYoutubeVideos(channelId);
      if (result.attached.length || result.unmatched.length) {
        console.log(
          `YouTube sync: ${result.attached.length} attached, ${result.unmatched.length} without a matching story`,
          result.unmatched.map((video) => `"${video.title}"`).join(', '),
        );
      }
    } catch (error) {
      console.error(`YouTube sync failed: ${errorMessage(error)}`);
    }
  };
  setTimeout(run, 20_000).unref();
  setInterval(run, SYNC_EVERY_MS).unref();
}
