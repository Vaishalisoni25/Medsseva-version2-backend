import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { io } from '../server';
import { createAuditLog } from '../services/audit.service';



const generateAccessionNumber = async (branchId?: string): Promise<string> => {
  const branch = branchId
    ? await prisma.branch.findUnique({ where: { id: branchId }, select: { code: true } })
    : null;
  const prefix = branch ? branch.code.toUpperCase().slice(0, 4) : 'ACC';
  const date = new Date();
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

  let accessionNumber: string;
  let exists = true;
  do {
    const random = Math.floor(1000 + Math.random() * 9000);
    accessionNumber = `${prefix}-${datePart}-${random}`;
    const found = await prisma.sample.findUnique({ where: { accessionNumber } });
    exists = !!found;
  } while (exists);

  return accessionNumber;
};

export const getLimsQueue = async (req: any, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        status: {
          in: ['SAMPLE_COLLECTED', 'DELIVERED_TO_LAB', 'PROCESSING', 'REPORT_READY'],
        },
      },
      include: {
        user: { select: { id: true, name: true, mobile: true } },
        tests: { include: { test: { select: { id: true, name: true } } } },
        packages: { include: { package: { select: { id: true, name: true } } } },
        branch: { select: { id: true, name: true, code: true } },
        sample: true,
        statusTimeline: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { sampleCollectedAt: 'asc' },
    });

    res.json(bookings);
  } catch (error: any) {
    console.error('getLimsQueue error:', error);
    res.status(500).json({ error: 'Failed to fetch LIMS queue', details: error.message });
  }
};

export const receiveSample = async (req: any, res: Response) => {
  try {
    const { bookingId, sampleType, condition, notes, rejectionReason } = req.body;

    if (!bookingId || !sampleType || !condition) {
      return res.status(400).json({ error: 'bookingId, sampleType, and condition are required.' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { sample: true },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.sample) return res.status(400).json({ error: 'Sample already received for this booking.' });

    const isRejected = condition !== 'GOOD';

    if (isRejected && !rejectionReason?.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required for damaged samples.' });
    }

    const accessionNumber = await generateAccessionNumber(booking.branchId || undefined);

    const sample = await prisma.sample.create({
      data: {
        bookingId,
        accessionNumber,
        sampleType,
        condition: condition as any,
        receivedAt: new Date(),
        receivedById: req.user.id,
        rejectionReason: isRejected ? rejectionReason : null,
        notes: notes || null,
        status: isRejected ? 'REJECTED' : 'ACCESSIONED',
        branchId: booking.branchId || null,
      },
    });

    const newBookingStatus = isRejected ? 'PROCESSING' : 'DELIVERED_TO_LAB';

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: newBookingStatus },
    });

    await prisma.bookingStatusLog.create({
      data: {
        bookingId,
        status: newBookingStatus,
        note: isRejected
          ? `Sample rejected: ${rejectionReason}`
          : `Sample accessioned. Accession#: ${accessionNumber}. Condition: ${condition}`,
        updatedBy: req.user.id,
      },
    });

await createAuditLog({
      userId: req.user.id,
      action: isRejected ? 'SAMPLE_REJECTED' : 'SAMPLE_ACCESSIONED',
      module: 'lims',
      entityType: 'Sample',
      entityId: sample.id,
      performedByRole: req.user.role,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'] as string,
      severity: isRejected ? 'HIGH' : 'LOW',
      metadata: { bookingId, accessionNumber, condition, sampleType, rejectionReason: isRejected ? rejectionReason : null },
    });
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { id: true, name: true, mobile: true } },
        tests: { include: { test: { select: { id: true, name: true } } } },
        packages: { include: { package: { select: { id: true, name: true } } } },
        branch: { select: { id: true, name: true, code: true } },
        sample: true,
        statusTimeline: { orderBy: { createdAt: 'asc' } },
      },
    });

    io.to('lims:room').emit('lims:update', { type: 'SAMPLE_RECEIVED', booking: updatedBooking });

    res.status(201).json({ sample, booking: updatedBooking });
  } catch (error: any) {
    console.error('receiveSample error:', error);
    res.status(500).json({ error: 'Failed to receive sample', details: error.message });
  }
};

export const startProcessing = async (req: any, res: Response) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { sample: true },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (!booking.sample) return res.status(400).json({ error: 'Sample has not been received yet.' });
    if (booking.sample.status === 'REJECTED') {
      return res.status(400).json({ error: 'Cannot process a rejected sample.' });
    }

    await prisma.sample.update({
      where: { id: booking.sample.id },
      data: { status: 'PROCESSING', processingStartedAt: new Date() },
    });

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'PROCESSING' },
    });

    await prisma.bookingStatusLog.create({
      data: {
        bookingId,
        status: 'PROCESSING',
        note: `Sample moved to analyzer. Accession#: ${booking.sample.accessionNumber}`,
        updatedBy: req.user.id,
      },
    });

await createAuditLog({
      userId: req.user.id,
      action: 'SAMPLE_PROCESSING_STARTED',
      module: 'lims',
      entityType: 'Sample',
      entityId: booking.sample.id,
      performedByRole: req.user.role,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'] as string,
      severity: 'LOW',
      metadata: { bookingId, accessionNumber: booking.sample.accessionNumber },
    });
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { id: true, name: true, mobile: true } },
        tests: { include: { test: { select: { id: true, name: true } } } },
        packages: { include: { package: { select: { id: true, name: true } } } },
        branch: { select: { id: true, name: true, code: true } },
        sample: true,
        statusTimeline: { orderBy: { createdAt: 'asc' } },
      },
    });

    io.to('lims:room').emit('lims:update', { type: 'PROCESSING_STARTED', booking: updatedBooking });

    res.json(updatedBooking);
  } catch (error: any) {
    console.error('startProcessing error:', error);
    res.status(500).json({ error: 'Failed to start processing', details: error.message });
  }
};