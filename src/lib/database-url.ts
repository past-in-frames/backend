import fs from 'node:fs';
import path from 'node:path';

const SSL_ACCEPT = 'strict';

export function applyDatabaseUrl(): void {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) {
    process.env.DATABASE_URL = withTls(configured);
    return;
  }

  const host = required('MYSQL_HOST');
  const port = required('MYSQL_PORT');
  const user = required('MYSQL_USER');
  const database = required('MYSQL_DATABASE');
  const password = process.env.MYSQL_PASSWORD ?? '';

  if (!/^\d+$/.test(port)) {
    throw new Error('MYSQL_PORT must be a number');
  }

  if (password.length === 0) {
    throw new Error('MYSQL_PASSWORD is empty. Set it in backend/.env');
  }

  const url =
    `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
    `@${host}:${port}/${encodeURIComponent(database)}`;

  process.env.DATABASE_URL = withTls(url);
}

function withTls(url: string): string {
  if (urlUsesTls(url)) return url;

  const caPath = tlsCaPath();
  if (!caPath) {
    console.warn(
      'MySQL TLS is off because the Coolify CA file is missing. The API is starting without encryption.',
    );
    return url;
  }

  const joiner = url.includes('?') ? (url.endsWith('?') || url.endsWith('&') ? '' : '&') : '?';
  return `${url}${joiner}sslcert=${caPath}&sslaccept=${SSL_ACCEPT}`;
}

function tlsCaPath(): string | null {
  const sslCa = process.env.MYSQL_SSL_CA?.trim();
  if (!sslCa) return null;
  const caPath = path.resolve(sslCa);
  return fs.existsSync(caPath) ? caPath : null;
}

function urlUsesTls(url: string): boolean {
  return /[?&](?:sslaccept|sslcert|sslidentity)=/i.test(url);
}

export function redactSecrets(value: string): string {
  return value.replace(/mysql:\/\/[^@\s]+@/gi, 'mysql://***@');
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} in the backend environment`);
  }
  return value;
}
