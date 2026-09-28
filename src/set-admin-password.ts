import { errorMessage } from './lib/env';
import { hashPassword } from './lib/password';
import { prisma } from './lib/prisma';

/**
 * Sets the single admin password. Run as:
 *   ADMIN_PASSWORD='…' npm run admin:password
 * Only the hash is stored, and existing sessions are dropped.
 */
async function main() {
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (password.length < 12) {
    throw new Error("Set ADMIN_PASSWORD to at least 12 characters, and don't commit it.");
  }

  const passwordHash = await hashPassword(password);
  await prisma.adminCredential.upsert({
    where: { id: 1 },
    create: { id: 1, passwordHash },
    update: { passwordHash },
  });
  await prisma.adminSession.deleteMany({});

  console.log('Admin password updated. All existing sessions were signed out.');
}

main()
  .catch((error: unknown) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
