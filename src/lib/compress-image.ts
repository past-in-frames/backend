import sharp, { type Metadata } from 'sharp';
import { badRequest } from './http-error';

/** Every uploaded image is re-encoded to fit in this many bytes. */
export const TARGET_IMAGE_BYTES = 200 * 1024;

const START_MAX_SIDE = 2400;
const MIN_SIDE = 160;
const QUALITY_STEPS = [82, 70, 58, 46, 34];
const SHRINK_FACTOR = 0.8;

export type CompressedImage = {
  buffer: Buffer;
  mimetype: 'image/webp';
  ext: '.webp';
};

/**
 * Re-encodes any supported image to WebP no larger than TARGET_IMAGE_BYTES.
 * Quality is lowered first; if that is not enough the image is scaled down.
 * Animated GIF/WebP keep their frames.
 */
export async function compressImage(input: Buffer): Promise<CompressedImage> {
  let meta: Metadata;
  try {
    meta = await sharp(input, { animated: true }).metadata();
  } catch {
    throw badRequest('Unsupported image type');
  }

  const animated = (meta.pages ?? 1) > 1;
  const width = meta.width ?? START_MAX_SIDE;
  const height = meta.pageHeight ?? meta.height ?? START_MAX_SIDE;
  let maxSide = Math.min(START_MAX_SIDE, Math.max(width, height));

  while (maxSide >= MIN_SIDE) {
    for (const quality of QUALITY_STEPS) {
      const buffer = await encode(input, { animated, width, height, maxSide, quality });
      if (buffer.length <= TARGET_IMAGE_BYTES) {
        return { buffer, mimetype: 'image/webp', ext: '.webp' };
      }
    }
    maxSide = Math.floor(maxSide * SHRINK_FACTOR);
  }

  throw badRequest('Image cannot be compressed to 200 KB');
}

function encode(
  input: Buffer,
  o: { animated: boolean; width: number; height: number; maxSide: number; quality: number },
) {
  const scale = Math.min(1, o.maxSide / Math.max(o.width, o.height));
  const image = sharp(input, { animated: o.animated }).rotate(); // apply EXIF orientation
  // Animated images are stacked vertically by sharp, so only the width may be set.
  const resized =
    scale < 1
      ? image.resize(
          o.animated
            ? { width: Math.max(1, Math.round(o.width * scale)) }
            : { width: o.maxSide, height: o.maxSide, fit: 'inside', withoutEnlargement: true },
        )
      : image;
  return resized.webp({ quality: o.quality, effort: 5 }).toBuffer();
}
