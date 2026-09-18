import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';

export const getCoupons = async (req: Request, res: Response) => {
  try {
    const isAdmin = (req as any).user?.role && (req as any).user.role !== 'USER' && (req as any).user.role !== 'PARTNER';
    const now = new Date();

    const coupons = await prisma.coupon.findMany({
      where: isAdmin ? undefined : {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });
    res.json(coupons);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch coupons', details: error.message });
  }
};
export const getCouponById = async (req: Request, res: Response) => {
  try {
    const coupon = await prisma.coupon.findUnique({
      where: { id: req.params.id },
      include: { redemptions: true, auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    res.json(coupon);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch coupon', details: error.message });
  }
};

export const createCoupon = async (req: Request, res: Response) => {
  try {
    const {
      code, name, description, discountType, discountValue, minOrderAmount,
      maxDiscount, usageLimit, perUserLimit, expiresAt, startsAt,
      isFirstOrderOnly, applicableUserType, applicablePaymentMode,
      applicableCollectionMode, applicableCityIds, applicableBranchIds,
      applicableTestIds, applicablePackageIds,
    } = req.body;

    if (!code || !discountType || !discountValue) {
      return res.status(400).json({ error: 'code, discountType, and discountValue are required' });
    }

    const existing = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (existing) return res.status(409).json({ error: 'Coupon code already exists' });

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        name,
        description,
        discountType,
        discountValue: parseFloat(discountValue),
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : 0,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        perUserLimit: perUserLimit ? parseInt(perUserLimit) : 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        startsAt: startsAt ? new Date(startsAt) : null,
        isFirstOrderOnly: isFirstOrderOnly || false,
        applicableUserType: applicableUserType || null,
        applicablePaymentMode: applicablePaymentMode || null,
        applicableCollectionMode: applicableCollectionMode || null,
        applicableCityIds: applicableCityIds || [],
        applicableBranchIds: applicableBranchIds || [],
        applicableTestIds: applicableTestIds || [],
        applicablePackageIds: applicablePackageIds || [],
        createdById: (req as any).user?.id,
      },
    });

    await prisma.couponAuditLog.create({
      data: {
        couponId: coupon.id,
        couponCode: coupon.code,
        action: 'COUPON_CREATED',
        performedById: (req as any).user?.id,
        performedByRole: (req as any).user?.role,
        ipAddress: getIp(req),
        details: { discountType, discountValue },
      },
    });

    res.status(201).json(coupon);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create coupon', details: error.message });
  }
};

export const updateCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Coupon not found' });

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...req.body,
        code: req.body.code ? req.body.code.toUpperCase() : existing.code,
        updatedById: (req as any).user?.id,
      },
    });

    await prisma.couponAuditLog.create({
      data: {
        couponId: id,
        couponCode: coupon.code,
        action: 'COUPON_UPDATED',
        performedById: (req as any).user?.id,
        performedByRole: (req as any).user?.role,
        ipAddress: getIp(req),
        details: req.body,
      },
    });

    res.json(coupon);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update coupon', details: error.message });
  }
};

export const toggleCouponStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });

    const updated = await prisma.coupon.update({
      where: { id },
      data: { isActive, updatedById: (req as any).user?.id },
    });

    await prisma.couponAuditLog.create({
      data: {
        couponId: id,
        couponCode: coupon.code,
        action: isActive ? 'COUPON_ACTIVATED' : 'COUPON_DEACTIVATED',
        performedById: (req as any).user?.id,
        performedByRole: (req as any).user?.role,
        ipAddress: getIp(req),
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to toggle coupon status', details: error.message });
  }
};

export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });

    await prisma.couponAuditLog.create({
      data: {
        couponId: id,
        couponCode: coupon.code,
        action: 'COUPON_DELETED',
        performedById: (req as any).user?.id,
        performedByRole: (req as any).user?.role,
        ipAddress: getIp(req),
      },
    });

    await prisma.coupon.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete coupon', details: error.message });
  }
};

