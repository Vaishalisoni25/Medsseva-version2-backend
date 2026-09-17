import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import Razorpay from 'razorpay';
import { env } from '../config/env';

const razorpay = new Razorpay({
  key_id: env.razorpayKeyId,
  key_secret: env.razorpayKeySecret,
});

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
  req.socket.remoteAddress ||
  '';

export const executeRefund = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const { refundType, amount, reason } = req.body;
    const actor = (req as any).user;

    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor?.role)) {
      return res.status(403).json({ error: 'Only Admin or Super Admin can process refunds.' });
    }
    if (!reason?.trim()) {
      return res.status(400).json({ error: 'Refund reason is required.' });
    }
    if (!['FULL', 'PARTIAL'].includes(refundType)) {
      return res.status(400).json({ error: 'refundType must be FULL or PARTIAL.' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: { include: { user: true } },
        refunds: {
          where: { status: { in: ['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED'] } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!payment) return res.status(404).json({ error: 'Payment not found.' });
    if (!payment.booking) return res.status(404).json({ error: 'Booking not found.' });
    if (!payment.razorpayPaymentId) {
      return res.status(400).json({ error: 'No Razorpay payment ID found. Cannot process refund.' });
    }

    const alreadyRefundedStatuses = ['CAPTURED', 'PARTIALLY_REFUNDED'];
    if (!alreadyRefundedStatuses.includes(payment.status)) {
      if (payment.status === 'REFUNDED') {
        return res.status(400).json({ error: 'This payment has already been fully refunded.' });
      }
      return res.status(400).json({ error: `Payment status is ${payment.status}. Only CAPTURED payments can be refunded.` });
    }

    const pendingOrProcessing = payment.refunds.find(r => ['PENDING', 'PROCESSING'].includes(r.status));
    if (pendingOrProcessing) {
      const rzpRefundId = pendingOrProcessing.razorpayRefundId;
      if (rzpRefundId) {
     try {
          const rzpStatus = await razorpay.refunds.fetch(rzpRefundId);
          if ((rzpStatus as any).status === 'processed') {
            await prisma.refund.update({
              where: { id: pendingOrProcessing.id },
              data: { status: 'COMPLETED', processedAt: new Date(), gatewayResponse: JSON.parse(JSON.stringify(rzpStatus)) },
            });
            return res.status(409).json({
              error: 'A previous refund for this payment was found already processed. Please refresh and check refund history.',
            });
          }
        } catch {}
      }
      return res.status(409).json({
        error: 'A refund is already pending or processing for this payment. Please wait for it to complete before initiating another.',
      });
    }

    const totalAlreadyRefunded = payment.refunds
      .filter(r => r.status === 'COMPLETED')
      .reduce((s, r) => s + r.amount, 0);

    const remainingRefundable = Math.round((payment.amount - totalAlreadyRefunded) * 100) / 100;

    if (remainingRefundable <= 0) {
      return res.status(400).json({ error: 'This payment has been fully refunded already.' });
    }

    const refundAmount = refundType === 'FULL'
      ? remainingRefundable
      : Math.round(Number(amount) * 100) / 100;

    if (!refundAmount || refundAmount <= 0) {
      return res.status(400).json({ error: 'Invalid refund amount.' });
    }
    if (refundAmount > remainingRefundable) {
      return res.status(400).json({
        error: `Refund amount ₹${refundAmount} exceeds remaining refundable balance ₹${remainingRefundable}.`,
      });
    }

    const idempotencyKey = `refund:${paymentId}:${Math.round(refundAmount * 100)}:${actor.id}:${Date.now()}`;

    const refundRecord = await prisma.refund.create({
      data: {
        paymentId,
        bookingId: payment.bookingId,
        amount: refundAmount,
        reason: reason.trim(),
        status: 'PROCESSING',
        requestedById: actor.id,
        approvedById: actor.id,
        approvalNotes: `${refundType} refund initiated by ${actor.role} - idempotency: ${idempotencyKey}`,
      },
    });

    let gatewayRefundId: string | null = null;
    let gatewayResponse: any = null;
    let refundStatus: 'COMPLETED' | 'PROCESSING' = 'PROCESSING';

    try {
      const rzpRefund = await razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: Math.round(refundAmount * 100),
        speed: 'normal',
        notes: {
          reason: reason.trim(),
          refundId: refundRecord.id,
          adminId: actor.id,
          adminRole: actor.role,
          bookingCode: payment.booking.bookingCode,
          refundType,
        },
      });

    gatewayRefundId = (rzpRefund as any).id;
      gatewayResponse = JSON.parse(JSON.stringify(rzpRefund));
      refundStatus = (rzpRefund as any).status === 'processed' ? 'COMPLETED' : 'PROCESSING';

      const totalRefunded = totalAlreadyRefunded + refundAmount;
      const isFullyRefunded = Math.round(totalRefunded * 100) >= Math.round(payment.amount * 100);
      const newPaymentStatus = isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      await prisma.$transaction(async (tx) => {
        await tx.refund.update({
          where: { id: refundRecord.id },
          data: {
            status: refundStatus,
            razorpayRefundId: gatewayRefundId,
            processedAt: refundStatus === 'COMPLETED' ? new Date() : undefined,
            gatewayResponse,
          },
        });

        await tx.payment.update({
          where: { id: paymentId },
          data: { status: newPaymentStatus },
        });

        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { paymentStatus: isFullyRefunded ? 'REFUNDED' : 'SUCCESS' },
        });

        await tx.financeAuditLog.create({
          data: {
            action: 'REFUND_EXECUTED',
            module: 'REFUND',
            paymentId,
            refundId: refundRecord.id,
            bookingRef: payment.bookingId,
            txReference: gatewayRefundId,
            performedById: actor.id,
            performedByRole: actor.role,
            ipAddress: getIp(req),
            details: {
              refundType,
              amount: refundAmount,
              remainingAfter: remainingRefundable - refundAmount,
              reason: reason.trim(),
              razorpayRefundId: gatewayRefundId,
              bookingCode: payment.booking.bookingCode,
              patientName: payment.booking.patientName,
              isFullyRefunded,
            },
          },
        });
      });

      if (payment.booking.user?.id) {
        const { sendNotificationToUser } = await import('../services/notification.service');
        sendNotificationToUser(
          payment.booking.user.id,
          refundStatus === 'COMPLETED' ? 'Refund Processed' : 'Refund Initiated',
          `₹${refundAmount.toLocaleString('en-IN')} refund for booking ${payment.booking.bookingCode} has been ${refundStatus === 'COMPLETED' ? 'processed' : 'initiated'}. Refund ID: ${gatewayRefundId}. Amount will be credited within 5–7 business days.`,
          'PAYMENT_SUCCESS',
          {
            bookingId: payment.bookingId,
            refundId: refundRecord.id,
            razorpayRefundId: gatewayRefundId,
            refundAmount,
            refundStatus,
          }
        ).catch(console.error);
      }

      const updatedRefund = await prisma.refund.findUnique({
        where: { id: refundRecord.id },
        include: {
          payment: {
            include: { booking: { select: { bookingCode: true, patientName: true } } },
          },
        },
      });

      return res.status(201).json({
        success: true,
        refund: updatedRefund,
        razorpayRefundId: gatewayRefundId,
        status: refundStatus,
        refundAmount,
        remainingRefundable: remainingRefundable - refundAmount,
        message: refundStatus === 'COMPLETED'
          ? 'Refund processed successfully.'
          : 'Refund initiated. Amount will be credited within 5–7 business days.',
      });
    } catch (gatewayErr: any) {
      await prisma.refund.update({
        where: { id: refundRecord.id },
        data: {
          status: 'FAILED',
          gatewayResponse: { error: gatewayErr.error || gatewayErr.message, description: gatewayErr.error?.description },
        },
      });

      await prisma.financeAuditLog.create({
        data: {
          action: 'REFUND_FAILED',
          module: 'REFUND',
          paymentId,
          refundId: refundRecord.id,
          performedById: actor.id,
          performedByRole: actor.role,
          ipAddress: getIp(req),
          details: {
            error: gatewayErr.error?.description || gatewayErr.message,
            amount: refundAmount,
            bookingCode: payment.booking.bookingCode,
          },
        },
      });

      const errMsg = gatewayErr.error?.description || gatewayErr.message || 'Gateway refund failed.';
      return res.status(502).json({ error: `Razorpay refund failed: ${errMsg}` });
    }
  } catch (error: any) {
    console.error('[executeRefund]', error);
    res.status(500).json({ error: 'Failed to process refund.' });
  }
};
export const getPaymentSummary = async (req: Request, res: Response) => {
  try {
    const [totalCaptured, totalPending, totalRefunded, totalSettlementsPending] = await Promise.all([
      prisma.payment.aggregate({ where: { status: 'CAPTURED' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
      prisma.refund.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.settlement.aggregate({ where: { status: 'PENDING' }, _sum: { commissionAmount: true } }),
    ]);

    res.json({
      totalCollected: totalCaptured._sum.amount || 0,
      totalCaptured: totalCaptured._sum.amount || 0,
      totalPending: totalPending._sum.amount || 0,
      totalRefunded: totalRefunded._sum.amount || 0,
      pendingSettlements: totalSettlementsPending._sum.commissionAmount || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch payment summary' });
  }
};

export const getPayments = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', status, from, to } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  uhid: true,
                  mobile: true,
                  email: true,
                  addresses: true,
                },
              },
              tests: {
                include: {
                  test: true,
                },
              },
              packages: {
                include: {
                  package: true,
                },
              },
              branch: {
                select: {
                  id: true,
                  name: true,
                  city: true,
                },
              },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({ payments, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        booking: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                uhid: true,
                mobile: true,
                email: true,
                addresses: true,
              },
            },
            tests: {
              include: {
                test: true,
              },
            },
            packages: {
              include: {
                package: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                city: true,
              },
            },
          },
        },
        refunds: true,
        financeAuditLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
};

