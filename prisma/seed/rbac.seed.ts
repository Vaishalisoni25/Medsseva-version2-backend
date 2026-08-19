import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function seedRbac(prisma: PrismaClient) {
  console.log('Seeding RBAC (roles, permissions, super admin)...');

  // 1. Modules used across the admin panel
  const modules = [
    'users',
    'bookings',
    'reports',
    'tests',
    'packages',
    'coupons',
    'pricing',
    'franchise',
    'inventory',
    'finance',
    'cms',
    'support',
    'notifications',
    'settings',
    'logs',
  ];

  const actions = ['view', 'create', 'update', 'delete', 'approve'];

  // 2. Create Permissions (module x action)
  const permissionRecords = [];
  for (const module of modules) {
    for (const action of actions) {
      const perm = await prisma.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: { module, action },
      });
      permissionRecords.push(perm);
    }
  }
  console.log(`${permissionRecords.length} permissions created`);

  // 3. Create Admin Roles
  const roleDefs = [
    { name: 'Super Admin', slug: 'super-admin', description: 'Full system access', isSystem: true },
    { name: 'Admin', slug: 'admin', description: 'General admin access', isSystem: true },
    { name: 'Pathologist', slug: 'pathologist', description: 'Report verification access', isSystem: true },
    { name: 'Executive', slug: 'executive', description: 'Sample collection executive', isSystem: true },
    { name: 'Franchise', slug: 'franchise', description: 'Franchise partner access', isSystem: true },
    { name: 'Lab Department', slug: 'lab-department', description: 'Lab processing access', isSystem: true },
  ];

  const roles: Record<string, any> = {};
  for (const def of roleDefs) {
    const role = await prisma.adminRole.upsert({
      where: { slug: def.slug },
      update: {},
      create: def,
    });
    roles[def.slug] = role;
  }
  console.log('Admin roles created');

  // 4. Map permissions to roles
  // Super Admin -> everything
  for (const perm of permissionRecords) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roles['super-admin'].id, permissionId: perm.id } },
      update: {},
      create: { roleId: roles['super-admin'].id, permissionId: perm.id },
    });
  }

  // Admin -> everything except settings/logs delete
  const adminPerms = permissionRecords.filter(
    (p) => !(['settings', 'logs'].includes(p.module) && p.action === 'delete'),
  );
  for (const perm of adminPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roles['admin'].id, permissionId: perm.id } },
      update: {},
      create: { roleId: roles['admin'].id, permissionId: perm.id },
    });
  }

  // Pathologist -> reports only
  const pathologistPerms = permissionRecords.filter((p) => p.module === 'reports');
  for (const perm of pathologistPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roles['pathologist'].id, permissionId: perm.id } },
      update: {},
      create: { roleId: roles['pathologist'].id, permissionId: perm.id },
    });
  }

  // Executive -> bookings view/update only
  const executivePerms = permissionRecords.filter(
    (p) => p.module === 'bookings' && ['view', 'update'].includes(p.action),
  );
  for (const perm of executivePerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roles['executive'].id, permissionId: perm.id } },
      update: {},
      create: { roleId: roles['executive'].id, permissionId: perm.id },
    });
  }

  // Franchise -> franchise + bookings view
  const franchisePerms = permissionRecords.filter(
    (p) => p.module === 'franchise' || (p.module === 'bookings' && p.action === 'view'),
  );
  for (const perm of franchisePerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roles['franchise'].id, permissionId: perm.id } },
      update: {},
      create: { roleId: roles['franchise'].id, permissionId: perm.id },
    });
  }

  // Lab Department -> inventory + tests
  const labPerms = permissionRecords.filter((p) => ['inventory', 'tests'].includes(p.module));
  for (const perm of labPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roles['lab-department'].id, permissionId: perm.id } },
      update: {},
      create: { roleId: roles['lab-department'].id, permissionId: perm.id },
    });
  }
  console.log('Role-permission mapping done');

  // 5. Create Super Admin User + AdminUser
  const hashedPassword = await bcrypt.hash('SuperAdmin@123', 10);

  const superAdminUser = await prisma.user.upsert({
    where: { mobile: '9999999999' },
    update: {},
    create: {
      name: 'MedsSeva Super Admin',
      email: 'superadmin@medseva.in',
      mobile: '9999999999',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  });

  await prisma.adminUser.upsert({
    where: { userId: superAdminUser.id },
    update: {},
    create: {
      userId: superAdminUser.id,
      roleId: roles['super-admin'].id,
      department: 'Management',
      isActive: true,
    },
  });

  console.log('Super admin user created (mobile: 9999999999 / password: SuperAdmin@123)');
}