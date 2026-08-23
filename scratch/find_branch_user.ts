import { prisma } from '../src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'branch', mode: 'insensitive' } },
        { email: { contains: 'admin', mode: 'insensitive' } },
        { email: { contains: 'vijay', mode: 'insensitive' } }
      ]
    },
    include: {
      adminUser: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } }
            }
          }
        }
      }
    }
  });

  console.log('=== MATCHING USERS ===');
  for (const u of users) {
    console.log({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      hasAdminUser: !!u.adminUser,
      adminRoleName: u.adminUser?.role?.name,
      adminRoleSlug: u.adminUser?.role?.slug,
      permissionsCount: u.adminUser?.role?.permissions?.length || 0,
      isActive: u.adminUser?.isActive
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
