/**
 * Every value a story's `type` can have. Each one is a public section on the site, at
 * `/<type>`. Keep this list in step with `frontend/src/lib/story-path.ts`.
 */
export const STORY_TYPES = [
  'history',
  'politics',
  'war',
  'crime',
  'science',
  'space',
  'technology',
  'medicine',
  'nature',
  'exploration',
  'sport',
  'art',
  'music',
  'film',
] as const;

export type StoryType = (typeof STORY_TYPES)[number];

export function isStoryType(value: string): value is StoryType {
  return (STORY_TYPES as readonly string[]).includes(value);
}
