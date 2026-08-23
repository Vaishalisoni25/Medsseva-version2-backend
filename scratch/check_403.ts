import { prisma } from '../src/lib/prisma';

async function main() {
  const logs = await prisma.apiRequestLog.findMany({
    take: 10,
    where: { statusCode: 403 },
    orderBy: { createdAt: 'desc' }
  });
  console.log('=== 403 LOGS DETAILS ===');
  console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
