import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.testCategory.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { tests: true }
        }
      }
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { id, name, iconName } = req.body;
    const category = await prisma.testCategory.create({
      data: { id, name, iconName, slug: name.toLowerCase().replace(/\s+/g, '-') }
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error creating category', error });
  }
};