export const getRefunds = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) where.status = status;

    const refunds = await prisma.refund.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        payment: {
          include: {
            booking: { select: { bookingCode: true, patientName: true } },
          },
        },
      },
    });

    res.json(refunds);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch refunds' });
  }
};

export const requestRefund = async (req: Request, res: Response) => {
  try {
    const { paymentId, amount, reason, approvalNotes } = req.body;
    if (!paymentId || !amount || !reason) {
      return res.status(400).json({ error: 'paymentId, amount, and reason are required.' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: { where: { status: { in: ['PENDING', 'APPROVED', 'COMPLETED'] } } } },
    });

    if (!payment) return res.status(404).json({ error: 'Payment not found.' });
    if (payment.status !== 'CAPTURED') return res.status(400).json({ error: 'Only captured payments can be refunded.' });

    const totalRefunded = payment.refunds.reduce((s, r) => s + r.amount, 0);
    if (totalRefunded + amount > payment.amount) {
      return res.status(400).json({ error: 'Refund amount exceeds payment amount.' });
    }

    const refund = await prisma.refund.create({
      data: {
        paymentId,
        bookingId: payment.bookingId,
        amount,
        reason,
        approvalNotes,
        status: 'PENDING',
        requestedById: (req as any).user?.id,
      },
    });

    await prisma.financeAuditLog.create({
      data: {
        action: 'REFUND_REQUESTED',
        module: 'REFUND',
        paymentId,
        refundId: refund.id,
        bookingRef: payment.bookingId,
        performedById: (req as any).user?.id,
        performedByRole: (req as any).user?.role,
        ipAddress: getIp(req),
        details: { amount, reason },
      },
    });

    res.status(201).json(refund);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to request refund.' });
  }
};

