import { redactSecrets } from './lib/database-url';
import { prisma } from './lib/prisma';

async function main() {
  const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
  const status = await prisma.$queryRawUnsafe<Array<{ Variable_name: string; Value: string }>>(
    "SHOW SESSION STATUS LIKE 'Ssl_cipher'",
  );
  const cipher = status[0]?.Value ?? '';

  console.log(`select1=${rows[0]?.ok === 1 ? 'ok' : 'unexpected'}`);
  console.log(`ssl_cipher=${cipher || '(empty)'}`);
  console.log(`encrypted=${cipher.length > 0 ? 'yes' : 'no'}`);

  if (rows[0]?.ok !== 1 || cipher.length === 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redactSecrets(message));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
