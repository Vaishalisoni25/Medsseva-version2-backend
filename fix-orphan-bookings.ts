import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixOrphanBookings() {
  const bookings = await prisma.booking.findMany();
  let fixed = 0;

  for (const booking of bookings) {
    const address = await prisma.address.findUnique({
      where: { id: booking.addressId }
    });

    if (!address) {
      const userAddress = await prisma.address.findFirst({
        where: { userId: booking.userId },
        orderBy: { isDefault: 'desc' }
      });

      if (userAddress) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { addressId: userAddress.id }
        });
        console.log(`Fixed: ${booking.id} → ${userAddress.id} (${userAddress.city})`);
        fixed++;
      } else {
        console.log(`Skipped: ${booking.id} - user has no valid address`);
      }
    }
  }

  console.log(`\nDone. Fixed ${fixed} bookings.`);
}

fixOrphanBookings()
  .catch(console.error)
  .finally(() => prisma.$disconnect());