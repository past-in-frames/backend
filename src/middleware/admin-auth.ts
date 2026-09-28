import type { RequestHandler } from 'express';
import { unauthorized } from '../lib/http-error';
import { hashSessionToken } from '../lib/password';
import { prisma } from '../lib/prisma';

function bearerToken(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

/** Rejects the request unless it carries a session token that is still valid. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  void (async () => {
    const token = bearerToken(req.header('authorization'));
    if (!token) {
      throw unauthorized('Not signed in');
    }

    const session = await prisma.adminSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
    });

    if (!session) {
      throw unauthorized('Not signed in');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await prisma.adminSession.delete({ where: { tokenHash: session.tokenHash } });
      throw unauthorized('Not signed in');
    }
  })().then(() => next(), next);
};