export const approveRefund = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const refund = await prisma.refund.findUnique({ where: { id }, include: { payment: true } });
    if (!refund) return res.status(404).json({ error: 'Refund not found.' });
    if (refund.status !== 'PENDING') return res.status(400).json({ error: 'Only pending refunds can be approved.' });

    await prisma.refund.update({ where: { id }, data: { status: 'APPROVED', approvedById: (req as any).user?.id } });

    let gatewayRefundId: string | null = null;

    if (refund.payment.razorpayPaymentId) {
      try {
        const gatewayRefund = await razorpay.payments.refund(refund.payment.razorpayPaymentId, {
          amount: Math.round(refund.amount * 100),
          notes: { reason: refund.reason },
        });
        gatewayRefundId = (gatewayRefund as any).id;
      } catch (gatewayErr: any) {
        await prisma.refund.update({
          where: { id },
          data: { status: 'FAILED', gatewayResponse: { error: gatewayErr.message } },
        });
        return res.status(502).json({ error: 'Gateway refund failed.', details: gatewayErr.message });
      }
    }

    const updated = await prisma.refund.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        razorpayRefundId: gatewayRefundId,
        processedAt: new Date(),
        gatewayResponse: { refundId: gatewayRefundId },
      },
    });

    const totalRefunded = (
      await prisma.refund.aggregate({
        where: { paymentId: refund.paymentId, status: 'COMPLETED' },
        _sum: { amount: true },
      })
    )._sum.amount || 0;

    const newPaymentStatus = totalRefunded >= refund.payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    await prisma.payment.update({ where: { id: refund.paymentId }, data: { status: newPaymentStatus } });
    await prisma.booking.update({
      where: { id: refund.bookingId },
      data: { paymentStatus: newPaymentStatus === 'REFUNDED' ? 'REFUNDED' : 'SUCCESS' },
    });

    await prisma.financeAuditLog.create({
      data: {
        action: 'REFUND_COMPLETED',
        module: 'REFUND',
        paymentId: refund.paymentId,
        refundId: id,
        txReference: gatewayRefundId || undefined,
        performedById: (req as any).user?.id,
        performedByRole: (req as any).user?.role,
        ipAddress: getIp(req),
        details: { amount: refund.amount, gatewayRefundId },
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to approve refund.' });
  }
};

export const rejectRefund = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const refund = await prisma.refund.findUnique({ where: { id } });
    if (!refund) return res.status(404).json({ error: 'Refund not found.' });
    if (refund.status !== 'PENDING') return res.status(400).json({ error: 'Only pending refunds can be rejected.' });

    const updated = await prisma.refund.update({
      where: { id },
      data: { status: 'REJECTED', approvedById: (req as any).user?.id, approvalNotes: reason },
    });

    await prisma.financeAuditLog.create({
      data: {
        action: 'REFUND_REJECTED',
        module: 'REFUND',
        refundId: id,
        performedById: (req as any).user?.id,
        performedByRole: (req as any).user?.role,
        ipAddress: getIp(req),
        details: { reason },
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reject refund.' });
  }
};

export const getSettlements = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) where.status = status;
    const settlements = await prisma.settlement.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(settlements);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch settlements.' });
  }
};

