import { prisma } from '../src/lib/prisma';

async function main() {
  const adminUsers = await prisma.adminUser.findMany({
    include: {
      user: true,
      role: {
        include: {
          permissions: { include: { permission: true } }
        }
      }
    }
  });
  console.log('=== ADMIN USERS FULL DETAILS ===');
  for (const a of adminUsers) {
    console.log({
      adminUserId: a.id,
      userId: a.userId,
      email: a.user.email,
      userRoleInUserTable: a.user.role,
      adminRoleName: a.role.name,
      adminRoleSlug: a.role.slug,
      isActive: a.isActive,
      permissionsCount: a.role.permissions.length,
      branchId: a.branchId
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
