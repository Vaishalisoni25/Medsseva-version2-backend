import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';
import { env } from '../config/env';
import { pricingService } from '../services/pricing.service';
import { paymentService } from '../services/payment.service';
import { sendNotificationToUser, sendNotificationToMultipleUsers } from '../services/notification.service';
import { getOrFindPartner } from './partnerController';

const generateSlotsFromSettings = (openTime: string, closeTime: string): string[] => {
  const toMinutes = (t: string): number => {
    const [hourStr, minuteStr] = t.split(':');
    return parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);
  };
  const toDisplayTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const meridiem = h < 12 ? 'AM' : 'PM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
  };
  const startMinutes = toMinutes(openTime);
  const endMinutes = toMinutes(closeTime);
  const slots: string[] = [];
  for (let t = startMinutes; t + 60 <= endMinutes; t += 60) {
    slots.push(`${toDisplayTime(t)} - ${toDisplayTime(t + 60)}`);
  }
  return slots;
};

const getAllSlots = async (): Promise<string[]> => {
  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } });
    const open = settings?.labOpenTime || '06:00';
    const close = settings?.labCloseTime || '22:00';
    return generateSlotsFromSettings(open, close);
  } catch {
    return generateSlotsFromSettings('06:00', '22:00');
  }
};

const parseSlotMinutes = (slot: string): { startMinutes: number; endMinutes: number } | null => {
  const parts = slot.split(' - ');
  if (parts.length !== 2) return null;
  const toMinutes = (timeStr: string): number => {
    const [timePart, meridiem] = timeStr.trim().split(' ');
    const [hourStr, minuteStr] = timePart.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  };
  return { startMinutes: toMinutes(parts[0]), endMinutes: toMinutes(parts[1]) };
};

function generateBookingCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(6);
  let code = 'MS';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

const mapPaymentMethodToMode = (paymentMethod: string | undefined): 'CASH' | 'UPI' | undefined => {
  const m = String(paymentMethod || '').toLowerCase();
  if (m === 'cash' || m === 'pay_at_home' || m === 'cod' || m === 'lab_walkin') return 'CASH';
  if (m === 'upi' || m === 'online') return 'UPI';
  return undefined;
};

