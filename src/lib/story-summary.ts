import { formatDateOnly } from './story-view';

/** Fields every story card needs: title, date and the first image and video. */
export const summarySelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  eventDate: true,
  updatedAt: true,
  type: true,
  media: {
    where: { url: { not: null } },
    orderBy: { sortOrder: 'asc' as const },
    select: { type: true, url: true, altText: true, isAiGenerated: true },
  },
};

type SummaryRow = {
  slug: string;
  title: string;
  summary: string;
  eventDate: Date;
  updatedAt: Date;
  type: string | null;
  media: {
    type: 'image' | 'video';
    url: string | null;
    altText: string | null;
    isAiGenerated: boolean;
  }[];
};

export function toSummary(story: SummaryRow) {
  const cover = story.media.find((item) => item.type === 'image');
  const video = story.media.find((item) => item.type === 'video');
  return {
    slug: story.slug,
    title: story.title,
    summary: story.summary,
    eventDate: formatDateOnly(story.eventDate),
    updatedAt: story.updatedAt.toISOString(),
    type: story.type,
    coverUrl: cover?.url ?? null,
    coverAlt: cover?.altText ?? null,
    /** AI illustrations get an "Illustration" label on the home page. */
    coverIsAi: cover?.isAiGenerated ?? false,
    videoUrl: video?.url ?? null,
  };
}
