import { prisma } from '../src/lib/prisma';

async function main() {
  const logs = await prisma.apiRequestLog.findMany({
    take: 15,
    orderBy: { createdAt: 'desc' }
  });
  console.log('=== LATEST 15 API REQUEST LOGS ===');
  console.log(logs.map(l => ({
    method: l.method,
    path: l.path,
    statusCode: l.statusCode,
    userRole: l.userRole,
    time: l.createdAt
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