export const getAvailableSlots = async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'date query parameter is required (format: YYYY-MM-DD)' });
    }
    const requestedDate = new Date(date);
    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const requestedMidnight = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate());
    if (requestedMidnight < todayMidnight) {
      return res.status(400).json({ error: 'Cannot fetch slots for a past date.', availableSlots: [], isToday: false });
    }
    const isToday = requestedMidnight.getTime() === todayMidnight.getTime();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const ALL_SLOTS = await getAllSlots();
    let availableSlots = ALL_SLOTS.filter(slot => {
      if (!isToday) return true;
      const parsed = parseSlotMinutes(slot);
      if (!parsed) return false;
      return parsed.startMinutes > currentMinutes;
    });
    const MAX_BOOKINGS_PER_SLOT = 5;
    const bookingsForDate = await prisma.booking.findMany({
      where: {
        scheduledDate: {
          gte: new Date(requestedMidnight),
          lt: new Date(requestedMidnight.getTime() + 24 * 60 * 60 * 1000),
        },
        status: { notIn: ['CANCELLED'] },
      },
      select: { scheduledSlot: true },
    });
    const slotBookingCount: Record<string, number> = {};
    for (const booking of bookingsForDate) {
      slotBookingCount[booking.scheduledSlot] = (slotBookingCount[booking.scheduledSlot] || 0) + 1;
    }
    availableSlots = availableSlots.filter(slot => (slotBookingCount[slot] || 0) < MAX_BOOKINGS_PER_SLOT);
    return res.json({ date, isToday, availableSlots, totalSlotsForDay: ALL_SLOTS.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
};

export const getAllBookings = async (req: any, res: Response) => {
  try {
    const { mobile, id, branchId } = req.query;
    const where: any = {};
    if (req.user.role === 'EXECUTIVE') {
      where.assignedExecutiveId = req.user.id;
      where.collectionMode = 'HOME';
    } else if (!['ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST', 'LAB_DEPARTMENT', 'FRANCHISE'].includes(req.user.role)) {
      const userConditions: any[] = [{ userId: req.user.id }];
      if (req.user.mobile) {
        userConditions.push({ user: { mobile: req.user.mobile } });
      }
      if (mobile) {
        userConditions.push({ user: { mobile: String(mobile) } });
      }
      where.OR = userConditions;
    } else {
      if (mobile) where.user = { mobile: String(mobile) };

      // Automatic Branch Isolation
      if (!req.user.isSuperAdmin && req.user.branchId) {
        where.branchId = req.user.branchId;
      } else if (branchId) {
        where.branchId = String(branchId);
      }
    }
    if (id) where.id = String(id);

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        user: true,
        tests: { include: { test: true } },
        packages: { include: { package: true } },
        report: { include: { parameters: true } },
        assignedPartner: { include: { user: { select: { name: true, mobile: true, avatarUrl: true } } } },
        assignedExecutive: { select: { id: true, name: true, mobile: true, avatarUrl: true } },
        branch: true,
        statusTimeline: { orderBy: { createdAt: 'asc' } },
     payment: {
          select: {
            id: true,
            status: true,
            invoiceUrl: true,
            receiptUrl: true,
            invoiceNumber: true,
            receiptNumber: true,
            amount: true,
            method: true,
            paidAt: true,
          },
        },
        sampleDelivery: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                city: true,
                line1: true,
                pincode: true,
              },
            },
            partner: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const bookingsWithAddress = await Promise.all(
      bookings.map(async b => {
        const address = await prisma.address.findUnique({ where: { id: b.addressId } });
        return { ...b, address };
      })
    );

    res.json(bookingsWithAddress);
  } catch (error: any) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
};

