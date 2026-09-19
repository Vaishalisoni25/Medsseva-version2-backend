import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

function getPeriodStartDate(period: string): Date | null {
  const now = new Date();
  switch (period?.toUpperCase()) {
    case 'WEEKLY':
    case '7_DAYS':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'FORTNIGHTLY':
    case '15_DAYS':
      return new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    case 'MONTHLY':
    case '30_DAYS':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

export const getDoctorPortalData = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const doctorIdQuery = req.query.doctorId as string;
    const period = (req.query.period as string) || 'ALL';

    let doctor = null;
    if (doctorIdQuery) {
      doctor = await (prisma as any).doctor.findUnique({
        where: { id: doctorIdQuery },
        include: { branch: true },
      });
    } else if (userId) {
      doctor = await (prisma as any).doctor.findFirst({
        where: {
          OR: [{ userId }, { id: userId }],
        },
        include: { branch: true, user: { select: { avatarUrl: true } } },
      });
    }

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const commissionRate = doctor.commissionRate ?? 30.0;
    const paymentCycle = doctor.paymentCycle || 'MONTHLY';
    const periodStartDate = getPeriodStartDate(period);

    const orConditions: any[] = [
      { referringDoctorId: doctor.id },
    ];
    if (doctor.userId) {
      orConditions.push({ userId: doctor.userId });
    }
    if (doctor.branchId) {
      orConditions.push({ branchId: doctor.branchId });
    }

    const bookingWhere: any = {
      OR: orConditions,
      status: { notIn: ['CANCELLED'] },
    };

    if (periodStartDate) {
      bookingWhere.createdAt = { gte: periodStartDate };
    }

    const bookings = await prisma.booking.findMany({
      where: bookingWhere,
      include: {
        tests: { include: { test: true } },
        packages: { include: { package: true } },
        report: { select: { id: true, status: true, pdfUrl: true, reportedDate: true } },
        branch: { select: { id: true, name: true, city: true } },
        user: { select: { name: true, mobile: true, uhid: true } },
        statusTimeline: { orderBy: { createdAt: 'asc' } },
        assignedPartner: { select: { labName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const commissionsList = await (prisma as any).referralCommission.findMany({
      where: {
        doctorId: doctor.id,
        ...(periodStartDate ? { createdAt: { gte: periodStartDate } } : {}),
      },
    });

    const commissionMap = new Map<string, any>();
    commissionsList.forEach((c: any) => commissionMap.set(c.bookingId, c));

    let totalBilled = 0;
    let totalCommission = 0;
    let paidCommission = 0;
    let unpaidCommission = 0;
    let totalTestsCount = 0;

    const referrals = bookings.map((b) => {
      const bookedAmount = b.totalPaid || 0;
      totalBilled += bookedAmount;

      const testItems: { name: string; price: number; commission: number }[] = [];

      if (b.tests && b.tests.length > 0) {
        b.tests.forEach((t: any) => {
          const price = t.test?.price || bookedAmount / Math.max(1, b.tests.length);
          const comm = (price * commissionRate) / 100;
          testItems.push({
            name: t.test?.name || 'Diagnostic Test',
            price,
            commission: comm,
          });
          totalTestsCount++;
        });
      }
      if (b.packages && b.packages.length > 0) {
        b.packages.forEach((p: any) => {
          const price = p.package?.price || bookedAmount;
          const comm = (price * commissionRate) / 100;
          testItems.push({
            name: p.package?.name || 'Health Package',
            price,
            commission: comm,
          });
          totalTestsCount++;
        });
      }

      if (testItems.length === 0) {
        const comm = (bookedAmount * commissionRate) / 100;
        testItems.push({
          name: 'Pathology Investigation',
          price: bookedAmount,
          commission: comm,
        });
        totalTestsCount++;
      }

      const bookingCommission = (bookedAmount * commissionRate) / 100;
      totalCommission += bookingCommission;

      const existingComm = commissionMap.get(b.id);
      const isPaid = existingComm?.status === 'PAID';

      if (isPaid) {
        paidCommission += bookingCommission;
      } else {
        unpaidCommission += bookingCommission;
      }

      return {
        bookingId: b.id,
        bookingCode: b.bookingCode,
        patientName: b.patientName || b.user?.name || 'Patient',
        patientAge: b.patientAge,
        patientGender: b.patientGender,
        patientMobile: b.patientMobile || b.user?.mobile,
        scheduledDate: b.scheduledDate,
        bookingStatus: b.status,
        totalPaid: bookedAmount,
        commissionRate,
        commissionAmount: bookingCommission,
        paymentCycle,
        payoutStatus: isPaid ? 'PAID' : 'UNPAID',
        paidAt: existingComm?.paidAt || null,
        tests: testItems,
        report: b.report
          ? {
              id: b.report.id,
              status: b.report.status,
              pdfUrl: b.report.pdfUrl,
              reportedDate: b.report.reportedDate,
              verificationUrl: `/verify-report/${b.report.id}`,
            }
          : null,
        branch: b.branch,
        createdAt: b.createdAt,
        collectionMode: b.collectionMode,
        collectionOtp: b.collectionOtp,
        statusTimeline: (b as any).statusTimeline,
        assignedPartner: (b as any).assignedPartner,
      };
    });

    res.json({
      doctor: {
        id: doctor.id,
        name: doctor.name,
        code: doctor.code || `DOC-${doctor.id.slice(0, 5).toUpperCase()}`,
        qualification: doctor.qualification,
        registrationNo: doctor.registrationNo,
        specialization: doctor.specialization,
        designation: doctor.designation,
        commissionRate,
        paymentCycle,
        branch: doctor.branch,
        avatarUrl: doctor.user?.avatarUrl || null,
      },
      period,
      summary: {
        totalReferredSamples: bookings.length,
        totalTestsCount,
        totalBilledAmount: Math.round(totalBilled),
        commissionRate,
        totalCommissionEarned: Math.round(totalCommission),
        paidCommission: Math.round(paidCommission),
        unpaidCommission: Math.round(unpaidCommission),
        paymentCycle,
      },
      referrals,
    });
  } catch (error: any) {
    console.error('Error fetching doctor portal data:', error);
    res.status(500).json({ error: 'Failed to fetch doctor portal data', details: error.message });
  }
};

export const getPartnerPortalData = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const partnerIdQuery = req.query.partnerId as string;
    const period = (req.query.period as string) || 'ALL';

    let partner = null;
    if (partnerIdQuery) {
      partner = await (prisma as any).pathologyPartner.findUnique({
        where: { id: partnerIdQuery },
      });
    } else if (userId) {
      partner = await (prisma as any).pathologyPartner.findFirst({
        where: {
          OR: [{ userId }, { id: userId }],
        },
      });
    }

    if (!partner) {
      return res.status(404).json({ error: 'Partner profile not found' });
    }

    const commissionRate = partner.commissionRate ?? 30.0;
    const paymentCycle = partner.paymentCycle || 'MONTHLY';
    const periodStartDate = getPeriodStartDate(period);

    const bookingWhere: any = {
      assignedPartnerId: partner.id,
      status: { notIn: ['CANCELLED', 'REJECTED'] },
    };

    if (periodStartDate) {
      bookingWhere.createdAt = { gte: periodStartDate };
    }

    const bookings = await prisma.booking.findMany({
      where: bookingWhere,
      include: {
        tests: { include: { test: true } },
        packages: { include: { package: true } },
        report: { select: { id: true, status: true, pdfUrl: true, reportedDate: true } },
        branch: { select: { id: true, name: true, city: true } },
        user: { select: { name: true, mobile: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const commissionsList = await (prisma as any).referralCommission.findMany({
      where: {
        partnerId: partner.id,
        ...(periodStartDate ? { createdAt: { gte: periodStartDate } } : {}),
      },
    });

    const commissionMap = new Map<string, any>();
    commissionsList.forEach((c: any) => commissionMap.set(c.bookingId, c));

    let totalBilled = 0;
    let totalCommission = 0;
    let paidCommission = 0;
    let unpaidCommission = 0;
    let totalTestsCount = 0;

    const referrals = bookings.map((b) => {
      const bookedAmount = b.totalPaid || 0;
      totalBilled += bookedAmount;

      const testItems: { name: string; price: number; commission: number }[] = [];

      if (b.tests && b.tests.length > 0) {
        b.tests.forEach((t: any) => {
          const price = t.test?.price || bookedAmount / Math.max(1, b.tests.length);
          const comm = (price * commissionRate) / 100;
          testItems.push({
            name: t.test?.name || 'Diagnostic Test',
            price,
            commission: comm,
          });
          totalTestsCount++;
        });
      }
      if (b.packages && b.packages.length > 0) {
        b.packages.forEach((p: any) => {
          const price = p.package?.price || bookedAmount;
          const comm = (price * commissionRate) / 100;
          testItems.push({
            name: p.package?.name || 'Health Package',
            price,
            commission: comm,
          });
          totalTestsCount++;
        });
      }

      if (testItems.length === 0) {
        const comm = (bookedAmount * commissionRate) / 100;
        testItems.push({
          name: 'Pathology Investigation',
          price: bookedAmount,
          commission: comm,
        });
        totalTestsCount++;
      }

      const bookingCommission = (bookedAmount * commissionRate) / 100;
      totalCommission += bookingCommission;

      const existingComm = commissionMap.get(b.id);
      const isPaid = existingComm?.status === 'PAID';

      if (isPaid) {
        paidCommission += bookingCommission;
      } else {
        unpaidCommission += bookingCommission;
      }

      return {
        bookingId: b.id,
        bookingCode: b.bookingCode,
        patientName: b.patientName || b.user?.name || 'Patient',
        patientAge: b.patientAge,
        patientGender: b.patientGender,
        patientMobile: b.patientMobile || b.user?.mobile,
        scheduledDate: b.scheduledDate,
        bookingStatus: b.status,
        totalPaid: bookedAmount,
        commissionRate,
        commissionAmount: bookingCommission,
        paymentCycle,
        payoutStatus: isPaid ? 'PAID' : 'UNPAID',
        paidAt: existingComm?.paidAt || null,
        tests: testItems,
        report: b.report
          ? {
              id: b.report.id,
              status: b.report.status,
              pdfUrl: b.report.pdfUrl,
              reportedDate: b.report.reportedDate,
              verificationUrl: `/verify-report/${b.report.id}`,
            }
          : null,
        branch: b.branch,
        createdAt: b.createdAt,
      };
    });

    res.json({
      partner: {
        id: partner.id,
        labName: partner.labName,
        partnerCode: partner.partnerCode || `PART-${partner.id.slice(0, 5).toUpperCase()}`,
        role: partner.role,
        address: partner.address,
        commissionRate,
        paymentCycle,
        rating: partner.rating,
      },
      period,
      summary: {
        totalReferredSamples: bookings.length,
        totalTestsCount,
        totalBilledAmount: Math.round(totalBilled),
        commissionRate,
        totalCommissionEarned: Math.round(totalCommission),
        paidCommission: Math.round(paidCommission),
        unpaidCommission: Math.round(unpaidCommission),
        paymentCycle,
      },
      referrals,
    });
  } catch (error: any) {
    console.error('Error fetching partner portal data:', error);
    res.status(500).json({ error: 'Failed to fetch partner portal data', details: error.message });
  }
};

export const getAdminCommissions = async (req: AuthRequest, res: Response) => {
  try {
    const period = (req.query.period as string) || 'ALL';
    const periodStartDate = getPeriodStartDate(period);

    const [doctors, partners, recentCommissions] = await Promise.all([
      (prisma as any).doctor.findMany({
        where: { isActive: true },
        include: { branch: true },
        orderBy: { name: 'asc' },
      }),
      (prisma as any).pathologyPartner.findMany({
        orderBy: { labName: 'asc' },
      }),
      (prisma as any).referralCommission.findMany({
        where: periodStartDate ? { createdAt: { gte: periodStartDate } } : {},
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { doctor: true, partner: true, booking: true },
      }),
    ]);

    const doctorSummaries = await Promise.all(
      doctors.map(async (doc: any) => {
        const commRate = doc.commissionRate ?? 30.0;
        const bWhere: any = {
          OR: [{ referringDoctorId: doc.id }, { branchId: doc.branchId }],
          status: { notIn: ['CANCELLED'] },
        };
        if (periodStartDate) bWhere.createdAt = { gte: periodStartDate };

        const bCount = await prisma.booking.count({ where: bWhere });
        const bAggregate = await prisma.booking.aggregate({
          where: bWhere,
          _sum: { totalPaid: true },
        });

        const totalRevenue = bAggregate._sum.totalPaid || 0;
        const totalComm = (totalRevenue * commRate) / 100;

        return {
          id: doc.id,
          entityType: 'DOCTOR',
          name: doc.name,
          code: doc.code || `DOC-${doc.id.slice(0, 5).toUpperCase()}`,
          qualification: doc.qualification,
          specialization: doc.specialization,
          commissionRate: commRate,
          paymentCycle: doc.paymentCycle || 'MONTHLY',
          branchName: doc.branch?.name || 'Main Lab',
          totalSamples: bCount,
          totalRevenue: Math.round(totalRevenue),
          totalCommission: Math.round(totalComm),
        };
      })
    );

    const partnerSummaries = await Promise.all(
      partners.map(async (p: any) => {
        const commRate = p.commissionRate ?? 30.0;
        const bWhere: any = {
          assignedPartnerId: p.id,
          status: { notIn: ['CANCELLED', 'REJECTED'] },
        };
        if (periodStartDate) bWhere.createdAt = { gte: periodStartDate };

        const bCount = await prisma.booking.count({ where: bWhere });
        const bAggregate = await prisma.booking.aggregate({
          where: bWhere,
          _sum: { totalPaid: true },
        });

        const totalRevenue = bAggregate._sum.totalPaid || 0;
        const totalComm = (totalRevenue * commRate) / 100;

        return {
          id: p.id,
          entityType: 'PARTNER',
          name: p.labName,
          code: p.partnerCode || `PART-${p.id.slice(0, 5).toUpperCase()}`,
          qualification: p.role,
          specialization: 'Diagnostic Tie-up',
          commissionRate: commRate,
          paymentCycle: p.paymentCycle || 'MONTHLY',
          branchName: p.address || 'Tie-up Lab Center',
          totalSamples: bCount,
          totalRevenue: Math.round(totalRevenue),
          totalCommission: Math.round(totalComm),
        };
      })
    );

    const finalPartners = partnerSummaries.filter(p => p.qualification !== 'PHLEBOTOMIST');
    const finalPhlebotomists = partnerSummaries.filter(p => p.qualification === 'PHLEBOTOMIST');

    res.json({
      period,
      doctors: doctorSummaries,
      partners: finalPartners,
      phlebotomists: finalPhlebotomists,
      recentCommissions,
    });
  } catch (error: any) {
    console.error('Error fetching admin commissions:', error);
    res.status(500).json({ error: 'Failed to fetch admin commission data', details: error.message });
  }
};

export const updateCommissionConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, id } = req.params;
    const { commissionRate, paymentCycle, code, loginId, password } = req.body;

    if (entityType === 'DOCTOR') {
      const dataToUpdate: any = {};
      if (commissionRate !== undefined) dataToUpdate.commissionRate = Number(commissionRate);
      if (paymentCycle) dataToUpdate.paymentCycle = paymentCycle;
      if (code) dataToUpdate.code = code;
      if (loginId) dataToUpdate.loginId = loginId;
      if (password) dataToUpdate.password = password;

      const updated = await (prisma as any).doctor.update({
        where: { id },
        data: dataToUpdate,
      });
      return res.json({ success: true, doctor: updated });
    } else if (entityType === 'PARTNER') {
      const dataToUpdate: any = {};
      if (commissionRate !== undefined) dataToUpdate.commissionRate = Number(commissionRate);
      if (paymentCycle) dataToUpdate.paymentCycle = paymentCycle;
      if (code) dataToUpdate.partnerCode = code;
      if (loginId) dataToUpdate.loginId = loginId;
      if (password) dataToUpdate.password = password;

      const updated = await (prisma as any).pathologyPartner.update({
        where: { id },
        data: dataToUpdate,
      });
      return res.json({ success: true, partner: updated });
    } else {
      return res.status(400).json({ error: 'Invalid entityType. Must be DOCTOR or PARTNER.' });
    }
  } catch (error: any) {
    console.error('Error updating commission config:', error);
    res.status(500).json({ error: 'Failed to update commission config', details: error.message });
  }
};

export const updatePayoutStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId, doctorId, partnerId, status, notes } = req.body;

    if (!bookingId || !status) {
      return res.status(400).json({ error: 'bookingId and status (PAID/UNPAID) are required' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { tests: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const entityType = doctorId ? 'DOCTOR' : 'PARTNER';
    const bookedAmount = booking.totalPaid || 0;
    let commRate = 30.0;

    if (doctorId) {
      const doc = await (prisma as any).doctor.findUnique({ where: { id: doctorId } });
      if (doc?.commissionRate) commRate = doc.commissionRate;
    } else if (partnerId) {
      const partner = await (prisma as any).pathologyPartner.findUnique({ where: { id: partnerId } });
      if (partner?.commissionRate) commRate = partner.commissionRate;
    }

    const commAmount = (bookedAmount * commRate) / 100;

    const existing = await (prisma as any).referralCommission.findFirst({
      where: { bookingId },
    });

    let payout;
    if (existing) {
      payout = await (prisma as any).referralCommission.update({
        where: { id: existing.id },
        data: {
          status,
          paidAt: status === 'PAID' ? new Date() : null,
          paidBy: status === 'PAID' ? req.user?.id : null,
          notes: notes || existing.notes,
        },
      });
    } else {
      payout = await (prisma as any).referralCommission.create({
        data: {
          bookingId,
          entityType,
          doctorId: doctorId || null,
          partnerId: partnerId || null,
          bookingCode: booking.bookingCode,
          patientName: booking.patientName,
          testName: 'Pathology Diagnostics',
          testAmount: bookedAmount,
          commissionRate: commRate,
          commissionAmount: commAmount,
          status,
          paidAt: status === 'PAID' ? new Date() : null,
          paidBy: status === 'PAID' ? req.user?.id : null,
          notes,
        },
      });
    }

    res.json({ success: true, payout });
  } catch (error: any) {
    console.error('Error updating payout status:', error);
    res.status(500).json({ error: 'Failed to update payout status', details: error.message });
  }
};
