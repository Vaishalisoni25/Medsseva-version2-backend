import { Request, Response } from 'express';
import { webhookService } from '../services/webhook.service';
import { paymentService } from '../services/payment.service';
import { pricingService } from '../services/pricing.service';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import crypto from 'crypto';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: env.razorpayKeyId,
  key_secret: env.razorpayKeySecret,
});


const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
  req.socket.remoteAddress ||
  '';

export const getPricingPreview = async (req: any, res: Response) => {
  try {
    const { testIds = [], packageIds = [], collectionMode, couponCode } = req.body;

const pricing = await pricingService.calculate({
      testIds,
      packageIds,
      collectionMode: collectionMode?.toUpperCase() === 'LAB' ? 'LAB' : 'HOME',
      couponCode,
      userId: req.user.id,
    });

    res.json({ pricing });
  } catch (err: any) {
    const status = err.message?.includes('not found') || err.message?.includes('inactive') ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
};

export const createPaymentOrder = async (req: any, res: Response) => {
  try {
    const { testIds = [], packageIds = [], collectionMode: bodyCollectionMode, couponCode, bookingId } = req.body;

if (bookingId) {
      const existingBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { collectionMode: true, totalPaid: true, userId: true },
      });
      if (!existingBooking) {
        return res.status(404).json({ error: 'Booking not found.' });
      }

      const idempotencyKey = crypto
        .createHash('sha256')
        .update(`${bookingId}:${existingBooking.totalPaid}:${Date.now()}`)
        .digest('hex');

      const amountInPaise = Math.round(existingBooking.totalPaid * 100);

      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: idempotencyKey.substring(0, 40),
        notes: { bookingId, collectionMode: existingBooking.collectionMode },
      });

      return res.json({
        razorpayOrderId: order.id,
        keyId: env.razorpayKeyId,
        currency: 'INR',
        amount: existingBooking.totalPaid,
        idempotencyKey,
      });
    }

    let collectionMode = bodyCollectionMode;

    if (!collectionMode) {
      return res.status(400).json({ error: 'collectionMode is required.' });
    }

    const result = await paymentService.createOrder({
      userId: req.user.id,
      testIds,
      packageIds,
      collectionMode: collectionMode === 'lab' ? 'LAB' : 'HOME',
      couponCode,
      ipAddress: getIp(req),
    });

    res.json({
      razorpayOrderId: result.razorpayOrderId,
      keyId: result.keyId,
      currency: result.currency,
      amount: result.amount,
      idempotencyKey: result.idempotencyKey,
      pricing: {
        subtotal: result.pricing.subtotal,
        testDiscount: result.pricing.testDiscount,
        couponCode: result.pricing.couponCode,
        couponDiscount: result.pricing.couponDiscount,
        collectionCharge: result.pricing.collectionCharge,
        gst: result.pricing.gst,
        finalAmount: result.pricing.finalAmount,
        lineItems: result.pricing.lineItems,
      },
    });
  } catch (err: any) {
    const status =
      err.message?.includes('not found') || err.message?.includes('inactive')
        ? 404
        : err.message?.includes('Coupon')
        ? 400
        : 500;
    res.status(status).json({ error: err.message });
  }
};

export const verifyPayment = async (req: any, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return res.status(400).json({ error: 'razorpay_order_id, razorpay_payment_id, razorpay_signature, and bookingId are all required.' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { userId: true, paymentStatus: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

 const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'].includes(req.user.role);
    if (booking.userId !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    if (booking.paymentStatus === 'SUCCESS') {
      return res.json({ success: true, message: 'Payment already verified.' });
    }

    await paymentService.verifyAndFinalize({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      bookingId,
      userId: req.user.id,
      ipAddress: getIp(req),
    });

    const updatedBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        bookingCode: true,
        status: true,
        paymentStatus: true,
        payment: {
          select: {
            invoiceUrl: true,
            receiptUrl: true,
            invoiceNumber: true,
            receiptNumber: true,
          },
        },
      },
    });

    res.json({ success: true, booking: updatedBooking });
  } catch (err: any) {
    if (err.message?.includes('signature')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Payment verification failed.' });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = (req as any).rawBody as string;

    if (!rawBody) {
      return res.status(400).json({ error: 'Raw body unavailable.' });
    }
    if (!signature) {
      return res.status(400).json({ error: 'Missing webhook signature.' });
    }

    await webhookService.processEvent(rawBody, signature);

    res.json({ status: 'ok' });
  } catch (err: any) {
    if (err.message === 'Invalid webhook signature') {
      return res.status(400).json({ error: err.message });
    }
    console.error('[Webhook] Processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
};

export const getRazorpayConfig = async (_req: Request, res: Response) => {
  res.json({ keyId: env.razorpayKeyId });
};

export const getInvoice = async (req: any, res: Response) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        userId: true,
        payment: {
          select: {
            invoiceUrl: true,
            receiptUrl: true,
            invoiceNumber: true,
            receiptNumber: true,
            invoiceGeneratedAt: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const isOwner = booking.userId === req.user.id;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    if (!booking.payment?.invoiceUrl) {
      return res.status(404).json({ error: 'Invoice not yet generated.' });
    }

    res.json({
      invoiceUrl: booking.payment.invoiceUrl,
      receiptUrl: booking.payment.receiptUrl,
      invoiceNumber: booking.payment.invoiceNumber,
      receiptNumber: booking.payment.receiptNumber,
      generatedAt: booking.payment.invoiceGeneratedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch invoice.' });
  }
};

export const regenerateInvoice = async (req: any, res: Response) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { userId: true, paymentStatus: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.paymentStatus !== 'SUCCESS') {
      return res.status(400).json({ error: 'Cannot regenerate invoice for unpaid booking.' });
    }

    await prisma.payment.updateMany({
      where: { bookingId },
      data: { invoiceUrl: null, receiptUrl: null },
    });

    await paymentService.runPostPaymentJobs(bookingId, booking.userId);

    res.json({ success: true, message: 'Invoice regeneration queued.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to regenerate invoice.' });
  }
};