export const createBooking = async (req: any, res: Response) => {
  try {
    const {
      testIds = [],
      packageIds = [],
      scheduledDate,
      scheduledSlot,
      patientName,
      patientAge,
      patientGender,
      mobile,
      addressId,
      branchId,
      collectionMode,
      paymentMethod,
      couponCode,
    } = req.body;

const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(401).json({ error: 'Authenticated user not found.' });

    if (testIds.length === 0 && packageIds.length === 0) {
      return res.status(400).json({ error: 'At least one test or package is required to create a booking.' });
    }

    const safeCollectionMode = String(collectionMode || '').toLowerCase() === 'lab' ? 'LAB' : 'HOME';

    const pricing = await pricingService.calculate({
      testIds,
      packageIds,
      collectionMode: safeCollectionMode,
      couponCode,
      userId: user.id,
    });

    let finalAddressId = addressId;
    let finalBranchId: string | undefined;

    if (safeCollectionMode === 'LAB') {
      const targetBranchId = branchId || (req as any).user?.branchId;
      let branch = targetBranchId
        ? await prisma.branch.findUnique({ where: { id: targetBranchId } })
        : await prisma.branch.findFirst({ where: { isActive: true } });

      if (!branch) {
        branch = await prisma.branch.findFirst();
      }

      if (!branch) return res.status(400).json({ error: 'No diagnostic branch found in the system.' });
      finalBranchId = branch.id;
      const centerAddr =
        (await prisma.address.findFirst({ where: { userId: user.id, type: 'CENTER', line1: branch.line1 } })) ||
        (await prisma.address.create({
          data: { userId: user.id, type: 'CENTER', line1: branch.line1, city: branch.city, state: branch.state, pincode: branch.pincode },
        }));
      finalAddressId = centerAddr.id;
    } else if (!finalAddressId) {
      const defaultAddr = await prisma.address.findFirst({ where: { userId: user.id }, orderBy: { isDefault: 'desc' } });
      if (!defaultAddr) return res.status(400).json({ error: 'No address found. Please add an address before booking.' });
      finalAddressId = defaultAddr.id;
    }

    const parsedDate = scheduledDate ? new Date(scheduledDate) : new Date(Date.now() + 86400000);
    if (isNaN(parsedDate.getTime())) return res.status(400).json({ error: 'Invalid booking date.' });

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const bookingMidnight = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());

    if (bookingMidnight < todayMidnight) return res.status(400).json({ error: 'Booking date cannot be in the past.' });

    if (bookingMidnight.getTime() === todayMidnight.getTime() && scheduledSlot) {
      const slotEndPart = scheduledSlot.split(' - ')[1];
      if (slotEndPart) {
        const [timePart, meridiem] = slotEndPart.trim().split(' ');
        const [hourStr, minuteStr] = timePart.split(':');
        let hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);
        if (meridiem === 'PM' && hour !== 12) hour += 12;
        if (meridiem === 'AM' && hour === 12) hour = 0;
        const slotEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
        if (slotEnd <= now) return res.status(400).json({ error: 'This time slot has already passed.' });
      }
    }

    let bookingCode = generateBookingCode();
    while (await prisma.booking.findUnique({ where: { bookingCode } })) {
      bookingCode = generateBookingCode();
    }

    const resolvedPaymentMode = mapPaymentMethodToMode(paymentMethod);

    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          bookingCode,
          userId: user.id,
          scheduledDate: parsedDate,
          scheduledSlot: scheduledSlot || 'Anytime',
          totalPaid: pricing.finalAmount,
          patientName: patientName || user.name || 'Guest',
          patientAge: patientAge ? Number(patientAge) : null,
          patientGender: patientGender || null,
          patientMobile: mobile || user.mobile || null,
          status: safeCollectionMode === 'HOME' ? 'WAITING_FOR_PARTNER' : 'WAITING_FOR_ASSIGNMENT',
          paymentStatus: 'PENDING',
          collectionMode: safeCollectionMode as any,
          addressId: finalAddressId,
          branchId: finalBranchId,
          paymentMode: resolvedPaymentMode as any,
          tests: { create: testIds.map((id: string) => ({ testId: id })) },
          packages: { create: packageIds.map((id: string) => ({ packageId: id })) },
        },
        include: { tests: true, user: true },
      });

      await tx.pricingSnapshot.create({
        data: {
          bookingId: newBooking.id,
          testIds,
          packageIds,
          subtotal: pricing.subtotal,
          testDiscount: pricing.testDiscount,
          couponCode: pricing.couponCode,
          couponId: pricing.couponId,
          couponDiscount: pricing.couponDiscount,
          collectionCharge: pricing.collectionCharge,
          gst: pricing.gst,
          platformFee: pricing.platformFee,
          finalAmount: pricing.finalAmount,
          collectionMode: safeCollectionMode,
        },
      });

      if (pricing.couponId && pricing.couponId !== 'REFERRAL_FREE_TEST') {
        await tx.coupon.update({ where: { id: pricing.couponId }, data: { usedCount: { increment: 1 } } });
        await tx.couponRedemption.create({
          data: { couponId: pricing.couponId, userId: user.id, bookingId: newBooking.id, discount: pricing.couponDiscount },
        });
      }

      if (pricing.couponId === 'REFERRAL_FREE_TEST' || (user.isFirstTestFreeEligible && !user.firstTestFreeUsed)) {
        await tx.user.update({
          where: { id: user.id },
          data: { firstTestFreeUsed: true },
        });
      }

      return newBooking;
    });

    sendNotificationToUser(user.id, 'Booking Created', 'Your booking has been created successfully.', 'BOOKING_CREATED', { bookingId: booking.id }).catch(console.error);

    if (safeCollectionMode === 'HOME') {
      const availablePartners = await prisma.pathologyPartner.findMany({
        where: { approvalStatus: 'APPROVED', isAvailable: true },
        include: { user: { select: { id: true } } },
      });
      if (availablePartners.length > 0) {
        sendNotificationToMultipleUsers(
          availablePartners.map(p => p.user.id),
          'New Booking Assigned',
          `${booking.user?.name || 'A patient'} has placed a new booking.`,
          'NEW_BOOKING_ASSIGNED',
          { bookingId: booking.id }
        ).catch(console.error);
      }
    }

    res.status(201).json(booking);
  } catch (error: any) {
    console.error('Error creating booking:', error.message);
    res.status(500).json({ error: 'Failed to create booking.' });
  }
};
export const verifyAndCreateBooking = async (req: any, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.' });
    }

    const existingPayment = await prisma.payment.findFirst({
      where: { razorpayOrderId: razorpay_order_id },
      include: { booking: true },
    });

    if (existingPayment?.booking) {
      return res.status(200).json(existingPayment.booking);
    }

    const intent = await prisma.bookingIntent.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!intent) {
      return res.status(404).json({ error: 'No booking intent found for this payment. Contact support.' });
    }

    if (intent.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    if (intent.status === 'COMPLETED' && intent.bookingId) {
      const existingBooking = await prisma.booking.findUnique({ where: { id: intent.bookingId } });
      if (existingBooking) return res.status(200).json(existingBooking);
    }

    if (new Date() > intent.expiresAt) {
      return res.status(410).json({ error: 'Booking intent has expired. Please start a new booking.' });
    }

    const isValid = paymentService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature.' });
    }

    const bookingId = await paymentService.fulfillFromIntent(intent, razorpay_payment_id, razorpay_signature, false);

    paymentService.runPostPaymentJobs(bookingId, req.user.id).catch(console.error);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    return res.status(201).json(booking);
  } catch (error: any) {
    console.error('Error in verifyAndCreateBooking:', error.message);
    res.status(500).json({ error: 'Failed to verify payment and create booking.' });
  }
};

