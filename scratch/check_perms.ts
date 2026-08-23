import { prisma } from '../src/lib/prisma';

async function main() {
  const role = await prisma.adminRole.findUnique({
    where: { slug: 'vijaynagar_branch' },
    include: {
      permissions: {
        include: { permission: true }
      }
    }
  });
  if (!role) return console.log('Role not found');
  const perms = role.permissions.map(p => `${p.permission.module}.${p.permission.action}`);
  console.log('ALL PERMISSIONS for vijaynagar_branch:');
  console.log(JSON.stringify(perms.sort(), null, 2));

  // Check specific permissions
  const check = ['staff.view', 'staff.create', 'staff.edit', 'roles_permissions.view', 'roles_permissions.assign', 'doctors.view', 'doctors.create'];
  console.log('--- CHECK RESULTS ---');
  for (const c of check) {
    console.log(`${c}: ${perms.includes(c)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
