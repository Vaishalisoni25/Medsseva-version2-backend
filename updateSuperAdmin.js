const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Medsseva@2026', 10);
  
  // Find any existing user with this mobile number
  let existingUser = await prisma.user.findUnique({
    where: { mobile: '8448030936' }
  });

  if (existingUser) {
    console.log('User with this mobile already exists. Updating to SUPER_ADMIN...');
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        email: 'medssevalab2026@gmail.com',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
      }
    });
  } else {
    // If no user exists with this mobile, find the existing SUPER_ADMIN and update them
    let superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });

    if (superAdmin) {
      await prisma.user.update({
        where: { id: superAdmin.id },
        data: {
          mobile: '8448030936',
          email: 'medssevalab2026@gmail.com',
          password: hashedPassword,
        }
      });
    } else {
      // Create new Super Admin
      existingUser = await prisma.user.create({
        data: {
          name: 'MedsSeva Super Admin',
          email: 'medssevalab2026@gmail.com',
          mobile: '8448030936',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
        },
      });
    }
  }

  // Ensure AdminUser record exists for this user
  const finalUser = await prisma.user.findUnique({ where: { mobile: '8448030936' } });
  if (finalUser) {
    const saRole = await prisma.adminRole.findFirst({
      where: { slug: 'super-admin' }
    });

    if (saRole) {
      await prisma.adminUser.upsert({
        where: { userId: finalUser.id },
        update: {},
        create: {
          userId: finalUser.id,
          roleId: saRole.id,
          department: 'Management',
          isActive: true,
        },
      });
    }
  }

  console.log('Super Admin credentials updated successfully.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
