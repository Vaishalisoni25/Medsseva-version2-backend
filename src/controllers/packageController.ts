import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getAllPackages = async (req: Request, res: Response) => {
  try {
    const packages = await prisma.healthPackage.findMany({
      include: {
        testsIncluded: {
          include: {
            test: true
          }
        }
      },
    });

    res.json(packages);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch packages', details: error.message });
  }
};

export const getPackageById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pkg = await prisma.healthPackage.findUnique({
      where: { id },
      include: {
        testsIncluded: {
          include: {
            test: true
          }
        }
      },
    });
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json(pkg);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch package', details: error.message });
  }
};

export const createPackage = async (req: Request, res: Response) => {
  try {
    const { 
      id, name, subtitle, category, categoryId, description, 
      price, oldPrice, discount, parametersCount, badge, 
      testsIncluded, preparation, isActive 
    } = req.body;

    const healthPackage = await prisma.healthPackage.create({
      data: {
        id,
        name,
        subtitle: subtitle || '',
        category: category || 'General',
        categoryId: categoryId || 'general',
        description: description || '',
        price: Number(price),
        oldPrice: Number(oldPrice),
        discount: discount || '',
        parametersCount: Number(parametersCount),
        badge: badge || '',
        preparation: preparation || '',
        isActive: isActive !== undefined ? !!isActive : true,
      },
    });

    if (testsIncluded && Array.isArray(testsIncluded)) {
      // Assuming testsIncluded is an array of test IDs
      const packageTests = testsIncluded.map(testId => ({
        packageId: healthPackage.id,
        testId: testId,
      }));

      await prisma.packageTest.createMany({
        data: packageTests,
        skipDuplicates: true
      });
    }

    const createdPackage = await prisma.healthPackage.findUnique({
      where: { id: healthPackage.id },
      include: {
        testsIncluded: {
          include: {
            test: true
          }
        }
      }
    });

    res.status(201).json(createdPackage);
  } catch (error: any) {
    console.error('Failed to create package:', error);
    res.status(500).json({ error: 'Failed to create package', details: error.message });
  }
};