export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const upperStatus = status?.toUpperCase();
    const booking = await prisma.booking.update({ where: { id }, data: { status: upperStatus } });
    res.json(booking);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update status' });
  }
};

export const updatePaymentStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentMode } = req.body;
    if (!paymentStatus) return res.status(400).json({ error: 'paymentStatus is required.' });

    const upperStatus = paymentStatus.toUpperCase();
    const validStatuses = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];
    if (!validStatuses.includes(upperStatus)) {
      return res.status(400).json({ error: `Invalid paymentStatus. Must be one of: ${validStatuses.join(', ')}` });
    }

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.paymentStatus === 'SUCCESS') {
      return res.status(400).json({ error: 'Payment has already been marked as received.' });
    }

    const actorRole = req.user.role;
    const actorId = req.user.id;
    const isAdminLevel = ['ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'].includes(actorRole);

    if (booking.collectionMode === 'LAB') {
      if (!isAdminLevel) return res.status(403).json({ error: 'Only Pathology Admin can mark payment received for Lab Visit bookings.' });
    } else if (booking.collectionMode === 'HOME') {
      const isAssignedExecutive = actorRole === 'EXECUTIVE' && booking.assignedExecutiveId === actorId;
      if (!isAssignedExecutive && !isAdminLevel) {
        return res.status(403).json({ error: 'Only the assigned Executive or Admin can mark payment for Home Collection bookings.' });
      }
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        paymentStatus: upperStatus as any,
        paymentMode: paymentMode ? paymentMode.toUpperCase() as any : undefined,
        paymentReceivedAt: upperStatus === 'SUCCESS' ? new Date() : undefined,
        paymentReceivedById: upperStatus === 'SUCCESS' ? actorId : undefined,
      },
    });

