import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { prisma } from '../lib/prisma';

export const submitRating = async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId, rating, review } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
    if (!bookingId || !rating) return res.status(400).json({ error: 'bookingId and rating are required.' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    if (review && review.length > 300) return res.status(400).json({ error: 'Review must be under 300 characters.' });

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { userId: true, assignedPartnerId: true, status: true, collectionMode: true },
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.userId !== userId) return res.status(403).json({ error: 'You can only rate your own bookings.' });
    if (!booking.assignedPartnerId) return res.status(400).json({ error: 'No partner assigned to this booking.' });

    const rateableStatuses = ['DELIVERED_TO_LAB', 'PROCESSING', 'REPORT_READY', 'COMPLETED'];
    if (!rateableStatuses.includes(booking.status)) {
      return res.status(400).json({ error: 'Rating is only available after sample has been delivered to lab.' });
    }

    const existing = await prisma.partnerRating.findUnique({ where: { bookingId } });
    if (existing) return res.status(400).json({ error: 'You have already rated this booking.' });

    const newRating = await prisma.partnerRating.create({
      data: {
        bookingId,
        partnerId: booking.assignedPartnerId,
        userId,
        rating,
        review: review || null,
      },
    });

    const allRatings = await prisma.partnerRating.aggregate({
      where: { partnerId: booking.assignedPartnerId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.pathologyPartner.update({
      where: { id: booking.assignedPartnerId },
      data: {
        rating: Math.round((allRatings._avg.rating || 0) * 10) / 10,
        totalRatings: allRatings._count.rating,
      },
    });

    res.status(201).json(newRating);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to submit rating', details: error.message });
  }
};

export const getBookingRating = async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId } = req.params;
    const rating = await prisma.partnerRating.findUnique({
      where: { bookingId },
      include: { user: { select: { name: true } } },
    });
    res.json(rating || null);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch rating', details: error.message });
  }
};

export const getPartnerRatings = async (req: AuthRequest, res: Response) => {
  try {
    const { partnerId } = req.params;

    const [ratings, aggregate] = await Promise.all([
      prisma.partnerRating.findMany({
        where: { partnerId },
        include: { user: { select: { name: true } }, booking: { select: { bookingCode: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.partnerRating.aggregate({
        where: { partnerId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach(r => { breakdown[r.rating] = (breakdown[r.rating] || 0) + 1; });

    res.json({
      averageRating: Math.round((aggregate._avg.rating || 0) * 10) / 10,
      totalRatings: aggregate._count.rating,
      breakdown,
      reviews: ratings.map(r => ({
        id: r.id,
        rating: r.rating,
        review: r.review,
        createdAt: r.createdAt,
        bookingCode: r.booking.bookingCode,
        userName: r.user.name,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch partner ratings', details: error.message });
  }
};