import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { sendNotificationToUser } from '../services/notification.service';
import { paymentService } from '../services/payment.service';
export const getPartnerBookings = async (req: any, res: Response) => {
  try {
    const partner = await prisma.pathologyPartner.findUnique({
      where: { userId: req.user.id }
    });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });

    const bookings = await prisma.booking.findMany({
      where: { assignedPartnerId: partner.id },
      include: {
        user: { select: { name: true, mobile: true } },
        tests: { include: { test: { select: { name: true } } } },
        packages: { include: { package: { select: { name: true } } } },
        statusTimeline: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

  const formatted = await Promise.all(bookings.map(async (b) => {
      const address = await prisma.address.findUnique({ where: { id: b.addressId } });
      return {
        id: b.id,
        bookingCode: b.bookingCode,
        status: b.status,
        patientName: b.patientName,
        patientAge: b.patientAge,
        patientGender: b.patientGender,
        patientMobile: b.patientMobile,
        scheduledDate: b.scheduledDate,
        scheduledSlot: b.scheduledSlot,
        totalPaid: b.totalPaid,
        paymentStatus: b.paymentStatus,
        paymentMode: b.paymentMode,
        collectionMode: b.collectionMode,
        collectionOtp: b.collectionOtp,
        otpVerified: b.otpVerified,
        assignedPartnerId: b.assignedPartnerId,
        collectionStartedAt: b.collectionStartedAt,
        sampleCollectedAt: b.sampleCollectedAt,
        deliveredToLabAt: b.deliveredToLabAt,
        collectionAddress: address
          ? [address.line1, address.line2, address.city, address.pincode].filter(Boolean).join(', ')
          : null,
        tests: b.tests.map(t => ({ name: t.test.name })),
        packages: b.packages.map(p => ({ name: p.package.name })),
        statusTimeline: b.statusTimeline,
      };
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch bookings', details: error.message });
  }
};

// New: broadcast notifications - all WAITING_FOR_PARTNER bookings this partner hasn't rejected
export const getPartnerNotifications = async (req: any, res: Response) => {
  try {
    const partner = await prisma.pathologyPartner.findUnique({
      where: { userId: req.user.id }
    });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });
    if (partner.approvalStatus !== 'APPROVED') {
      return res.status(403).json({ error: 'Partner not approved yet.' });
    }
    if (!partner.isAvailable) {
      return res.json([]); // offline partners see nothing
    }

    const rejectedIds = await prisma.bookingRejection.findMany({
      where: { partnerId: partner.id },
      select: { bookingId: true },
    });
    const excludedIds = rejectedIds.map(r => r.bookingId);

    const bookings = await prisma.booking.findMany({
      where: {
        collectionMode: 'HOME',
        status: 'WAITING_FOR_PARTNER',
        id: { notIn: excludedIds },
      },
      include: {
        tests: { include: { test: { select: { name: true } } } },
        packages: { include: { package: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = await Promise.all(bookings.map(async (b) => {
      const address = await prisma.address.findUnique({ where: { id: b.addressId } });
      return {
        id: b.id,
        bookingCode: b.bookingCode,
        patientName: b.patientName,
        patientMobile: b.patientMobile,
        scheduledDate: b.scheduledDate,
        scheduledSlot: b.scheduledSlot,
        totalPaid: b.totalPaid,
        status: b.status,
        collectionAddress: address ? `${address.line1}, ${address.city}` : null,
        tests: b.tests.map(t => ({ name: t.test.name })),
        packages: b.packages.map(p => ({ name: p.package.name })),
      };
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
  }
};

export const acceptBooking = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const partner = await prisma.pathologyPartner.findUnique({ where: { userId: req.user.id } });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });
    if (partner.approvalStatus !== 'APPROVED') {
      return res.status(403).json({ error: 'Partner not approved.' });
    }

  // Check current booking state first
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Booking not found.' });

    // Case 1: Already accepted by THIS partner - idempotent, return current state
    if (existing.status === 'ACCEPTED' && existing.assignedPartnerId === partner.id) {
      const confirmedBooking = await prisma.booking.findUnique({ where: { id } });
      return res.json(confirmedBooking);
    }

    // Case 2: Atomic claim - only succeeds if still WAITING_FOR_PARTNER.
    // Sets status directly to ACCEPTED so user sees "Partner Assigned" immediately
    // with no intermediate ASSIGNED lag step on the partner app.
    const updated = await prisma.booking.updateMany({
      where: { id, status: 'WAITING_FOR_PARTNER' },
      data: {
        status: 'ACCEPTED',
        assignedPartnerId: partner.id,
        partnerAssignedAt: new Date(),
        partnerAcceptedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return res.status(409).json({ error: 'Booking already accepted by another partner.' });
    }

    await prisma.bookingStatusLog.create({
      data: {
        bookingId: id,
        status: 'ACCEPTED',
        note: `Accepted by partner ${partner.id}`,
        updatedBy: req.user.id,
      }
    });

    const booking = await prisma.booking.findUnique({ where: { id } });

    // Auto-generate OTP for pay-at-doorstep bookings only
    if (booking && booking.paymentStatus !== 'SUCCESS' && !booking.collectionOtp) {
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      await prisma.booking.update({
        where: { id },
        data: { collectionOtp: otp },
      });
    }

const updatedBooking = await prisma.booking.findUnique({
      where: { id },
      include: {
        assignedPartner: {
          include: {
            user: {
              select: { name: true, mobile: true, avatarUrl: true }
            }
          }
        }
      }
    });

    if (updatedBooking) {
      sendNotificationToUser(updatedBooking.userId, 'Booking Accepted', 'Your booking has been accepted.', 'BOOKING_ACCEPTED', { bookingId: id }).catch(console.error);
    }

    res.json(updatedBooking);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to accept booking', details: error.message });
  }
};

export const rejectBooking = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const partner = await prisma.pathologyPartner.findUnique({ where: { userId: req.user.id } });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });

   const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

const canReject = booking.status === 'WAITING_FOR_PARTNER' ||
      (booking.status === 'ACCEPTED' && booking.assignedPartnerId === partner.id);

    if (!canReject) {
      return res.status(400).json({ error: 'Booking cannot be rejected at this stage.' });
    }

   
    if (booking.status === 'ACCEPTED' && booking.assignedPartnerId === partner.id) {
      await prisma.booking.update({
        where: { id },
        data: {
          status: 'WAITING_FOR_PARTNER',
          assignedPartnerId: null,
          partnerAssignedAt: null,
          partnerAcceptedAt: null,
          collectionOtp: null,
        },
      });
    }
   
    await prisma.bookingRejection.upsert({
      where: { bookingId_partnerId: { bookingId: id, partnerId: partner.id } },
      update: { reason: reason || null },
      create: { bookingId: id, partnerId: partner.id, reason: reason || null },
    });

    await prisma.bookingStatusLog.create({
      data: {
        bookingId: id,
        status: 'WAITING_FOR_PARTNER',
        note: reason ? `Rejected by partner ${partner.id}: ${reason}` : `Rejected by partner ${partner.id}`,
        updatedBy: req.user.id,
      }
    });


    const [totalEligible, totalRejections] = await Promise.all([
      prisma.pathologyPartner.count({
        where: { approvalStatus: 'APPROVED', isAvailable: true }
      }),
      prisma.bookingRejection.count({ where: { bookingId: id } }),
    ]);

    if (totalEligible > 0 && totalRejections >= totalEligible) {
    
      console.warn(`All partners rejected booking ${id}. Admin manual assignment required.`);
   
    }

const rejectedBooking = await prisma.booking.findUnique({ where: { id } });
    if (rejectedBooking) {
      sendNotificationToUser(rejectedBooking.userId, 'Booking Update', 'Unfortunately your booking could not be accepted.', 'BOOKING_REJECTED', { bookingId: id }).catch(console.error);
    }

    res.json({ message: 'Booking rejected successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reject booking', details: error.message });
  }
};

const VALID_PARTNER_STATUSES = [
  'ON_THE_WAY', 'REACHED_LOCATION', 'SAMPLE_COLLECTED', 'DELIVERING_TO_BRANCH', 'DELIVERED_TO_LAB', 'PROCESSING'
];
export const updateBookingStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!VALID_PARTNER_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_PARTNER_STATUSES.join(', ')}` });
    }

    const partner = await prisma.pathologyPartner.findUnique({ where: { userId: req.user.id } });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.assignedPartnerId !== partner.id) {
      return res.status(403).json({ error: 'This booking is not assigned to you.' });
    }

    // Gate: SAMPLE_COLLECTED requires OTP verified + payment received
    if (status === 'SAMPLE_COLLECTED') {
      if (!booking.otpVerified && booking.paymentStatus !== 'SUCCESS') {
        return res.status(400).json({ error: 'OTP must be verified before collecting sample.' });
      }
      if (booking.paymentStatus !== 'SUCCESS') {
        return res.status(400).json({ error: 'Payment must be collected before marking sample collected.' });
      }
    }

    const timestampField: Record<string, string> = {
      ON_THE_WAY: 'collectionStartedAt',
      SAMPLE_COLLECTED: 'sampleCollectedAt',
      DELIVERED_TO_LAB: 'deliveredToLabAt',
    };

    const updateData: any = { status };
    if (timestampField[status]) {
      updateData[timestampField[status]] = new Date();
    }
    if (status === 'SAMPLE_COLLECTED') {
      updateData.partnerNote = note || null;
    }
    if (status === 'DELIVERED_TO_LAB') {
      updateData.status = 'DELIVERED_TO_LAB';
      await prisma.pathologyPartner.update({
        where: { id: partner.id },
        data: { totalCollections: { increment: 1 } }
      });
    }

const updated = await prisma.booking.update({ where: { id }, data: updateData });

    await prisma.bookingStatusLog.create({
      data: { bookingId: id, status: status as any, note: note || null, updatedBy: req.user.id }
    });

    const notifMap: Record<string, { title: string; body: string; type: any }> = {
      ON_THE_WAY: { title: 'Partner On The Way', body: 'Your sample collection executive is on the way.', type: 'PARTNER_ON_THE_WAY' },
      REACHED_LOCATION: { title: 'Partner Arrived', body: 'Your sample collection executive has arrived.', type: 'PARTNER_ARRIVED' },
      SAMPLE_COLLECTED: { title: 'Sample Collected', body: 'Sample collected successfully.', type: 'SAMPLE_COLLECTED' },
      DELIVERED_TO_LAB: { title: 'Sample Received in Lab', body: 'Your sample has reached the laboratory.', type: 'SAMPLE_RECEIVED_IN_LAB' },
    };

    const notif = notifMap[status];
    if (notif) {
      sendNotificationToUser(booking.userId, notif.title, notif.body, notif.type, { bookingId: id }).catch(console.error);
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update status', details: error.message });
  }
};

export const selectDeliveryBranch = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { branchId } = req.body;

    if (!branchId) {
      return res.status(400).json({ error: 'branchId is required.' });
    }

    const partner = await prisma.pathologyPartner.findUnique({ where: { userId: req.user.id } });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.assignedPartnerId !== partner.id) {
      return res.status(403).json({ error: 'This booking is not assigned to you.' });
    }
    if (booking.status !== 'SAMPLE_COLLECTED') {
      return res.status(400).json({ error: 'Sample must be collected before selecting delivery branch.' });
    }

    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || !branch.isActive) {
      return res.status(400).json({ error: 'Selected branch is invalid or inactive.' });
    }

    const existing = await prisma.sampleDelivery.findUnique({ where: { bookingId: id } });
    if (existing) {
      await prisma.sampleDelivery.update({
        where: { bookingId: id },
        data: { branchId, selectedAt: new Date(), status: 'SELECTED' },
      });
    } else {
      await prisma.sampleDelivery.create({
        data: {
          bookingId: id,
          partnerId: partner.id,
          branchId,
          status: 'SELECTED',
        },
      });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'DELIVERING_TO_BRANCH' },
    });

    await prisma.bookingStatusLog.create({
      data: {
        bookingId: id,
        status: 'DELIVERING_TO_BRANCH',
        note: `Delivery branch selected: ${branch.name} (${branch.city})`,
        updatedBy: req.user.id,
      },
    });

    res.json({ success: true, booking: updated, branch });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to select delivery branch', details: error.message });
  }
};

export const confirmBranchDelivery = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const partner = await prisma.pathologyPartner.findUnique({ where: { userId: req.user.id } });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.assignedPartnerId !== partner.id) {
      return res.status(403).json({ error: 'This booking is not assigned to you.' });
    }
    if (booking.status !== 'DELIVERING_TO_BRANCH') {
      return res.status(400).json({ error: 'Booking must be in DELIVERING_TO_BRANCH status.' });
    }

    const delivery = await prisma.sampleDelivery.findUnique({ where: { bookingId: id } });
    if (!delivery) {
      return res.status(400).json({ error: 'No delivery branch selected for this booking.' });
    }

    await prisma.sampleDelivery.update({
      where: { bookingId: id },
      data: {
        deliveryStartedAt: delivery.deliveryStartedAt ?? new Date(),
        deliveredAt: new Date(),
        status: 'DELIVERED',
      },
    });

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: 'DELIVERED_TO_LAB',
        deliveredToLabAt: new Date(),
      },
    });

    await prisma.pathologyPartner.update({
      where: { id: partner.id },
      data: { totalCollections: { increment: 1 } },
    });

    await prisma.bookingStatusLog.create({
      data: {
        bookingId: id,
        status: 'DELIVERED_TO_LAB',
        note: 'Sample delivered to selected branch by partner',
        updatedBy: req.user.id,
      },
    });

sendNotificationToUser(
      booking.userId,
      'Sample Received in Lab',
      'Your sample has reached the laboratory.',
      'SAMPLE_RECEIVED_IN_LAB',
      { bookingId: id }
    ).catch(console.error);

    sendNotificationToUser(
      booking.userId,
      'Rate Your Experience',
      'Please rate your sample collection experience.',
      'PARTNER_RATING_REQUEST',
      { bookingId: id }
    ).catch(console.error);

    res.json({ success: true, booking: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to confirm delivery', details: error.message });
  }
};

export const getDeliveryBranches = async (req: any, res: Response) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        city: true,
        line1: true,
        pincode: true,
        contactNumber: true,
        workingHours: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(branches);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch branches', details: error.message });
  }
};

export const collectCash = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const partner = await prisma.pathologyPartner.findUnique({ where: { userId: req.user.id } });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.assignedPartnerId !== partner.id) {
      return res.status(403).json({ error: 'This booking is not assigned to you.' });
    }
    if (!booking.otpVerified) {
      return res.status(400).json({ error: 'OTP must be verified before collecting payment.' });
    }
    if (booking.paymentStatus === 'SUCCESS') {
      return res.status(400).json({ error: 'Payment has already been collected for this booking.' });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        paymentStatus: 'SUCCESS',
        paymentMode: 'CASH',
        paymentReceivedAt: new Date(),
        paymentReceivedById: req.user.id,
      },
    });

await prisma.bookingStatusLog.create({
      data: {
        bookingId: id,
        status: booking.status as any,
        note: 'Cash collected by partner at doorstep',
        updatedBy: req.user.id,
      }
    });

    const existingPayment = await prisma.payment.findUnique({ where: { bookingId: id } });
    if (!existingPayment) {
      await prisma.payment.create({
        data: {
          bookingId: id,
          amount: booking.totalPaid,
          currency: 'INR',
          gateway: 'CASH',
          method: 'cash',
          status: 'CAPTURED',
          paidAt: new Date(),
        },
      });
    } else {
      await prisma.payment.update({
        where: { bookingId: id },
        data: { status: 'CAPTURED', method: 'cash', gateway: 'CASH', paidAt: new Date() },
      });
    }

    paymentService.runPostPaymentJobs(id, booking.userId).catch(console.error);

    res.json({ success: true, paymentStatus: 'SUCCESS', paymentMode: 'CASH', booking: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to collect cash', details: error.message });
  }
};
export const initiateUpiCollection = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const partner = await prisma.pathologyPartner.findUnique({ where: { userId: req.user.id } });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });

    const booking = await prisma.booking.findUnique({ where: { id }, include: { user: true } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.assignedPartnerId !== partner.id) {
      return res.status(403).json({ error: 'This booking is not assigned to you.' });
    }
    if (!booking.otpVerified) {
      return res.status(400).json({ error: 'OTP must be verified before initiating UPI payment.' });
    }
    if (booking.paymentStatus === 'SUCCESS') {
      return res.status(400).json({ error: 'Payment has already been collected.' });
    }

    const amountPaise = Math.round(Number(booking.totalPaid) * 100);
    if (!amountPaise || amountPaise <= 0) {
      return res.status(400).json({ error: 'Booking has an invalid payment amount.' });
    }

    if (booking.paymentLinkUrl) {
      const existingPayment = await prisma.payment.findUnique({ where: { bookingId: id } });
      if (!existingPayment) {
        await prisma.payment.create({
          data: {
            bookingId: id,
            amount: booking.totalPaid,
            status: 'PENDING',
          },
        });
      }
      return res.json({
        upiString: booking.paymentLinkUrl,
        amount: booking.totalPaid,
        bookingCode: booking.bookingCode,
        patientName: booking.patientName,
      });
    }

    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const paymentLink = await razorpay.paymentLink.create({
      amount: amountPaise,
      currency: 'INR',
      accept_partial: false,
      description: `MedSeva Booking #${booking.bookingCode}`,
      customer: {
        name: booking.patientName,
        contact: booking.patientMobile || booking.user?.mobile || '',
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      upi_link: true,
      reference_id: booking.bookingCode,
      notes: {
        bookingId: id,
        bookingCode: booking.bookingCode,
      },
    });

    await prisma.booking.update({
      where: { id },
      data: {
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.short_url,
      },
    });

    const invoiceNumber = `INV-${Date.now()}-${booking.bookingCode}`;
    const existingPayment = await prisma.payment.findUnique({ where: { bookingId: id } });
    if (!existingPayment) {
      await prisma.payment.create({
        data: {
          bookingId: id,
          amount: booking.totalPaid,
          invoiceNumber,
          status: 'PENDING',
        },
      });
    }

    res.json({
      upiString: paymentLink.short_url,
      amount: booking.totalPaid,
      bookingCode: booking.bookingCode,
      patientName: booking.patientName,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to initiate UPI collection',
      details: error?.message ?? 'Unknown error',
    });
  }
};
export const checkUpiPaymentStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const partner = await prisma.pathologyPartner.findUnique({ where: { userId: req.user.id } });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.assignedPartnerId !== partner.id) {
      return res.status(403).json({ error: 'Not your booking.' });
    }

    if (booking.paymentStatus === 'SUCCESS') {
      return res.json({ paymentStatus: 'SUCCESS' });
    }

    res.json({ paymentStatus: 'PENDING', message: 'Waiting for patient to scan and pay.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to check UPI payment status', details: error.message });
  }
};
export const verifyUpiPayment = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.' });
    }

    const partner = await prisma.pathologyPartner.findUnique({ where: { userId: req.user.id } });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.assignedPartnerId !== partner.id) {
      return res.status(403).json({ error: 'This booking is not assigned to you.' });
    }
    if (booking.paymentStatus === 'SUCCESS') {
      return res.json({ success: true, paymentStatus: 'SUCCESS' });
    }

    const crypto = require('crypto');
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature.' });
    }

    await prisma.payment.updateMany({
      where: { bookingId: id },
      data: {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'CAPTURED',
        method: 'upi',
        paidAt: new Date(),
        webhookVerified: false,
      },
    });

    await prisma.booking.update({
      where: { id },
      data: {
        paymentStatus: 'SUCCESS',
        paymentMode: 'UPI',
        paymentId: razorpay_payment_id,
        paymentReceivedAt: new Date(),
        paymentReceivedById: req.user.id,
      },
    });

