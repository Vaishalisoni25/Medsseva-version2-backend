import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getPaymentMethods = async (req: any, res: Response) => {
  try {
    const methods = await prisma.paymentMethod.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(methods);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
};

export const addPaymentMethod = async (req: any, res: Response) => {
  try {
    const { cardBrand, last4, holder, expiry } = req.body;

    if (!cardBrand || !last4 || !holder || !expiry) {
      return res.status(400).json({ error: 'cardBrand, last4, holder, and expiry are required.' });
    }

    const count = await prisma.paymentMethod.count({ where: { userId: req.user.id } });

    const method = await prisma.paymentMethod.create({
      data: {
        userId: req.user.id,
        cardBrand,
        last4,
        holder,
        expiry,
        isPrimary: count === 0,
      },
    });
    res.status(201).json(method);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to add payment method' });
  }
};

export const setDefaultPaymentMethod = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const target = await prisma.paymentMethod.findUnique({ where: { id } });
    if (!target || target.userId !== req.user.id) {
      return res.status(404).json({ error: 'Payment method not found.' });
    }

    await prisma.paymentMethod.updateMany({
      where: { userId: req.user.id },
      data: { isPrimary: false },
    });

    const updated = await prisma.paymentMethod.update({
      where: { id },
      data: { isPrimary: true },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to set default' });
  }
};

export const removePaymentMethod = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const target = await prisma.paymentMethod.findUnique({ where: { id } });
    if (!target || target.userId !== req.user.id) {
      return res.status(404).json({ error: 'Payment method not found.' });
    }

    await prisma.paymentMethod.delete({ where: { id } });

    if (target.isPrimary) {
      const next = await prisma.paymentMethod.findFirst({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await prisma.paymentMethod.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to remove payment method' });
  }
};