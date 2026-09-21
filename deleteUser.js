const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.user.deleteMany({
    where: { mobile: '9131484529' }
  });
  console.log('User deleted successfully.');
}

main().finally(() => prisma.$disconnect());
