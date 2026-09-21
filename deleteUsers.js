const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mobiles = ['9131484529', '9691743206'];
  for (const mobile of mobiles) {
    const deleted = await prisma.user.deleteMany({
      where: { mobile: mobile }
    });
    console.log(`Deleted ${deleted.count} user(s) for mobile ${mobile}`);
  }
}

main()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
