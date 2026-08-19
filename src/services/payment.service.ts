import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { pricingService, PricingInput, PricingResult } from './pricing.service';
import { sequenceService } from './sequence.service';
import { invoiceService } from './invoice.service';
import { sendNotificationToUser, sendNotificationToMultipleUsers } from './notification.service';
import { logAudit } from '../utils/auditLogger';

const razorpay = new Razorpay({
  key_id: env.razorpayKeyId,
  key_secret: env.razorpayKeySecret,
});

export interface CreateOrderInput {
  userId: string;
  testIds: string[];
  packageIds: string[];
  collectionMode: 'HOME' | 'LAB';
  couponCode?: string;
  ipAddress?: string;
  scheduledDate?: string;
  scheduledSlot?: string;
  patientName?: string;
  patientAge?: number;
  patientGender?: string;
  mobile?: string;
  addressId?: string;
  branchId?: string;
}

export interface CreateOrderResult {
  razorpayOrderId: string;
  keyId: string;
  currency: string;
  amount: number;
  pricing: PricingResult;
  idempotencyKey: string;
}

export class PaymentService {
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const {
      userId,
      testIds,
      packageIds,
      collectionMode,
      couponCode,
      ipAddress,
      scheduledDate,
      scheduledSlot,
      patientName,
      patientAge,
      patientGender,
      mobile,
      addressId,
      branchId,
    } = input;

