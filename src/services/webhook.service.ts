import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { sendNotificationToUser } from './notification.service';
import { paymentService } from './payment.service';
import { logAudit } from '../utils/auditLogger';

export class WebhookService {
  verifySignature(rawBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', env.razorpayWebhookSecret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  }

  async processEvent(rawBody: string, signature: string): Promise<void> {
    if (!this.verifySignature(rawBody, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody);
    const eventId: string =
      event.event +
      ':' +
      (event.payload?.payment?.entity?.id ||
        event.payload?.order?.entity?.id ||
        event.payload?.refund?.entity?.id ||
        crypto.randomUUID());

    const existing = await prisma.webhookEvent.findUnique({ where: { eventId } });
    if (existing?.processed) {
      console.log(`[Webhook] Duplicate event ${eventId} - skipping`);
      return;
    }

    const webhookRecord = await prisma.webhookEvent.upsert({
      where: { eventId },
      update: {},
      create: {
        eventId,
        event: event.event,
        payload: event,
        processed: false,
        razorpayOrderId:
          event.payload?.payment?.entity?.order_id ||
          event.payload?.order?.entity?.id ||
          null,
      },
    });

    try {
      await this.dispatchEvent(event);
      await prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: { processed: true, processedAt: new Date() },
      });
    } catch (err: any) {
      await prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: { error: err.message },
      });
      throw err;
    }
  }

  private async dispatchEvent(event: any): Promise<void> {
    switch (event.event) {
      case 'payment.authorized':
        await this.handlePaymentAuthorized(event);
        break;
      case 'payment.captured':
      case 'order.paid':
        await this.handlePaymentCaptured(event);
        break;
      case 'payment.failed':
        await this.handlePaymentFailed(event);
        break;
      case 'refund.created':
        await this.handleRefundCreated(event);
        break;
      case 'refund.processed':
        await this.handleRefundProcessed(event);
        break;
      default:
        console.log(`[Webhook] Unhandled event: ${event.event}`);
    }
  }

  private async handlePaymentAuthorized(event: any): Promise<void> {
    const p = event.payload?.payment?.entity;
    if (!p?.order_id) return;

    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: p.order_id },
    });

    if (payment) {
      await prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          razorpayOrderId: p.order_id,
          razorpayPaymentId: p.id,
          status: 'AUTHORIZED',
          method: p.method,
          metadata: { authorized_at: p.created_at },
        },
      });
    }
  }

  private async handlePaymentCaptured(event: any): Promise<void> {
    const p = event.payload?.payment?.entity;
    const razorpayOrderId: string | undefined = p?.order_id;
    const razorpayPaymentId: string | undefined = p?.id;
    const razorpaySignature: string = '';
    const method: string | undefined = p?.method;

    if (!razorpayOrderId || !razorpayPaymentId) {
      console.warn(`[Webhook] ${event.event} missing order_id or payment_id`);
      return;
    }

    const existingPayment = await prisma.payment.findFirst({
      where: { razorpayOrderId },
      include: { booking: true },
    });

    if (existingPayment) {
      if (existingPayment.status === 'CAPTURED') {
        console.log(`[Webhook] Idempotency guard - payment already CAPTURED for order ${razorpayOrderId}`);

        await prisma.payment.update({
          where: { id: existingPayment.id },
          data: { webhookVerified: true },
        });

        paymentService
          .runPostPaymentJobs(existingPayment.bookingId, existingPayment.booking.userId)
          .catch(err => console.error('[Webhook] Post-payment job error:', err));
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            razorpayPaymentId,
            status: 'CAPTURED',
            method,
            webhookVerified: true,
            paidAt: p?.created_at ? new Date(p.created_at * 1000) : new Date(),
          },
        });

        await tx.booking.update({
          where: { id: existingPayment.bookingId },
          data: { paymentStatus: 'SUCCESS', paymentId: razorpayPaymentId },
        });

        await tx.bookingStatusLog.create({
          data: {
            bookingId: existingPayment.bookingId,
            status: existingPayment.booking.status as any,
            note: `Payment captured via webhook (${event.event}) - paymentId: ${razorpayPaymentId}`,
          },
        });
      });

      await logAudit({
        userId: existingPayment.booking.userId,
        action: 'WEBHOOK_PAYMENT_CAPTURED',
        module: 'PAYMENT',
        entityId: existingPayment.bookingId,
        metadata: { razorpayOrderId, razorpayPaymentId, event: event.event },
      });

      paymentService
        .runPostPaymentJobs(existingPayment.bookingId, existingPayment.booking.userId)
        .catch(err => console.error('[Webhook] Post-payment job error:', err));
      return;
    }

    const intent = await prisma.bookingIntent.findUnique({
      where: { razorpayOrderId },
    });

    if (!intent) {
      console.warn(`[Webhook] No BookingIntent or Payment found for razorpayOrderId: ${razorpayOrderId}`);
      return;
    }

    if (intent.status === 'COMPLETED' && intent.bookingId) {
      console.log(`[Webhook] BookingIntent already completed for order ${razorpayOrderId}`);
      paymentService
        .runPostPaymentJobs(intent.bookingId, intent.userId)
        .catch(err => console.error('[Webhook] Post-payment job error:', err));
      return;
    }

    console.log(`[Webhook] Frontend never called verify - recovering booking from BookingIntent ${intent.id}`);

    try {
      const bookingId = await paymentService.fulfillFromIntent(
        intent,
        razorpayPaymentId,
        razorpaySignature,
        true
      );

      await logAudit({
        userId: intent.userId,
        action: 'WEBHOOK_BOOKING_RECOVERED',
        module: 'PAYMENT',
        entityId: bookingId,
        metadata: { razorpayOrderId, razorpayPaymentId, intentId: intent.id },
      });

      paymentService
        .runPostPaymentJobs(bookingId, intent.userId)
        .catch(err => console.error('[Webhook] Post-payment job error:', err));
    } catch (err: any) {
      console.error(`[Webhook] Failed to recover booking from intent ${intent.id}:`, err.message);
      throw err;
    }
  }

  private async handlePaymentFailed(event: any): Promise<void> {
    const p = event.payload?.payment?.entity;
    const razorpayOrderId: string | undefined = p?.order_id;
    const errorDescription: string = p?.error_description || 'Unknown error';
    const errorCode: string = p?.error_code || '';

    if (!razorpayOrderId) return;

    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId },
      include: { booking: true },
    });

    if (!payment || payment.status === 'CAPTURED') return;

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failureReason: errorDescription, webhookVerified: true },
      });

      await tx.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          razorpayOrderId,
          razorpayPaymentId: p?.id,
          status: 'FAILED',
          errorCode,
          errorDescription,
          method: p?.method,
        },
      });

      await tx.bookingStatusLog.create({
        data: {
          bookingId: payment.bookingId,
          status: payment.booking.status as any,
          note: `Payment failed via webhook: ${errorDescription}`,
        },
      });
    });

    sendNotificationToUser(
      payment.booking.userId,
      'Payment Failed',
      'Your payment could not be processed. Please retry.',
      'PAYMENT_FAILED',
      { bookingId: payment.bookingId }
    ).catch(console.error);
  }

