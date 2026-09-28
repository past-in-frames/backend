import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { badRequest, serviceUnavailable } from './http-error';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_PREFIX = 'mi-images';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

export type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

let client: S3Client | null = null;

export async function uploadStoryImage(file: UploadedImage) {
  const { bucket, region, publicBase } = s3Config();

  if (!file.buffer?.length) {
    throw badRequest('Image file is required');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw badRequest('Image file is too large');
  }

  const ext = MIME_TO_EXT[file.mimetype];
  if (!ext) {
    throw badRequest('Unsupported image type');
  }

  const objectKey = `${IMAGE_PREFIX}/${randomUUID()}${ext}`;
  const mediaKey = `image-${randomUUID().replace(/-/g, '').slice(0, 12)}`;

  try {
    await getClient(region).send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Keys are random, so an object never changes once written.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  } catch {
    throw serviceUnavailable("Couldn't upload the image");
  }

  return { url: `${publicBase}/${objectKey}`, mediaKey };
}

function s3Config() {
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim();
  const publicBase = process.env.CLOUDFRONT_URL?.trim().replace(/\/+$/, '');

  if (!bucket || !region || !publicBase) {
    throw serviceUnavailable('Image uploads are not configured');
  }

  return { bucket, region, publicBase };
}

function getClient(region: string) {
  if (client) return client;

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  client = new S3Client({
    region,
    // Falls back to the instance role when explicit keys are not provided.
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
  });
  return client;
}
