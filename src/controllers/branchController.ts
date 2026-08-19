import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getAllBranches = async (req: Request, res: Response) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(branches);
  } catch (error: any) {
    console.error('Failed to fetch branches:', error);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
};

export const createBranch = async (req: any, res: Response) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Admin can create branches.' });
    }
const { name, code, line1, city, state, pincode, workingHours } = req.body;
    if (!name || !code || !line1 || !city || !state || !pincode) {
      return res.status(400).json({ error: 'name, code, line1, city, state, pincode are required.' });
    }
    const branch = await prisma.branch.create({
      data: { name, code, line1, city, state, pincode, workingHours },
    });
    res.status(201).json(branch);
  } catch (error: any) {
    console.error('Failed to create branch:', error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
};

export const updateBranch = async (req: any, res: Response) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Admin can update branches.' });
    }
    const { id } = req.params;
 const { name, line1, city, state, pincode, workingHours, isActive } = req.body;
    const branch = await prisma.branch.update({
      where: { id },
      data: { name, line1, city, state, pincode, workingHours, isActive },
    });
    res.json(branch);
  } catch (error: any) {
    console.error('Failed to update branch:', error);
    res.status(500).json({ error: 'Failed to update branch' });
  }
};