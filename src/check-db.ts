import { errorMessage } from './lib/env';
import { prisma } from './lib/prisma';

/** Confirms the API can reach the production database and that the schema is present. */
async function main() {
  const rows = await prisma.$queryRaw<Array<{ ok: unknown }>>`SELECT 1 AS ok`;
  const stories = await prisma.story.count();
  const published = await prisma.story.count({ where: { status: 'published' } });

  console.log(`connection=${Number(rows[0]?.ok) === 1 ? 'ok' : 'unexpected'}`);
  console.log(`stories=${stories} published=${published}`);
}

main()
  .catch((error: unknown) => {
    console.error(errorMessage(error));
    console.error('\nIs the SSH tunnel running? Start it with: npm run db:tunnel');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
