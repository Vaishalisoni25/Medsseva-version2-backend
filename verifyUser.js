const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { mobile: '9131484529' }
  });
  if (user) {
    console.log('User exists:', user);
    // Mark as verified so they can login directly
    await prisma.user.update({
      where: { id: user.id },
      data: { isMobileVerified: true }
    });
    console.log('User marked as verified!');
  } else {
    console.log('User not found, creating...');
    const newUser = await prisma.user.create({
      data: {
        mobile: '9131484529',
        name: 'Test User',
        role: 'USER',
        isMobileVerified: true,
      }
    });
    console.log('Created and verified user:', newUser);
  }
}

main().finally(() => prisma.$disconnect());
