import { PrismaClient } from '@prisma/client';

export async function seedOffers(prisma: PrismaClient) {
  console.log('Seeding offers...');

  await prisma.offer.createMany({
    skipDuplicates: true,
    data: [
      {
        title: 'First Booking Offer',
        description: 'Get 30% off on your first health test booking.',
        offerType: 'PERCENTAGE',
        discount: 30,
        priority: 1,
        isActive: true,
      },
      {
        title: 'Home Collection Free',
        description: 'Free home sample collection on orders above ₹499.',
        offerType: 'FLAT',
        discount: 0,
        priority: 2,
        isActive: true,
      },
      {
        title: 'Monsoon Health Check',
        description: 'Special monsoon fever panel at 57% off.',
        offerType: 'PERCENTAGE',
        discount: 57,
        priority: 3,
        isActive: true,
      },
    ],
  });

  console.log('Offers seeded');
}