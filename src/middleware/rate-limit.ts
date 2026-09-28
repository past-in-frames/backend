import type { RequestHandler } from 'express';
import { HttpError } from '../lib/http-error';

type Bucket = { count: number; resetAt: number };

/**
 * Small in-memory limiter for the admin login. The API runs as a single
 * instance, so a shared store would add a dependency without adding protection.
 */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req, _res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';

    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      next(new HttpError(429, 'Too many attempts. Try again later.'));
      return;
    }

    next();
  };
}
