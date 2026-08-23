import { prisma } from '../src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, mobile: true, role: true }
  });
  console.log('=== USERS ===');
  console.log(users);

  const adminUsers = await prisma.adminUser.findMany({
    include: {
      user: { select: { name: true, email: true, role: true } },
      role: {
        include: {
          permissions: { include: { permission: true } }
        }
      }
    }
  });
  console.log('=== ADMIN USERS & PERMISSIONS ===');
  console.log(adminUsers.map(a => ({
    name: a.user.name,
    email: a.user.email,
    userRole: a.user.role,
    adminRole: a.role.name,
    slug: a.role.slug,
    permissionsCount: a.role.permissions.length,
    permissionsSample: a.role.permissions.slice(0, 5).map(p => `${p.permission.module}.${p.permission.action}`)
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
