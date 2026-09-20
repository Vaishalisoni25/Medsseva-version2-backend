import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getWallet = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const transactions = await prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      balance: user.walletBalance,
      transactions,
    });
  } catch (error: any) {
    console.error('getWallet error:', error);
    res.status(500).json({ error: 'Failed to fetch wallet data', details: error.message });
  }
};
