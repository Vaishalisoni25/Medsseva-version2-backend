const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const b = await prisma.booking.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { address: true }
  });
  console.log(JSON.stringify(b.map(x => ({
    id: x.id,
    status: x.status,
    mode: x.collectionMode,
    addressId: x.addressId,
    lat: x.address?.latitude,
    lng: x.address?.longitude,
    addrType: x.address?.type
  })), null, 2));
}

main().finally(() => prisma.$disconnect());
