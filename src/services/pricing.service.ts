import { prisma } from '../lib/prisma';

export interface PricingInput {
  testIds: string[];
  packageIds: string[];
  collectionMode: 'HOME' | 'LAB';
  couponCode?: string;
  userId: string;
}

export interface LineItem {
  id: string;
  name: string;
  itemType: 'test' | 'package';
  originalPrice: number;
  discountedPrice: number;
  discount: number;
}

export interface PricingResult {
  lineItems: LineItem[];
  subtotal: number;
  testDiscount: number;
  couponCode: string | null;
  couponId: string | null;
  couponDiscount: number;
  collectionCharge: number;
  gstRate: number;
  gst: number;
  platformFee: number;
  finalAmount: number;
  hasHomeCollection: boolean;
}

const GST_RATE = 0.18;

export class PricingService {
  async calculate(input: PricingInput): Promise<PricingResult> {
    const { testIds, packageIds, collectionMode, couponCode, userId } = input;

    if (testIds.length === 0 && packageIds.length === 0) {
      throw new Error('At least one test or package is required.');
    }

    const [tests, packages, settings] = await Promise.all([
      testIds.length > 0
        ? prisma.test.findMany({
            where: { id: { in: testIds }, isActive: true },
          })
        : Promise.resolve([]),
      packageIds.length > 0
        ? prisma.healthPackage.findMany({
            where: { id: { in: packageIds }, isActive: true },
          })
        : Promise.resolve([]),
      prisma.systemSettings.findUnique({ where: { id: 'singleton' } }),
    ]);

    if (testIds.length > 0 && tests.length !== testIds.length) {
      const foundIds = tests.map(t => t.id);
      const missing = testIds.filter(id => !foundIds.includes(id));
      throw new Error(`Tests not found or inactive: ${missing.join(', ')}`);
    }

    if (packageIds.length > 0 && packages.length !== packageIds.length) {
      const foundIds = packages.map(p => p.id);
      const missing = packageIds.filter(id => !foundIds.includes(id));
      throw new Error(`Packages not found or inactive: ${missing.join(', ')}`);
    }

    const lineItems: LineItem[] = [];
    let subtotal = 0;
    let testDiscount = 0;
    let hasHomeCollection = false;

    for (const test of tests) {
      const discount = test.price - test.discountedPrice;
      lineItems.push({
        id: test.id,
        name: test.name,
        itemType: 'test',
        originalPrice: test.price,
        discountedPrice: test.discountedPrice,
        discount,
      });
      subtotal += test.price;
      testDiscount += discount;
      if (test.homeCollection) hasHomeCollection = true;
    }

    for (const pkg of packages) {
      const originalPrice = pkg.oldPrice;
      const discountedPrice = pkg.price;
      const discount = originalPrice - discountedPrice;
      lineItems.push({
        id: pkg.id,
        name: pkg.name,
        itemType: 'package',
        originalPrice,
        discountedPrice,
        discount,
      });
      subtotal += originalPrice;
      testDiscount += discount;
      if (pkg.homeCollection) hasHomeCollection = true;
    }

    const priceAfterItemDiscount = subtotal - testDiscount;

    let couponDiscount = 0;
    let resolvedCouponCode: string | null = null;
    let resolvedCouponId: string | null = null;

    if (couponCode && couponCode.trim() !== '') {
      const couponResult = await this.validateAndCalculateCoupon({
        code: couponCode.trim().toUpperCase(),
        cartTotal: priceAfterItemDiscount,
        testIds,
        packageIds,
        collectionMode,
        userId,
      });
      couponDiscount = couponResult.discount;
      resolvedCouponCode = couponResult.code;
      resolvedCouponId = couponResult.couponId;
    }

    const collectionCharge =
      collectionMode === 'HOME' && hasHomeCollection
        ? (settings?.homeCollectionCharge ?? 150)
        : 0;

    const taxableAmount = priceAfterItemDiscount - couponDiscount + collectionCharge;
    const gst = Math.round(taxableAmount * GST_RATE * 100) / 100;
    const platformFee = 0;

    const finalAmount =
      Math.round((taxableAmount + gst + platformFee) * 100) / 100;

    return {
      lineItems,
      subtotal,
      testDiscount,
      couponCode: resolvedCouponCode,
      couponId: resolvedCouponId,
      couponDiscount,
      collectionCharge,
      gstRate: GST_RATE,
      gst,
      platformFee,
      finalAmount,
      hasHomeCollection,
    };
  }

  private async validateAndCalculateCoupon(params: {
    code: string;
    cartTotal: number;
    testIds: string[];
    packageIds: string[];
    collectionMode: string;
    userId: string;
  }): Promise<{ discount: number; code: string; couponId: string }> {
    const { code, cartTotal, testIds, packageIds, collectionMode, userId } = params;

    const now = new Date();
    const coupon = await prisma.coupon.findUnique({ where: { code } });

    if (!coupon || !coupon.isActive) {
      throw new Error('Coupon is invalid or inactive.');
    }
    if (coupon.startsAt && now < coupon.startsAt) {
      throw new Error('Coupon is not yet active.');
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      throw new Error('Coupon has expired.');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new Error('Coupon usage limit has been reached.');
    }
    if (cartTotal < coupon.minOrderAmount) {
      throw new Error(
        `Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon.`
      );
    }

    const userUsageCount = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId },
    });
    if (userUsageCount >= coupon.perUserLimit) {
      throw new Error('You have already used this coupon the maximum number of times.');
    }

    if (
      coupon.applicableCollectionMode &&
      coupon.applicableCollectionMode !== collectionMode
    ) {
      throw new Error('This coupon is not applicable for the selected collection mode.');
    }

    if (
      coupon.applicableTestIds.length > 0 &&
      !testIds.some(id => coupon.applicableTestIds.includes(id))
    ) {
      throw new Error('This coupon is not applicable for the selected tests.');
    }

    if (
      coupon.applicablePackageIds.length > 0 &&
      !packageIds.some(id => coupon.applicablePackageIds.includes(id))
    ) {
      throw new Error('This coupon is not applicable for the selected packages.');
    }

    let discount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discount = (cartTotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount !== null) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else {
      discount = coupon.discountValue;
    }

    discount = Math.min(Math.round(discount * 100) / 100, cartTotal);

    return { discount, code: coupon.code, couponId: coupon.id };
  }
}

export const pricingService = new PricingService();