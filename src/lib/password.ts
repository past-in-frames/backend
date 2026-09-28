import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const KEY_BYTES = 32;
const SALT_BYTES = 16;

/** Stored as `scrypt$<salt>$<hash>`, both parts base64url encoded. */
export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_BYTES);
  const hash = (await scryptAsync(password, salt, KEY_BYTES)) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, 'base64url');
  const saltBytes = Buffer.from(salt, 'base64url');
  if (expected.length === 0 || saltBytes.length === 0) {
    return false;
  }

  const actual = (await scryptAsync(password, saltBytes, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