if (upperStatus === 'SUCCESS') {
      await prisma.bookingStatusLog.create({
        data: {
          bookingId: id,
          status: booking.status as any,
          note: booking.collectionMode === 'LAB' ? 'Payment received at lab counter' : 'Payment received for home collection',
          updatedBy: actorId,
        },
      });

      const resolvedPaymentMode = (updated.paymentMode || 'CASH') as string;

      if (resolvedPaymentMode === 'CASH') {
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
      } else {
        sendNotificationToUser(booking.userId, 'Payment Received', 'Payment received successfully.', 'PAYMENT_SUCCESS', { bookingId: id }).catch(console.error);
      }
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update payment status' });
  }
};

export const collectSample = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    const actorRole = req.user.role;
    const actorId = req.user.id;
    const isAdminLevel = ['ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'].includes(actorRole);

    if (booking.collectionMode === 'HOME') {
      const isAssignedExecutive = actorRole === 'EXECUTIVE' && booking.assignedExecutiveId === actorId;
      if (!isAssignedExecutive && !isAdminLevel) return res.status(403).json({ error: 'Only the assigned Executive or Admin can mark sample collected.' });
    } else if (!isAdminLevel) {
      return res.status(403).json({ error: 'Only Admin/Pathologist can mark sample collected for Lab Visit bookings.' });
    }

    if (booking.paymentStatus !== 'SUCCESS') {
      return res.status(400).json({ error: 'Payment must be received before sample collection.' });
    }

    const updated = await prisma.booking.update({ where: { id }, data: { status: 'SAMPLE_COLLECTED' } });
    sendNotificationToUser(booking.userId, 'Sample Collected', 'Your sample has been collected.', 'SAMPLE_COLLECTED', { bookingId: id }).catch(console.error);
    await prisma.bookingStatusLog.create({ data: { bookingId: id, status: 'SAMPLE_COLLECTED', note: 'Sample collected', updatedBy: actorId } });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to mark sample collected' });
  }
};

export const assignPartner = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { partnerId } = req.body;
    if (!partnerId) return res.status(400).json({ error: 'partnerId is required.' });
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Only Admin can assign partners.' });

    const partner = await prisma.pathologyPartner.findUnique({ where: { id: partnerId }, include: { user: true } });
    if (!partner) return res.status(404).json({ error: 'Partner not found.' });
    if (partner.approvalStatus !== 'APPROVED') return res.status(400).json({ error: 'Partner is not approved.' });
    if (!partner.isAvailable) return res.status(400).json({ error: 'Partner is not available.' });

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.collectionMode !== 'HOME') return res.status(400).json({ error: 'Partners can only be assigned to Home Collection bookings.' });

    const updated = await prisma.booking.update({
      where: { id },
      data: { assignedPartnerId: partnerId, partnerAssignedAt: new Date(), status: 'ASSIGNED' },
    });

    await prisma.bookingStatusLog.create({ data: { bookingId: id, status: 'ASSIGNED', note: `Partner ${partner.user.name} assigned`, updatedBy: req.user.id } });
    sendNotificationToUser(booking.userId, 'Partner Assigned', 'A partner has been assigned to your booking.', 'BOOKING_ACCEPTED', { bookingId: id }).catch(console.error);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to assign partner' });
  }
};

export const assignExecutive = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { executiveId } = req.body;
    if (!executiveId) return res.status(400).json({ error: 'executiveId is required.' });
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Only Admin can assign executives.' });

    const executive = await prisma.user.findUnique({ where: { id: executiveId } });
    if (!executive || executive.role !== 'EXECUTIVE') return res.status(400).json({ error: 'Provided user is not a valid Executive.' });

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.collectionMode !== 'HOME') return res.status(400).json({ error: 'Executives can only be assigned to Home Collection bookings.' });

    const updated = await prisma.booking.update({ where: { id }, data: { assignedExecutiveId: executiveId } });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to assign executive' });
  }
};

