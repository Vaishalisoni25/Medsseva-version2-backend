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
      testsIncluded, testIds, preparation, isActive 
    } = req.body;

    const rawTests = testsIncluded || testIds || [];
    const numPrice = Number(price) || 0;
    const numOldPrice = Number(oldPrice) || numPrice;
    const numParams = Number(parametersCount) || (Array.isArray(rawTests) ? rawTests.length : 0);

    const healthPackage = await prisma.healthPackage.create({
      data: {
        id: id || undefined,
        name: name || 'Health Package',
        subtitle: subtitle || '',
        category: category || 'General',
        categoryId: categoryId || 'general',
        description: description || '',
        price: numPrice,
        oldPrice: numOldPrice,
        discount: discount || '',
        parametersCount: numParams,
        badge: badge || '',
        preparation: preparation || '',
        isActive: isActive !== undefined ? !!isActive : true,
      },
    });

    if (Array.isArray(rawTests) && rawTests.length > 0) {
      const packageTests = rawTests.map((testId: string) => ({
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