await prisma.bookingStatusLog.create({
      data: {
        bookingId: id,
        status: booking.status as any,
        note: 'UPI payment verified and received via partner app',
        updatedBy: req.user.id,
      },
    });

    paymentService.runPostPaymentJobs(id, booking.userId).catch(console.error);

    res.json({ success: true, paymentStatus: 'SUCCESS' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to verify UPI payment', details: error.message });
  }
};

export const toggleAvailability = async (req: any, res: Response) => {
  try {
    const { isAvailable } = req.body;
    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ error: 'isAvailable must be a boolean.' });
    }

    const partner = await prisma.pathologyPartner.update({
      where: { userId: req.user.id },
      data: { isAvailable },
    });

    res.json({ isAvailable: partner.isAvailable });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update availability', details: error.message });
  }
};

export const getPartnerProfile = async (req: any, res: Response) => {
  try {
    const partner = await prisma.pathologyPartner.findUnique({
      where: { userId: req.user.id },
      include: {
        user: { select: { name: true, email: true, mobile: true, avatarUrl: true } }
      }
    });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });

    res.json({
      ...partner,
      name: partner.user.name,
      email: partner.user.email,
      mobile: partner.user.mobile,
      avatarUrl: partner.user.avatarUrl,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch profile', details: error.message });
  }
};