export const generateCollectionOtp = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    let partner = await getOrFindPartner(req.user.id, req.user.role);
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    const isAssigned = (partner && booking.assignedPartnerId === partner.id) ||
      booking.assignedExecutiveId === req.user.id ||
      booking.userId === req.user.id ||
      ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
    if (!isAssigned) return res.status(403).json({ error: 'Not your booking.' });

    if (booking.collectionOtp) return res.json({ otpRequired: true, otp: booking.collectionOtp });

    const otpBytes = crypto.randomBytes(4);
    const otp = (1000 + (otpBytes.readUInt32BE(0) % 9000)).toString();
    await prisma.booking.update({ where: { id }, data: { collectionOtp: otp } });
    res.json({ otpRequired: true, otp });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate OTP' });
  }
};

export const verifyCollectionOtp = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;
    let partner = await getOrFindPartner(req.user.id, req.user.role);
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    const isAssigned = (partner && booking.assignedPartnerId === partner.id) ||
      booking.assignedExecutiveId === req.user.id ||
      ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role) ||
      ['ACCEPTED', 'ON_THE_WAY', 'REACHED_LOCATION'].includes(booking.status);
    if (!isAssigned) return res.status(403).json({ error: 'Not your booking.' });

    if (booking.otpVerified) return res.json({ verified: true, paymentStatus: booking.paymentStatus });
    if (booking.collectionOtp && booking.collectionOtp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP. Please check the 4-digit code provided by patient.' });
    }
    await prisma.booking.update({ where: { id }, data: { otpVerified: true } });
    res.json({ verified: true, paymentStatus: booking.paymentStatus });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

export const acceptLabBooking = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (!['ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'].includes(req.user.role)) return res.status(403).json({ error: 'Only Lab Admin can accept bookings.' });
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.collectionMode !== 'LAB') return res.status(400).json({ error: 'Only valid for Lab Visit bookings.' });
    if (booking.status !== 'WAITING_FOR_ASSIGNMENT' && booking.status !== 'PENDING') return res.status(400).json({ error: 'Booking already reviewed.' });

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'CONFIRMED', labReviewedAt: new Date(), labReviewedById: req.user.id },
    });
    await prisma.bookingStatusLog.create({ data: { bookingId: id, status: 'CONFIRMED', note: 'Lab Visit booking accepted', updatedBy: req.user.id } });
    sendNotificationToUser(booking.userId, 'Booking Accepted', 'Your lab visit booking has been accepted.', 'BOOKING_ACCEPTED', { bookingId: id }).catch(console.error);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to accept booking' });
  }
};

export const rejectLabBooking = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!['ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'].includes(req.user.role)) return res.status(403).json({ error: 'Only Lab Admin can reject bookings.' });
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.collectionMode !== 'LAB') return res.status(400).json({ error: 'Only valid for Lab Visit bookings.' });
    if (booking.status !== 'WAITING_FOR_ASSIGNMENT' && booking.status !== 'PENDING') return res.status(400).json({ error: 'Booking already reviewed.' });

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: reason || 'Not specified', labReviewedAt: new Date(), labReviewedById: req.user.id },
    });
    await prisma.bookingStatusLog.create({ data: { bookingId: id, status: 'REJECTED', note: reason || 'Rejected by Lab Admin', updatedBy: req.user.id } });
    sendNotificationToUser(booking.userId, 'Booking Rejected', reason || 'Your lab visit booking was rejected.', 'BOOKING_REJECTED', { bookingId: id }).catch(console.error);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reject booking' });
  }
};

export const patientReachedLab = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.collectionMode !== 'LAB') return res.status(400).json({ error: 'Only valid for Lab Visit bookings.' });
    if (booking.status !== 'CONFIRMED') return res.status(400).json({ error: 'Booking must be CONFIRMED before patient can mark arrival.' });
    if (booking.userId !== req.user.id && !['ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only the booking owner or lab staff can mark arrival.' });
    }

    const updated = await prisma.booking.update({ where: { id }, data: { status: 'PATIENT_REACHED_LAB' } });
    await prisma.bookingStatusLog.create({ data: { bookingId: id, status: 'PATIENT_REACHED_LAB', note: 'Patient marked arrival at the lab', updatedBy: req.user.id } });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update status' });
  }
};