export const validateCoupon = async (req: Request, res: Response) => {
  try {
    const { code, cartTotal, testIds, packageIds, collectionMode, paymentMode, branchId, cityId } = req.body;
    const userId = (req as any).user?.id;

    if (!code || !cartTotal) {
      return res.status(400).json({ error: 'code and cartTotal are required' });
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
      include: { _count: { select: { redemptions: true } } },
    });

    if (!coupon) {
      const referralUser = await prisma.user.findUnique({
        where: { referralCode: code.toUpperCase() },
      });
      if (referralUser) {
        if (userId) {
          if (referralUser.id === userId) {
            return res.status(400).json({ valid: false, error: 'You cannot use your own referral code' });
          }
          const bookingCount = await prisma.booking.count({ where: { userId, status: { not: 'CANCELLED' } } });
          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (bookingCount > 0 || (user && user.firstTestFreeUsed)) {
            return res.status(400).json({ valid: false, error: 'Referral code discount is only valid for your first lab test' });
          }
        }
        const numericCartTotal = parseFloat(cartTotal) || 0;
        const discount = Math.round(numericCartTotal * 0.5 * 100) / 100;
        const finalAmount = Math.max(0, Math.round((numericCartTotal - discount) * 100) / 100);
        return res.json({
          valid: true,
          code: referralUser.referralCode || code.toUpperCase(),
          discount,
          finalAmount,
          description: 'First Lab Test 50% Discount via Referral!',
          coupon: {
            id: 'REFERRAL_50_DISCOUNT',
            code: referralUser.referralCode || code.toUpperCase(),
            name: 'First Lab Test 50% Referral Discount',
            discountType: 'PERCENTAGE',
            discountValue: 50,
            description: 'Get 50% discount on your first lab test with referral code',
          },
        });
      }
      return res.status(404).json({ valid: false, error: 'Invalid coupon or referral code' });
    }
    if (!coupon.isActive) return res.status(400).json({ valid: false, error: 'This coupon is inactive' });

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) {
      return res.status(400).json({ valid: false, error: 'This coupon is not yet active' });
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      await prisma.coupon.update({ where: { id: coupon.id }, data: { isActive: false } });
      return res.status(400).json({ valid: false, error: 'This coupon has expired' });
    }

    if (coupon.usageLimit && coupon._count.redemptions >= coupon.usageLimit) {
      return res.status(400).json({ valid: false, error: 'Coupon usage limit has been reached' });
    }

    if (coupon.minOrderAmount && cartTotal < coupon.minOrderAmount) {
      return res.status(400).json({ valid: false, error: `Minimum order value of ₹${coupon.minOrderAmount} required` });
    }

    if (userId) {
      const userRedemptions = await prisma.couponRedemption.count({
        where: { couponId: coupon.id, userId },
      });
      if (userRedemptions >= coupon.perUserLimit) {
        return res.status(400).json({ valid: false, error: 'You have already used this coupon' });
      }

      if (coupon.isFirstOrderOnly) {
        const bookingCount = await prisma.booking.count({ where: { userId } });
        if (bookingCount > 0) {
          return res.status(400).json({ valid: false, error: 'This coupon is valid for first order only' });
        }
      }
    }

    if (coupon.applicableCollectionMode && collectionMode && coupon.applicableCollectionMode.toUpperCase() !== collectionMode.toUpperCase()) {
      return res.status(400).json({ valid: false, error: `This coupon is valid for ${coupon.applicableCollectionMode} only` });
    }

    if (coupon.applicablePaymentMode && paymentMode && coupon.applicablePaymentMode.toUpperCase() !== paymentMode.toUpperCase()) {
      return res.status(400).json({ valid: false, error: `This coupon is valid for ${coupon.applicablePaymentMode} payments only` });
    }

    if (coupon.applicableBranchIds.length > 0 && branchId && !coupon.applicableBranchIds.includes(branchId)) {
      return res.status(400).json({ valid: false, error: 'This coupon is not valid for your selected branch' });
    }

    if (coupon.applicableCityIds.length > 0 && cityId && !coupon.applicableCityIds.includes(cityId)) {
      return res.status(400).json({ valid: false, error: 'This coupon is not valid in your city' });
    }

    if (coupon.applicableTestIds.length > 0 && testIds) {
      const hasMatch = testIds.some((id: string) => coupon.applicableTestIds.includes(id));
      if (!hasMatch) return res.status(400).json({ valid: false, error: 'This coupon is not valid for selected tests' });
    }

    if (coupon.applicablePackageIds.length > 0 && packageIds) {
      const hasMatch = packageIds.some((id: string) => coupon.applicablePackageIds.includes(id));
      if (!hasMatch) return res.status(400).json({ valid: false, error: 'This coupon is not valid for selected packages' });
    }

    let discount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discount = (cartTotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    } else {
      discount = coupon.discountValue;
    }
    discount = Math.min(discount, cartTotal);
    discount = Math.round(discount * 100) / 100;

    res.json({
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discount,
      finalAmount: cartTotal - discount,
      message: `Coupon applied! You saved ₹${discount}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Coupon validation failed', details: error.message });
  }
};

export const getCouponAnalytics = async (req: Request, res: Response) => {
  try {
    const now = new Date();

    const [total, active, expired, inactive, redemptions] = await Promise.all([
      prisma.coupon.count(),
      prisma.coupon.count({ where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
      prisma.coupon.count({ where: { expiresAt: { lt: now } } }),
      prisma.coupon.count({ where: { isActive: false } }),
      prisma.couponRedemption.aggregate({ _sum: { discount: true }, _count: { id: true } }),
    ]);

    const topCoupons = await prisma.coupon.findMany({
      take: 5,
      orderBy: { usedCount: 'desc' },
      select: { code: true, usedCount: true, name: true },
    });

    res.json({
      total,
      active,
      expired,
      inactive,
      totalRedemptions: redemptions._count.id,
      totalDiscountGiven: redemptions._sum.discount || 0,
      topCoupons,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch analytics', details: error.message });
  }
};