export const generateSettlements = async (req: Request, res: Response) => {
  try {
    const { periodStart, periodEnd, franchiseId, franchiseName, commissionRate = 15 } = req.body;
    if (!periodStart || !periodEnd || !franchiseName) {
      return res.status(400).json({ error: 'periodStart, periodEnd, and franchiseName are required.' });
    }

    const where: any = {
      paymentStatus: 'SUCCESS',
      createdAt: { gte: new Date(periodStart), lte: new Date(periodEnd) },
    };
    if (franchiseId) where.branchId = franchiseId;

    const bookings = await prisma.booking.findMany({ where, select: { totalPaid: true } });
    const totalBusiness = bookings.reduce((s, b) => s + b.totalPaid, 0);
    const commissionAmount = (totalBusiness * commissionRate) / 100;
    const taxOnCommission = commissionAmount * 0.18;
    const netPayable = commissionAmount - taxOnCommission;

    const period = `${new Date(periodStart).toLocaleDateString('en-IN')} - ${new Date(periodEnd).toLocaleDateString('en-IN')}`;

    const settlement = await prisma.settlement.create({
      data: {
        franchiseId,
        franchiseName,
        period,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        totalBusiness,
        commissionRate,
        commissionAmount,
        taxOnCommission,
        netPayable,
        status: 'PENDING',
      },
    });

    await prisma.financeAuditLog.create({
      data: {
        action: 'SETTLEMENT_GENERATED',
        module: 'SETTLEMENT',
        settlementId: settlement.id,
        performedById: (req as any).user?.id,
        performedByRole: (req as any).user?.role,
        ipAddress: getIp(req),
        details: { totalBusiness, commissionAmount, period },
      },
    });

    res.status(201).json(settlement);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate settlement.' });
  }
};

export const processSettlement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const settlement = await prisma.settlement.findUnique({ where: { id } });
    if (!settlement) return res.status(404).json({ error: 'Settlement not found.' });
    if (settlement.status !== 'PENDING' && settlement.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Settlement cannot be processed in its current state.' });
    }

    const payoutRef = `PAY-${settlement.settlementRef}-${Date.now()}`;

    const updated = await prisma.settlement.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        payoutReference: payoutRef,
        processedAt: new Date(),
        approvedById: (req as any).user?.id,
      },
    });

    await prisma.financeAuditLog.create({
      data: {
        action: 'SETTLEMENT_PROCESSED',
        module: 'SETTLEMENT',
        settlementId: id,
        txReference: payoutRef,
        performedById: (req as any).user?.id,
        performedByRole: (req as any).user?.role,
        ipAddress: getIp(req),
        details: { netPayable: settlement.netPayable, payoutRef },
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to process settlement.' });
  }
};