    const pricing = await pricingService.calculate({
      testIds,
      packageIds,
      collectionMode,
      couponCode,
      userId,
    });

    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${userId}:${testIds.sort().join(',')}:${packageIds.sort().join(',')}:${pricing.finalAmount}:${Date.now()}`)
      .digest('hex');

    const amountInPaise = Math.round(pricing.finalAmount * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: idempotencyKey.substring(0, 40),
      notes: {
        userId,
        collectionMode,
        couponCode: couponCode || '',
      },
    });

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.bookingIntent.create({
      data: {
        razorpayOrderId: order.id,
        idempotencyKey,
        userId,
        status: 'PENDING_PAYMENT',
        expiresAt,
        bookingPayload: {
          testIds,
          packageIds,
          collectionMode,
          couponCode: couponCode || null,
          scheduledDate: scheduledDate || null,
          scheduledSlot: scheduledSlot || null,
          patientName: patientName || null,
          patientAge: patientAge || null,
          patientGender: patientGender || null,
          mobile: mobile || null,
          addressId: addressId || null,
          branchId: branchId || null,
        },
        pricingSnapshot: {
          subtotal: pricing.subtotal,
          testDiscount: pricing.testDiscount,
          couponCode: pricing.couponCode,
          couponId: pricing.couponId,
          couponDiscount: pricing.couponDiscount,
          collectionCharge: pricing.collectionCharge,
          gst: pricing.gst,
          platformFee: pricing.platformFee,
          finalAmount: pricing.finalAmount,
        },
      },
    });

    await logAudit({
      userId,
      action: 'RAZORPAY_ORDER_CREATED',
      module: 'PAYMENT',
      ipAddress,
      metadata: {
        razorpayOrderId: order.id,
        amount: pricing.finalAmount,
        idempotencyKey,
      },
    });

    return {
      razorpayOrderId: order.id,
      keyId: env.razorpayKeyId,
      currency: 'INR',
      amount: pricing.finalAmount,
      pricing,
      idempotencyKey,
    };
  }

  verifySignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): boolean {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expected = crypto
      .createHmac('sha256', env.razorpayKeySecret)
      .update(body)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(razorpaySignature, 'hex')
    );
  }

  async fulfillFromIntent(
    intent: any,
    razorpayPaymentId: string,
    razorpaySignature: string,
    webhookVerified: boolean
  ): Promise<string> {
    if (intent.bookingId) {
      return intent.bookingId;
    }

    const payload = intent.bookingPayload as any;
    const snapshot = intent.pricingSnapshot as any;
    const safeCollectionMode = payload.collectionMode === 'lab' ? 'LAB' : (payload.collectionMode || 'HOME');

    const user = await prisma.user.findUnique({ where: { id: intent.userId } });
    if (!user) throw new Error('User not found for booking intent.');

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let bookingCode = 'MS';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) bookingCode += chars[bytes[i] % chars.length];
    while (await prisma.booking.findUnique({ where: { bookingCode } })) {
      const b2 = crypto.randomBytes(6);
      bookingCode = 'MS';
      for (let i = 0; i < 6; i++) bookingCode += chars[b2[i] % chars.length];
    }

    let finalAddressId = payload.addressId;
    let finalBranchId: string | undefined;

    if (safeCollectionMode === 'LAB') {
      if (!payload.branchId) throw new Error('branchId missing in BookingIntent for LAB booking.');
      const branch = await prisma.branch.findUnique({ where: { id: payload.branchId } });
      if (!branch || !branch.isActive) throw new Error('Branch invalid or inactive.');
      finalBranchId = branch.id;
      const centerAddr = await prisma.address.findFirst({
        where: { userId: user.id, type: 'CENTER', line1: branch.line1 },
      }) || await prisma.address.create({
        data: {
          userId: user.id,
          type: 'CENTER',
          line1: branch.line1,
          city: branch.city,
          state: branch.state,
          pincode: branch.pincode,
        },
      });
      finalAddressId = centerAddr.id;
    } else if (!finalAddressId) {
      const defaultAddr = await prisma.address.findFirst({
        where: { userId: user.id },
        orderBy: { isDefault: 'desc' },
      });
      if (!defaultAddr) throw new Error('No address found for user.');
      finalAddressId = defaultAddr.id;
    }

    const scheduledDate = payload.scheduledDate
      ? new Date(payload.scheduledDate)
      : new Date();

    const bookingId = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          bookingCode,
          userId: user.id,
          scheduledDate,
          scheduledSlot: payload.scheduledSlot || 'Anytime',
          totalPaid: snapshot.finalAmount,
          patientName: payload.patientName || user.name || 'Guest',
          patientAge: payload.patientAge ? Number(payload.patientAge) : null,
          patientGender: payload.patientGender || null,
          patientMobile: payload.mobile || user.mobile || null,
          status: safeCollectionMode === 'HOME' ? 'WAITING_FOR_PARTNER' : 'WAITING_FOR_ASSIGNMENT',
          paymentStatus: 'SUCCESS',
          collectionMode: safeCollectionMode as any,
          addressId: finalAddressId,
          branchId: finalBranchId,
          paymentMode: 'UPI',
          paymentId: razorpayPaymentId,
          razorpayOrderId: intent.razorpayOrderId,
          tests: {
            create: (payload.testIds || []).map((id: string) => ({ testId: id })),
          },
          packages: {
            create: (payload.packageIds || []).map((id: string) => ({ packageId: id })),
          },
        },
      });

      await tx.pricingSnapshot.create({
        data: {
          bookingId: newBooking.id,
          testIds: payload.testIds || [],
          packageIds: payload.packageIds || [],
          subtotal: snapshot.subtotal,
          testDiscount: snapshot.testDiscount,
          couponCode: snapshot.couponCode,
          couponId: snapshot.couponId,
          couponDiscount: snapshot.couponDiscount,
          collectionCharge: snapshot.collectionCharge,
          gst: snapshot.gst,
          platformFee: snapshot.platformFee,
          finalAmount: snapshot.finalAmount,
          collectionMode: safeCollectionMode,
        },
      });

      await tx.payment.create({
        data: {
          bookingId: newBooking.id,
          amount: snapshot.finalAmount,
          subtotal: snapshot.subtotal,
          discount: snapshot.testDiscount,
          couponDiscount: snapshot.couponDiscount,
          couponCode: snapshot.couponCode,
          couponId: snapshot.couponId,
          collectionCharge: snapshot.collectionCharge,
          gst: snapshot.gst,
          platformFee: snapshot.platformFee,
          currency: 'INR',
          gateway: 'RAZORPAY',
          razorpayOrderId: intent.razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          status: 'CAPTURED',
          webhookVerified,
          idempotencyKey: intent.idempotencyKey,
          paidAt: new Date(),
        },
      });

      if (snapshot.couponId) {
        await tx.coupon.update({
          where: { id: snapshot.couponId },
          data: { usedCount: { increment: 1 } },
        });
        await tx.couponRedemption.create({
          data: {
            couponId: snapshot.couponId,
            userId: user.id,
            bookingId: newBooking.id,
            discount: snapshot.couponDiscount,
          },
        });
      }

      await tx.bookingIntent.update({
        where: { id: intent.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          bookingId: newBooking.id,
        },
      });

      return newBooking.id;
    });

    sendNotificationToUser(
      user.id,
      'Booking Confirmed',
      'Your booking has been created successfully.',
      'BOOKING_CREATED',
      { bookingId }
    ).catch(console.error);

    if (safeCollectionMode === 'HOME') {
      const availablePartners = await prisma.pathologyPartner.findMany({
        where: { approvalStatus: 'APPROVED', isAvailable: true },
        include: { user: { select: { id: true } } },
      });
      if (availablePartners.length > 0) {
        sendNotificationToMultipleUsers(
          availablePartners.map(p => p.user.id),
          'New Booking Available',
          `A new home collection booking is available.`,
          'NEW_BOOKING_ASSIGNED',
          { bookingId }
        ).catch(console.error);
      }
    }

    return bookingId;
  }

async verifyAndFinalize(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    bookingId: string;
    userId: string;
    ipAddress?: string;
  }): Promise<void> {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId, userId, ipAddress } = input;

    const isValid = this.verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) throw new Error('Invalid payment signature.');

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { paymentStatus: true, totalPaid: true },
    });
    if (!booking) throw new Error('Booking not found.');
    if (booking.paymentStatus === 'SUCCESS') return;

    await prisma.$transaction(async (tx) => {
 const bookingForUpdate = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { status: true, collectionMode: true },
      });

      const nextStatus =
        bookingForUpdate?.collectionMode === 'LAB' &&
        bookingForUpdate?.status === 'PATIENT_REACHED_LAB'
          ? 'SAMPLE_COLLECTED'
          : bookingForUpdate?.status;

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'SUCCESS',
          paymentMode: 'UPI',
          paymentId: razorpayPaymentId,
          razorpayOrderId,
          paymentReceivedAt: new Date(),
          paymentReceivedById: userId,
          status: nextStatus as any,
        },
      });

      const existing = await tx.payment.findUnique({ where: { bookingId } });
      if (!existing) {
        await tx.payment.create({
          data: {
            bookingId,
            amount: booking.totalPaid,
            currency: 'INR',
            gateway: 'RAZORPAY',
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            status: 'CAPTURED',
            webhookVerified: false,
            paidAt: new Date(),
          },
        });
      } else {
        await tx.payment.update({
          where: { bookingId },
          data: {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            status: 'CAPTURED',
            paidAt: new Date(),
          },
        });
      }
    });

await logAudit({
      userId,
      action: 'PAYMENT_VERIFIED',
      module: 'PAYMENT',
      entityId: bookingId,
      ipAddress,
      metadata: { razorpayOrderId, razorpayPaymentId },
    });

    this.runPostPaymentJobs(bookingId, userId).catch(console.error);
  }

  async runPostPaymentJobs(bookingId: string, userId: string): Promise<void> {
    try {
const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          user: true,
          branch: true,
          tests: { include: { test: { include: { category: true } } } },
          packages: { include: { package: true } },
          payment: true,
        },
      });
      if (!booking || !booking.payment) return;

      if (booking.payment.invoiceUrl && booking.payment.receiptUrl) {
        return;
      }

      const address = booking.addressId
        ? await prisma.address.findUnique({ where: { id: booking.addressId } })
        : null;

      const collectionAddress = address
        ? `${address.line1}${address.line2 ? ', ' + address.line2 : ''}, ${address.city}, ${address.state} - ${address.pincode}`
        : undefined;

      const snapshot = await prisma.pricingSnapshot.findUnique({ where: { bookingId } });

      let invoiceNumber = booking.payment.invoiceNumber;
      let receiptNumber = booking.payment.receiptNumber;

      if (!invoiceNumber || !receiptNumber) {
        const [inv, rec] = await Promise.all([
          sequenceService.nextInvoiceNumber(),
          sequenceService.nextReceiptNumber(),
        ]);
        invoiceNumber = inv;
        receiptNumber = rec;
      }

 const lineItems = [
...booking.tests.map(bt => ({
          name: bt.test.name,
          category: (bt.test as any).category?.name || '',
          itemType: 'test',
          originalPrice: bt.test.price,
          discountedPrice: bt.test.discountedPrice,
          discount: bt.test.price - bt.test.discountedPrice,
        })),
        ...booking.packages.map(bp => ({
          name: bp.package.name,
          category: 'Package',
          itemType: 'package',
          originalPrice: bp.package.oldPrice,
          discountedPrice: bp.package.price,
          discount: bp.package.oldPrice - bp.package.price,
        })),
      ];
     const { invoice, receipt } = await invoiceService.generateAndUploadInvoice({
        invoiceNumber: invoiceNumber!,
        receiptNumber: receiptNumber!,
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        paymentId: booking.payment.id,
        razorpayOrderId: booking.payment.razorpayOrderId || '',
        razorpayPaymentId: booking.payment.razorpayPaymentId || '',
        paymentMethod: booking.payment.method || 'Online',
        paidAt: booking.payment.paidAt || new Date(),
  patientName: booking.patientName,
        patientAge: booking.patientAge,
        patientDob: booking.user?.dob || null,
        patientGender: booking.patientGender,
        patientMobile: booking.patientMobile,
        patientEmail: booking.user?.email || null,
        collectionMode: booking.collectionMode,
        collectionAddress,
        branchName: (booking as any).branch?.name || null,
        scheduledDate: booking.scheduledDate,
        scheduledSlot: booking.scheduledSlot,
        lineItems,
        subtotal: snapshot?.subtotal ?? booking.totalPaid,
        testDiscount: snapshot?.testDiscount ?? 0,
        couponCode: snapshot?.couponCode,
        couponDiscount: snapshot?.couponDiscount ?? 0,
        collectionCharge: snapshot?.collectionCharge ?? 0,
        gst: snapshot?.gst ?? 0,
        platformFee: snapshot?.platformFee ?? 0,
        finalAmount: booking.totalPaid,
      });

      await prisma.payment.update({
        where: { bookingId },
        data: {
          invoiceNumber: invoiceNumber!,
          receiptNumber: receiptNumber!,
          invoiceUrl: invoice.url,
          invoicePublicId: invoice.publicId,
          invoiceGeneratedAt: new Date(),
          receiptUrl: receipt.url,
          receiptPublicId: receipt.publicId,
          receiptGeneratedAt: new Date(),
        },
      });

      await sendNotificationToUser(
        userId,
        'Payment Successful',
        'Your payment was successful. Your booking is confirmed and your invoice is ready.',
        'PAYMENT_SUCCESS',
        { bookingId, invoiceUrl: invoice.url }
      ).catch(console.error);

      await logAudit({
        userId,
        action: 'INVOICE_GENERATED',
        module: 'PAYMENT',
        entityId: bookingId,
        metadata: { invoiceNumber, receiptNumber, invoiceUrl: invoice.url },
      });
    } catch (err) {
      console.error('[PostPayment] Failed for booking:', bookingId, err);
    }
  }
}

export const paymentService = new PaymentService();