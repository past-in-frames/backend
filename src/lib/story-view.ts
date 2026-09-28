import type { StoryBodyBlock } from './story-input';

/** Event dates are calendar days, so they must not shift with the server timezone. */
export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Story bodies are stored as JSON text. Anything that no longer matches a known
 * block shape is dropped so one bad row cannot break a page.
 */
export function parseStoredBody(value: string): StoryBodyBlock[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const blocks: StoryBodyBlock[] = [];
  for (const block of parsed) {
    if (!block || typeof block !== 'object') continue;
    const record = block as Record<string, unknown>;

    if ((record.type === 'paragraph' || record.type === 'heading') && typeof record.text === 'string') {
      blocks.push({ type: record.type, text: record.text });
    } else if (record.type === 'image' && typeof record.mediaKey === 'string') {
      blocks.push({ type: 'image', mediaKey: record.mediaKey });
    }
  }
  return blocks;
}
