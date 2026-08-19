import { PrismaClient } from '@prisma/client';
import { seedCategories } from './categories.seed';
import { seedTests } from './tests.seed';
import { seedPackages } from './packages.seed';
import { seedOffers } from './offers.seed';
import { seedParameters } from './parameters.seed';

// Move the existing branch + RBAC logic into these files and import here
import { seedBranches } from './branches.seed';
import { seedRbac } from './rbac.seed';

const prisma = new PrismaClient();

export async function main() {
  console.log('Starting MedsSeva production seed...\n');

  try {
 
    await seedRbac(prisma);
    await seedBranches(prisma);
    await seedCategories(prisma);
   await seedTests(prisma);
    await seedParameters(prisma);
    await seedPackages(prisma);
    await seedOffers(prisma);


    console.log('\nAll seeds completed successfully!');
  } catch (e) {
    console.error('Seed failed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();