export const getPartnerHistory = async (req: any, res: Response) => {
  try {
    const partner = await prisma.pathologyPartner.findUnique({
      where: { userId: req.user.id }
    });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });

    // Bookings this partner completed or was assigned to (any terminal status)
    const assignedBookings = await prisma.booking.findMany({
      where: {
        assignedPartnerId: partner.id,
        status: { in: ['DELIVERED_TO_LAB', 'PROCESSING', 'REPORT_READY', 'COMPLETED', 'CANCELLED'] },
      },
      include: {
        tests: { include: { test: { select: { name: true } } } },
        packages: { include: { package: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Bookings this partner explicitly rejected
    const rejections = await prisma.bookingRejection.findMany({
      where: { partnerId: partner.id },
      include: {
        booking: {
          include: {
            tests: { include: { test: { select: { name: true } } } },
            packages: { include: { package: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

const assignedFormatted = await Promise.all(assignedBookings.map(async (b) => {
      const address = await prisma.address.findUnique({ where: { id: b.addressId } });
      return {
        id: b.id,
        bookingCode: b.bookingCode,
        patientName: b.patientName,
        patientAge: b.patientAge,
        patientGender: b.patientGender,
        patientMobile: b.patientMobile,
        scheduledDate: b.scheduledDate,
        scheduledSlot: b.scheduledSlot,
        totalPaid: b.totalPaid,
        paymentStatus: b.paymentStatus,
        paymentMode: b.paymentMode,
        collectionMode: b.collectionMode,
        status: b.status,
        collectionAddress: address ? `${address.line1}, ${address.city}` : null,
        completedAt: b.deliveredToLabAt || b.sampleCollectedAt || null,
        tests: b.tests.map(t => ({ name: t.test.name })),
        packages: b.packages.map(p => ({ name: p.package.name })),
        isRejected: false,
      };
    }));
    const rejectedFormatted = await Promise.all(rejections.map(async (r) => {
      const b = r.booking;
      const address = await prisma.address.findUnique({ where: { id: b.addressId } });
return {
        id: b.id,
        bookingCode: b.bookingCode,
        patientName: b.patientName,
        patientAge: b.patientAge,
        patientGender: b.patientGender,
        patientMobile: b.patientMobile,
        scheduledDate: b.scheduledDate,
        scheduledSlot: b.scheduledSlot,
        totalPaid: b.totalPaid,
        paymentStatus: b.paymentStatus,
        paymentMode: b.paymentMode,
        collectionMode: b.collectionMode,
        status: 'REJECTED_BY_PARTNER',
        collectionAddress: address ? `${address.line1}, ${address.city}` : null,
        completedAt: null,
        rejectedAt: r.createdAt,
        rejectionReason: r.reason,
        tests: b.tests.map(t => ({ name: t.test.name })),
        packages: b.packages.map(p => ({ name: p.package.name })),
        isRejected: true,
      };
    }));

    // Merge and sort by date descending, deduplicate by booking id
    const seen = new Set<string>();
    const merged = [...assignedFormatted, ...rejectedFormatted]
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
      .filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

    res.json(merged);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch history', details: error.message });
  }
};

export const updatePartnerProfile = async (req: any, res: Response) => {
  try {
    const { name, address, city, state, pincode } = req.body;
    const updateData: any = {};
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (pincode !== undefined) updateData.pincode = pincode;

    const userUpdateData: any = {};
    if (name !== undefined) userUpdateData.name = name;

    const [partner] = await Promise.all([
      prisma.pathologyPartner.update({
        where: { userId: req.user.id },
        data: updateData,
        include: { user: { select: { name: true, email: true, mobile: true, avatarUrl: true } } },
      }),
      Object.keys(userUpdateData).length > 0
        ? prisma.user.update({ where: { id: req.user.id }, data: userUpdateData })
        : Promise.resolve(),
    ]);

    res.json({
      ...partner,
      name: partner.user.name,
      email: partner.user.email,
      mobile: partner.user.mobile,
      avatarUrl: partner.user.avatarUrl,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
};

export const getPartnerAvailability = async (req: any, res: Response) => {
  try {
    const partner = await prisma.pathologyPartner.findUnique({
      where: { userId: req.user.id },
    });
    if (!partner) return res.status(404).json({ error: 'Partner not found.' });
    res.json({
      isAvailable: partner.isAvailable,
      availability: (partner as any).availability || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch availability', details: error.message });
  }
};

export const updateAvailabilitySchedule = async (req: any, res: Response) => {
  try {
    const { isAvailable, availability } = req.body;
    const data: any = {};
    if (typeof isAvailable === 'boolean') data.isAvailable = isAvailable;
    if (availability !== undefined) data.availability = availability;

    const partner = await prisma.pathologyPartner.update({
      where: { userId: req.user.id },
      data,
    });
    res.json({ isAvailable: partner.isAvailable, availability: (partner as any).availability });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update availability', details: error.message });
  }
};

export const getPartnerBranch = async (req: any, res: Response) => {
  try {
    const partner = await prisma.pathologyPartner.findUnique({
      where: { userId: req.user.id },
    });
    if (!partner || !partner.branchId) {
      return res.json(null);
    }
    const branch = await prisma.branch.findUnique({
      where: { id: partner.branchId },
    });
    res.json(branch);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch branch', details: error.message });
  }
};

export const getPartnerRatings = async (req: any, res: Response) => {
  try {
    const partner = await prisma.pathologyPartner.findUnique({
      where: { userId: req.user.id },
    });
    if (!partner) return res.status(404).json({ error: 'Partner not found.' });

    const [totalAssigned, completedBookings, deliveredBookings, ratingRows] = await Promise.all([
      prisma.booking.count({
        where: { assignedPartnerId: partner.id },
      }),
      prisma.booking.count({
        where: {
          assignedPartnerId: partner.id,
          status: { in: ['DELIVERED_TO_LAB', 'PROCESSING', 'REPORT_READY', 'COMPLETED'] },
        },
      }),
      prisma.booking.findMany({
        where: {
          assignedPartnerId: partner.id,
          status: { in: ['DELIVERED_TO_LAB', 'PROCESSING', 'REPORT_READY', 'COMPLETED'] },
          collectionStartedAt: { not: null },
          sampleCollectedAt: { not: null },
        },
        select: { collectionStartedAt: true, sampleCollectedAt: true },
        take: 100,
      }),
      prisma.partnerRating.findMany({
        where: { partnerId: partner.id },
        include: {
          user: { select: { name: true } },
          booking: { select: { bookingCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const successRate = totalAssigned > 0
      ? Math.round((completedBookings / totalAssigned) * 100)
      : 0;

    let averageArrivalTime = 'N/A';
    if (deliveredBookings.length > 0) {
      const totalMinutes = deliveredBookings.reduce((sum, b) => {
        const diff = new Date(b.sampleCollectedAt!).getTime() - new Date(b.collectionStartedAt!).getTime();
        return sum + Math.round(diff / 60000);
      }, 0);
      const avg = Math.round(totalMinutes / deliveredBookings.length);
      averageArrivalTime = avg < 60 ? `${avg} min` : `${Math.floor(avg / 60)}h ${avg % 60}m`;
    }

    const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingRows.forEach(r => {
      breakdown[r.rating] = (breakdown[r.rating] || 0) + 1;
    });

    const aggregate = ratingRows.length > 0
      ? ratingRows.reduce((sum, r) => sum + r.rating, 0) / ratingRows.length
      : 0;

    res.json({
      overallRating: Math.round(aggregate * 10) / 10,
      totalReviews: ratingRows.length,
      totalCollections: partner.totalCollections,
      collectionSuccessRate: successRate,
      averageArrivalTime,
      breakdown,
      reviews: ratingRows.map(r => ({
        id: r.id,
        rating: r.rating,
        customerName: r.user.name,
        comment: r.review,
        bookingCode: r.booking.bookingCode,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch ratings', details: error.message });
  }
};
export const getPartnerStats = async (req: any, res: Response) => {
  try {
    const partner = await prisma.pathologyPartner.findUnique({ where: { userId: req.user.id } });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found.' });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todayBookings, pendingCount, acceptedCount, completedToday] = await Promise.all([
      prisma.booking.count({
        where: {
          assignedPartnerId: partner.id,
          partnerAssignedAt: { gte: todayStart, lte: todayEnd },
        }
      }),
      prisma.booking.count({
        where: { assignedPartnerId: partner.id, status: 'ASSIGNED' }
      }),
      prisma.booking.count({
        where: { assignedPartnerId: partner.id, status: 'ACCEPTED' }
      }),
      prisma.booking.count({
        where: {
          assignedPartnerId: partner.id,
          status: { in: ['DELIVERED_TO_LAB', 'PROCESSING', 'COMPLETED'] },
          deliveredToLabAt: { gte: todayStart, lte: todayEnd },
        }
      }),
    ]);

    res.json({
      todayJobs: todayBookings,
      pending: pendingCount,
      accepted: acceptedCount,
      completedToday,
      completedPercent: todayBookings > 0 ? Math.round((completedToday / todayBookings) * 100) : 0,
      totalCollections: partner.totalCollections,
      rating: partner.rating,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
};