const LAB_STATUS_TRANSITIONS: Record<string, { next: string; label: string }> = {
  PATIENT_REACHED_LAB: { next: 'SAMPLE_COLLECTED', label: 'Sample Collected' },
  SAMPLE_COLLECTED: { next: 'PROCESSING', label: 'Processing Started' },
  PROCESSING: { next: 'REPORT_READY', label: 'Report Ready' },
  REPORT_READY: { next: 'COMPLETED', label: 'Completed' },
};

export const sendBookingInvoice = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (!['ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only Admin can send invoices.' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.paymentStatus !== 'SUCCESS') {
      return res.status(400).json({ error: 'Cannot send invoice for unpaid booking.' });
    }

    if (!booking.payment?.invoiceUrl) {
      await paymentService.runPostPaymentJobs(id, booking.userId);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const updatedBooking = await prisma.booking.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!updatedBooking?.payment?.invoiceUrl) {
      return res.status(500).json({ error: 'Invoice generation failed. Please try again.' });
    }

    await sendNotificationToUser(
      booking.userId,
      'Payment Successful',
      'Your invoice is ready. Tap to view or download.',
      'PAYMENT_SUCCESS',
      { bookingId: id }
    );

    res.json({
      success: true,
      invoiceUrl: updatedBooking.payment.invoiceUrl,
      invoiceNumber: updatedBooking.payment.invoiceNumber,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send invoice.' });
  }
};

export const updateLabStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'].includes(req.user.role)) return res.status(403).json({ error: 'Only Lab Admin can update lab booking status.' });

    const allowedStatuses = Object.values(LAB_STATUS_TRANSITIONS).map(t => t.next);
    const upperStatus = status?.toUpperCase();
    if (!allowedStatuses.includes(upperStatus)) return res.status(400).json({ error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });

 const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.collectionMode !== 'LAB') return res.status(400).json({ error: 'Only valid for Lab Visit bookings.' });
    if (upperStatus === 'SAMPLE_COLLECTED' && booking.paymentStatus !== 'SUCCESS') return res.status(400).json({ error: 'Payment must be completed before sample can be collected.' });

    if (upperStatus === 'REPORT_READY') {
      const report = await prisma.report.findUnique({ where: { bookingId: id } });
      if (!report) {
        return res.status(400).json({ error: 'Report is not ready yet. Please complete and approve the diagnostic report from the Report Approval module before marking this booking as Report Ready.' });
      }
      if (report.status !== 'APPROVED' && report.status !== 'RELEASED') {
        return res.status(400).json({ error: 'Report is not ready yet. Please complete and approve the diagnostic report from the Report Approval module before marking this booking as Report Ready.' });
      }
    }

    const transition = LAB_STATUS_TRANSITIONS[booking.status];
    if (!transition || transition.next !== upperStatus) return res.status(400).json({ error: `Cannot move from ${booking.status} to ${upperStatus}.` });

    const updated = await prisma.booking.update({ where: { id }, data: { status: upperStatus as any } });
    await prisma.bookingStatusLog.create({ data: { bookingId: id, status: upperStatus as any, note: `${transition.label} - updated by Lab Admin`, updatedBy: req.user.id } });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update lab status' });
  }
};

