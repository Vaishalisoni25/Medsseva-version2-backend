import { PrismaClient } from '@prisma/client';

export async function seedCategories(prisma: PrismaClient) {
  console.log('Seeding test categories...');

await prisma.packageTest.deleteMany();
  await prisma.bookingTest.deleteMany();
  await prisma.bookingPackage.deleteMany();
  await prisma.healthPackage.deleteMany();
  await prisma.test.deleteMany();
  await prisma.testCategory.deleteMany();

 const categoriesData = [
    { id: 'blood', name: 'Blood Tests', iconName: 'water', slug: 'blood-tests', testCount: '20+', displayOrder: 1 },
    { id: 'thyroid', name: 'Thyroid', iconName: 'butterfly', slug: 'thyroid', testCount: '5+', displayOrder: 2 },
    { id: 'fullbody', name: 'Full Body', iconName: 'body', slug: 'full-body', testCount: '10+', displayOrder: 3 },
    { id: 'diabetes', name: 'Diabetes', iconName: 'droplet', slug: 'diabetes', testCount: '8+', displayOrder: 4 },
    { id: 'cardiac', name: 'Cardiac', iconName: 'heart', slug: 'cardiac', testCount: '6+', displayOrder: 5 },
    { id: 'liver', name: 'Liver', iconName: 'organ', slug: 'liver', testCount: '7+', displayOrder: 6 },
    { id: 'vitamins', name: 'Vitamins & Minerals', iconName: 'pill', slug: 'vitamins', testCount: '4+', displayOrder: 7 },
    { id: 'fever', name: 'Fever & Infection', iconName: 'thermometer', slug: 'fever', testCount: '5+', displayOrder: 8 },
  ];
  await prisma.testCategory.createMany({ data: categoriesData });
  console.log(`${categoriesData.length} categories created`);
}