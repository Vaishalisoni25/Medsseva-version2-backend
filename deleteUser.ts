import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.deleteMany({
    where: { mobile: '9131484529' },
  });
  console.log('Deleted', result.count, 'users');
}

main().catch(console.error).finally(() => prisma.$disconnect());