export const createWalkinBooking = async (req: any, res: Response) => {
  try {
    const {
      patientName,
      mobile,
      address,
      gender,
      age,
      reference,
      testIds = [],
      packageIds = [],
      branchId,
    } = req.body;

    if (!patientName || !patientName.trim()) {
      return res.status(400).json({ error: 'Patient Full Name is required.' });
    }
    if (!mobile || !mobile.trim()) {
      return res.status(400).json({ error: 'Mobile Number is required.' });
    }
    const cleanMobile = mobile.trim().replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }
    if (!address || !address.trim()) {
      return res.status(400).json({ error: 'Address is required.' });
    }
    if (!gender || !gender.trim()) {
      return res.status(400).json({ error: 'Gender is required.' });
    }
    if (age === undefined || age === null || age === '' || isNaN(Number(age)) || Number(age) <= 0) {
      return res.status(400).json({ error: 'Valid Age is required.' });
    }

    // Resolve branch
    let targetBranchId = branchId || (!req.user?.isSuperAdmin ? req.user?.branchId : null);
    let branch = targetBranchId
      ? await prisma.branch.findUnique({ where: { id: targetBranchId } })
      : await prisma.branch.findFirst({ where: { isActive: true } });

    if (!branch) {
      branch = await prisma.branch.findFirst();
    }
    targetBranchId = branch?.id || null;

    // Find or create User
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { mobile: cleanMobile },
          { mobile: `+91${cleanMobile}` },
          { mobile: cleanMobile.slice(-10) },
        ],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: patientName.trim(),
          mobile: cleanMobile.slice(-10),
          gender: gender.trim(),
          role: 'USER',
        },
      });
    }

    // Find or create Address
    let userAddress = await prisma.address.findFirst({
      where: {
        userId: user.id,
        line1: address.trim(),
      },
    });

    if (!userAddress) {
      userAddress = await prisma.address.create({
        data: {
          userId: user.id,
          line1: address.trim(),
          city: branch?.city || '',
          state: branch?.state || '',
          pincode: branch?.pincode || '',
          type: 'HOME',
          isDefault: true,
        },
      });
    }

    // Unique Booking Code
    let bookingCode = generateBookingCode();
    while (await prisma.booking.findUnique({ where: { bookingCode } })) {
      bookingCode = generateBookingCode();
    }

    // Calculate total price if tests/packages provided
    let totalAmount = 0;
    if (testIds.length > 0) {
      const tests = await prisma.test.findMany({ where: { id: { in: testIds } } });
      totalAmount += tests.reduce((sum, t) => sum + (t.discountedPrice || t.price || 0), 0);
    }
    if (packageIds.length > 0) {
      const pkgs = await prisma.healthPackage.findMany({ where: { id: { in: packageIds } } });
      totalAmount += pkgs.reduce((sum, p) => sum + (p.price || 0), 0);
    }

    const booking = await prisma.booking.create({
      data: {
        bookingCode,
        userId: user.id,
        scheduledDate: new Date(),
        scheduledSlot: 'Walk-in / Immediate',
        totalPaid: totalAmount,
        patientName: patientName.trim(),
        patientAge: Number(age),
        patientGender: gender.trim(),
        patientMobile: cleanMobile.slice(-10),
        status: 'PROCESSING',
        paymentStatus: 'SUCCESS',
        paymentMode: 'CASH',
        collectionMode: 'LAB',
        addressId: userAddress.id,
        branchId: targetBranchId,
        partnerNote: reference ? `Ref: ${reference.trim()}` : 'Walk-in Patient',
        tests: testIds.length > 0 ? {
          create: testIds.map((tid: string) => ({ testId: tid }))
        } : undefined,
        packages: packageIds.length > 0 ? {
          create: packageIds.map((pid: string) => ({ packageId: pid }))
        } : undefined,
      },
      include: {
        user: { select: { id: true, name: true, mobile: true, email: true } },
        tests: { include: { test: { include: { parameters: true } } } },
        packages: {
          include: {
            package: {
              include: {
                testsIncluded: { include: { test: { include: { parameters: true } } } },
              },
            },
          },
        },
        report: true,
        branch: true,
      },
    });

    const bookingWithAddress = {
      ...booking,
      address: userAddress,
    };

    res.status(201).json(bookingWithAddress);
  } catch (error: any) {
    console.error('Error creating walk-in booking:', error);
    res.status(500).json({ error: 'Failed to create walk-in patient booking', details: error.message });
  }
};