private async handleRefundCreated(event: any): Promise<void> {
    const r = event.payload?.refund?.entity;
    if (!r?.id || !r?.payment_id) return;

    const payment = await prisma.payment.findFirst({
      where: { razorpayPaymentId: r.payment_id },
    });
    if (!payment) return;

    const exists = await prisma.refund.findFirst({ where: { razorpayRefundId: r.id } });
    if (exists) {
      if (exists.status === 'PROCESSING' || exists.status === 'PENDING') {
        await prisma.refund.update({
          where: { id: exists.id },
          data: { gatewayResponse: r },
        });
      }
      return;
    }

    const processingRecord = await prisma.refund.findFirst({
      where: {
        paymentId: payment.id,
        status: 'PROCESSING',
        razorpayRefundId: null,
        amount: r.amount / 100,
      },
    });

    if (processingRecord) {
      await prisma.refund.update({
        where: { id: processingRecord.id },
        data: { razorpayRefundId: r.id, gatewayResponse: r },
      });
      return;
    }

    await prisma.refund.create({
      data: {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        razorpayRefundId: r.id,
        amount: r.amount / 100,
        reason: 'Initiated via Razorpay - webhook sync',
        status: 'PROCESSING',
        gatewayResponse: r,
      },
    });
  }

private async handleRefundProcessed(event: any): Promise<void> {
    const r = event.payload?.refund?.entity;
    if (!r?.id) return;

    const refund = await prisma.refund.findFirst({ where: { razorpayRefundId: r.id } });
    if (!refund) return;

    if (refund.status === 'COMPLETED') return;

    const payment = await prisma.payment.findUnique({
      where: { id: refund.paymentId },
      include: {
        refunds: { where: { status: 'COMPLETED', id: { not: refund.id } } },
      },
    });
    if (!payment) return;

    const totalRefunded = payment.refunds.reduce((s, r) => s + r.amount, 0) + refund.amount;
    const isFullyRefunded = Math.round(totalRefunded * 100) >= Math.round(payment.amount * 100);

    await prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: 'COMPLETED',
          processedAt: r.created_at ? new Date(r.created_at * 1000) : new Date(),
          gatewayResponse: r,
        },
      });
      await tx.payment.update({
        where: { id: refund.paymentId },
        data: { status: isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
      });
      await tx.booking.update({
        where: { id: refund.bookingId },
        data: { paymentStatus: isFullyRefunded ? 'REFUNDED' : 'SUCCESS' },
      });
    });
  }
}

export const webhookService = new WebhookService();