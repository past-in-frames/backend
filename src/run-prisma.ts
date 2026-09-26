import { spawn } from 'node:child_process';
import path from 'node:path';
import dotenv from 'dotenv';
import { applyDatabaseUrl, redactSecrets } from './lib/database-url';

dotenv.config({ override: true });

const args = process.argv.slice(2);
const command = args.join(' ');

if (command !== 'migrate deploy') {
  console.error('This runner only executes: prisma migrate deploy');
  process.exit(1);
}

try {
  applyDatabaseUrl();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redactSecrets(message));
  process.exit(1);
}

const prismaBin = path.resolve(process.cwd(), 'node_modules', '.bin', 'prisma');
const child = spawn(prismaBin, args, {
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (error) => {
  console.error(redactSecrets(error.message));
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
