import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getAllCities = async (req: Request, res: Response) => {
  try {
    const cities = await prisma.city.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(cities);
  } catch (error: any) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: 'Failed to fetch cities', details: error.message });
  }
};

export const addCity = async (req: Request, res: Response) => {
  try {
    const { name, icon, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'City name is required' });
    }

    const city = await prisma.city.create({
      data: {
        name,
        icon: icon || 'city',
        isActive: isActive !== undefined ? isActive : true,
      }
    });

    res.status(201).json(city);
  } catch (error: any) {
    console.error('Error adding city:', error);
    res.status(500).json({ error: 'Failed to add city', details: error.message });
  }
};
