import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { generateUniqueReferralCode } from '../utils/referral.utils';

export const getMyReferralInfo = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        referralCode: true,
        isFirstTestFreeEligible: true,
        firstTestFreeUsed: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Auto-generate referral code if not already assigned
    if (!user.referralCode) {
      const code = await generateUniqueReferralCode();
      user = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: {
          id: true,
          name: true,
          referralCode: true,
          isFirstTestFreeEligible: true,
          firstTestFreeUsed: true,
        },
      });
    }

    const referredUsers = await prisma.user.findMany({
      where: { referredById: userId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        firstTestFreeUsed: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalReferrals = referredUsers.length;
    const totalCompleted = referredUsers.filter((u) => u.firstTestFreeUsed).length;

    res.json({
      referralCode: user.referralCode,
      isFirstTestFreeEligible: user.isFirstTestFreeEligible,
      firstTestFreeUsed: user.firstTestFreeUsed,
      totalReferrals,
      totalCompleted,
      referredUsers: referredUsers.map((u) => ({
        name: u.name,
        joinedAt: u.createdAt,
        status: u.firstTestFreeUsed ? 'Completed First Test' : 'Signed Up',
      })),
    });
  } catch (error: any) {
    console.error('getMyReferralInfo error:', error.message);
    res.status(500).json({ error: 'Failed to fetch referral info' });
  }
};
