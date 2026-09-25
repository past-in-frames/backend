import fs from 'node:fs';
import path from 'node:path';

const SSL_ACCEPT = 'strict';

export function applyDatabaseUrl(): void {
  const host = required('MYSQL_HOST');
  const port = required('MYSQL_PORT');
  const user = required('MYSQL_USER');
  const database = required('MYSQL_DATABASE');
  const password = process.env.MYSQL_PASSWORD ?? '';
  const sslCa = process.env.MYSQL_SSL_CA?.trim();

  if (!/^\d+$/.test(port)) {
    throw new Error('MYSQL_PORT must be a number');
  }

  if (password.length === 0) {
    throw new Error('MYSQL_PASSWORD is empty. Set it in backend/.env');
  }

  const caPath = sslCa ? path.resolve(sslCa) : '';
  const tls = caPath !== '' && fs.existsSync(caPath);
  if (!tls) {
    console.warn(
      'MySQL TLS is off because the Coolify CA file is missing. The API is starting without encryption.',
    );
  }

  const url =
    `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}` +
    `@${host}:${port}/${encodeURIComponent(database)}` +
    (tls ? `?sslcert=${caPath}&sslaccept=${SSL_ACCEPT}` : '');

  process.env.DATABASE_URL = url;
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
