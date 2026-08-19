import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getUpiMethods = async (req: Request, res: Response) => {
  try {
    const { mobile } = req.query;
    if (!mobile) return res.status(400).json({ error: 'Mobile is required' });

    const user = await prisma.user.findUnique({ where: { mobile: String(mobile) } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const methods = await prisma.upiMethod.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(methods);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch UPI methods', details: error.message });
  }
};

export const addUpiMethod = async (req: Request, res: Response) => {
  try {
    const { mobile, upiId, provider } = req.body;
    if (!mobile || !upiId || !provider) {
      return res.status(400).json({ error: 'mobile, upiId, and provider are required' });
    }

    const user = await prisma.user.findUnique({ where: { mobile: String(mobile) } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = await prisma.upiMethod.findFirst({
      where: { userId: user.id, upiId: upiId.toLowerCase().trim() },
    });
    if (existing) return res.status(409).json({ error: 'This UPI ID is already linked' });

    const count = await prisma.upiMethod.count({ where: { userId: user.id } });

    const method = await prisma.upiMethod.create({
      data: {
        userId: user.id,
        upiId: upiId.toLowerCase().trim(),
        provider,
        isPrimary: count === 0,
      },
    });
    res.status(201).json(method);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to add UPI method', details: error.message });
  }
};

export const setPrimaryUpi = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ error: 'Mobile is required' });

    const user = await prisma.user.findUnique({ where: { mobile: String(mobile) } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const target = await prisma.upiMethod.findUnique({ where: { id } });
    if (!target || target.userId !== user.id) {
      return res.status(404).json({ error: 'UPI method not found' });
    }

    await prisma.upiMethod.updateMany({
      where: { userId: user.id },
      data: { isPrimary: false },
    });

    const updated = await prisma.upiMethod.update({
      where: { id },
      data: { isPrimary: true },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update primary UPI', details: error.message });
  }
};

export const removeUpiMethod = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { mobile } = req.query;
    if (!mobile) return res.status(400).json({ error: 'Mobile is required' });

    const user = await prisma.user.findUnique({ where: { mobile: String(mobile) } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const target = await prisma.upiMethod.findUnique({ where: { id } });
    if (!target || target.userId !== user.id) {
      return res.status(404).json({ error: 'UPI method not found' });
    }

    await prisma.upiMethod.delete({ where: { id } });

    if (target.isPrimary) {
      const next = await prisma.upiMethod.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await prisma.upiMethod.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to remove UPI method', details: error.message });
  }
};