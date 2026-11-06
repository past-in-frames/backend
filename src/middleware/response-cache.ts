import type { RequestHandler } from 'express';

type Entry = { expires: number; headers: Record<string, string>; body: string };

const KEPT_HEADERS = ['Cache-Control', 'X-Total-Count'];

/**
 * Keeps successful JSON responses in memory for a short time, so a burst of
 * identical public requests costs the database one query, not one each.
 *
 * Only GETs that answered 200 and are not marked `no-store` are kept, and the
 * oldest entries go first once there are too many. A story edited in the admin
 * shows up here within `ttlMs`; the site's own cache is longer than that anyway.
 */
export function cacheResponses(ttlMs = 60_000, maxEntries = 500): RequestHandler {
  const store = new Map<string, Entry>();

  return (req, res, next) => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    const key = req.originalUrl;
    const hit = store.get(key);
    if (hit && hit.expires > Date.now()) {
      for (const [name, value] of Object.entries(hit.headers)) res.set(name, value);
      res.set('X-Api-Cache', 'HIT').type('json').send(hit.body);
      return;
    }

    const send = res.json.bind(res);
    res.json = (body: unknown) => {
      const noStore = String(res.get('Cache-Control') ?? '').includes('no-store');
      if (res.statusCode === 200 && !noStore) {
        const headers: Record<string, string> = {};
        for (const name of KEPT_HEADERS) {
          const value = res.get(name);
          if (value) headers[name] = String(value);
        }
        store.delete(key);
        store.set(key, { expires: Date.now() + ttlMs, headers, body: JSON.stringify(body) });
        while (store.size > maxEntries) {
          const oldest = store.keys().next().value;
          if (oldest === undefined) break;
          store.delete(oldest);
        }
      }
      return send(body);
    };
    next();
  };
}
