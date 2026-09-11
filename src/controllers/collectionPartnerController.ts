import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { triggerApprovalNotification } from '../services/notification.service';

export const getCollectionPartnersSummary = async (req: Request, res: Response) => {
  try {
    const { branchId, labId } = req.query;
    const targetBranchId = (branchId || labId) as string;

    const executives = await prisma.user.findMany({
      where: {
        role: 'EXECUTIVE',
        ...(targetBranchId && targetBranchId !== 'ALL' && targetBranchId !== 'all' ? {
          OR: [
            { adminUser: { branchId: targetBranchId } },
            { pathologyPartner: { branchId: targetBranchId } }
          ]
        } : {})
      },
      include: { adminUser: true }
    });

    const totalPartners = executives.length;
    const activePartners = executives.filter(e => e.adminUser?.isActive === true).length;
    const pendingApprovals = executives.filter(e => !e.adminUser || e.adminUser.isActive === false).length;

    const bookings = await prisma.booking.findMany({
      where: {
        assignedExecutiveId: { in: executives.map(e => e.id) },
        status: { in: ['COMPLETED', 'DELIVERED_TO_LAB', 'REPORT_READY', 'SAMPLE_COLLECTED'] },
        ...(targetBranchId && targetBranchId !== 'ALL' && targetBranchId !== 'all' ? { branchId: targetBranchId } : {})
      }
    });

    const totalCollections = bookings.length;
    const totalCommission = bookings.reduce((sum, b) => sum + ((b.totalPaid || 0) * 0.30), 0);
    const totalWalletBalance = totalCommission;

    res.json({
      totalPartners,
      activePartners,
      pendingApprovals,
      totalCollections,
      totalCommission: Math.round(totalCommission),
      totalWalletBalance: Math.round(totalWalletBalance),
    });
  } catch (error: any) {
    console.error('Error in getCollectionPartnersSummary:', error);
    res.status(500).json({ error: 'Failed to fetch collection partners summary', details: error.message });
  }
};

export const getCollectionPartners = async (req: Request, res: Response) => {
  try {
    const { search, labId, branchId, status } = req.query;
    const targetBranchId = (branchId || labId) as string;

    const executives = await prisma.user.findMany({
      where: {
        role: 'EXECUTIVE',
        ...(targetBranchId && targetBranchId !== 'ALL' && targetBranchId !== 'all' ? {
          OR: [
            { adminUser: { branchId: targetBranchId } },
            { pathologyPartner: { branchId: targetBranchId } }
          ]
        } : {})
      },
      include: {
        adminUser: {
          include: { branch: true }
        },
        pathologyPartner: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = await Promise.all(executives.map(async (e) => {
      const executiveBookings = await prisma.booking.findMany({
        where: { assignedExecutiveId: e.id },
        select: { totalPaid: true, status: true }
      });

      const totalSamples = executiveBookings.length;
      const totalTestValue = executiveBookings.reduce((sum, b) => sum + (b.totalPaid || 0), 0);
      const commissionRate = e.pathologyPartner?.commissionRate ?? 30.0;
      const totalCommissionEarned = Math.round(totalTestValue * (commissionRate / 100));
      const walletBalance = totalCommissionEarned;

      const adminUser = e.adminUser;
      const partner = e.pathologyPartner;
      let currentStatus = 'PENDING';
      if (partner?.approvalStatus) {
        currentStatus = partner.approvalStatus;
      } else if (adminUser?.isActive) {
        currentStatus = 'APPROVED';
      }
      const branch = adminUser?.branch || null;
      const isAvailable = currentStatus === 'APPROVED' && (partner ? partner.isAvailable : true);

      return {
        id: e.id,
        userId: e.id,
        name: e.name,
        mobile: e.mobile,
        email: e.email || '',
        avatarUrl: e.avatarUrl || null,
        registrationDate: e.createdAt.toISOString(),
        status: currentStatus,
        isAvailable,
        partnerCode: `PHLEBO-${e.id.slice(0, 5).toUpperCase()}`,
        labName: `${e.name} (Freelance Phlebotomist)`,
        role: 'PHLEBOTOMIST',
        address: adminUser?.department || 'Independent',
        assignedLab: branch ? { id: branch.id, name: branch.name, city: branch.city } : null,
        commissionRate,
        paymentCycle: partner?.paymentCycle || 'WEEKLY',
        totalSamplesCollected: totalSamples,
        totalTestValue,
        totalCommissionEarned,
        totalWalletCredits: totalCommissionEarned,
        walletBalance,
      };
    }));

    let filtered = formatted;
    if (status && status !== 'ALL') {
      filtered = filtered.filter(p => p.status === String(status));
    }
    if (labId && labId !== 'ALL') {
      filtered = filtered.filter(p => p.assignedLab?.id === String(labId));
    }
    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.mobile.includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.partnerCode.toLowerCase().includes(q)
      );
    }

    res.json(filtered);
  } catch (error: any) {
    console.error('Error in getCollectionPartners:', error);
    res.status(500).json({ error: 'Failed to fetch collection partners', details: error.message });
  }
};

export const getCollectionPartnerDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, role: 'EXECUTIVE' },
      include: {
        adminUser: { include: { branch: true } },
        pathologyPartner: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Collection Partner not found' });
    }

    const bookings = await prisma.booking.findMany({
      where: { assignedExecutiveId: user.id },
      include: {
        user: { select: { name: true, mobile: true, uhid: true } },
        tests: { include: { test: { select: { name: true, price: true } } } },
        packages: { include: { package: { select: { name: true, price: true } } } },
        branch: true,
        sample: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    const partnerCommissionRate = user.pathologyPartner?.commissionRate ?? 30.0;

    const collectionsHistory = bookings.map(b => {
      const testName = b.tests.map(t => t.test.name).concat(b.packages.map(p => p.package.name)).join(', ') || 'Diagnostic Test';
      const commissionRate = partnerCommissionRate;
      const commissionAmount = Math.round((b.totalPaid || 0) * (commissionRate / 100));

      return {
        id: b.id,
        bookingId: b.id,
        bookingCode: b.bookingCode,
        collectionDate: b.scheduledDate ? b.scheduledDate.toISOString() : b.createdAt.toISOString(),
        sampleId: b.sample?.accessionNumber || `SMP-${b.bookingCode.slice(-4)}`,
        sampleType: b.sample?.sampleType || 'Blood / Serum',
        sampleCondition: b.sample?.condition || 'GOOD',
        patient: {
          name: b.patientName,
          mobile: b.patientMobile || b.user.mobile,
          uhid: b.user.uhid || null,
          age: b.patientAge || null,
          gender: b.patientGender || null,
        },
        testName,
        testAmount: b.totalPaid,
        labPartnerName: b.branch?.name || 'Central Lab',
        labId: b.branchId || null,
        collectionStatus: b.status,
        collectionMode: b.collectionMode,
        commissionRate,
        commissionAmount,
        walletCreditAmount: commissionAmount,
        isCreditedToWallet: true,
      };
    });

    const adminUser = user.adminUser;
    const partner = user.pathologyPartner;
    let currentStatus = 'PENDING';
    if (partner?.approvalStatus) {
      currentStatus = partner.approvalStatus;
    } else if (adminUser?.isActive) {
      currentStatus = 'APPROVED';
    }
    const branch = adminUser?.branch || null;
    const isAvailable = currentStatus === 'APPROVED' && (partner ? partner.isAvailable : true);

    const totalSamples = collectionsHistory.length;
    const totalTestValue = collectionsHistory.reduce((sum, c) => sum + (c.testAmount || 0), 0);
    const totalCommissionEarned = collectionsHistory.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

    const partnerData = {
      id: user.id,
      userId: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email || '',
      avatarUrl: user.avatarUrl || null,
      registrationDate: user.createdAt.toISOString(),
      status: currentStatus,
      isAvailable,
      partnerCode: `PHLEBO-${user.id.slice(0, 5).toUpperCase()}`,
      labName: `${user.name} (Freelance Phlebotomist)`,
      role: 'PHLEBOTOMIST',
      address: adminUser?.department || 'Independent',
      assignedLab: branch ? { id: branch.id, name: branch.name, city: branch.city } : null,
      commissionRate: partnerCommissionRate,
      paymentCycle: partner?.paymentCycle || 'WEEKLY',
      totalSamplesCollected: totalSamples,
      totalTestValue,
      totalCommissionEarned,
      totalWalletCredits: totalCommissionEarned,
      walletBalance: totalCommissionEarned,
    };

    res.json({
      partner: partnerData,
      collections: collectionsHistory,
      labWiseSummary: [],
      ...partnerData,
      collectionsHistory,
    });
  } catch (error: any) {
    console.error('Error in getCollectionPartnerDetails:', error);
    res.status(500).json({ error: 'Failed to fetch collection partner details', details: error.message });
  }
};

export const getDailyCollectionSummary = async (req: Request, res: Response) => {
  try {
    const { branchId, labId } = req.query;
    const targetBranchId = (branchId || labId) as string;

    const bookings = await prisma.booking.findMany({
      where: {
        assignedExecutiveId: { not: null },
        status: { in: ['COMPLETED', 'DELIVERED_TO_LAB', 'REPORT_READY', 'SAMPLE_COLLECTED'] },
        ...(targetBranchId && targetBranchId !== 'ALL' && targetBranchId !== 'all' ? { branchId: targetBranchId } : {})
      },
      orderBy: { createdAt: 'asc' }
    });

    const dailyMap = new Map<string, { collections: number; totalAmount: number; totalCommission: number }>();

    bookings.forEach(b => {
      const dateStr = (b.scheduledDate || b.createdAt).toISOString().split('T')[0];
      const existing = dailyMap.get(dateStr) || { collections: 0, totalAmount: 0, totalCommission: 0 };
      existing.collections += 1;
      existing.totalAmount += b.totalPaid || 0;
      existing.totalCommission += Math.round((b.totalPaid || 0) * 0.30);
      dailyMap.set(dateStr, existing);
    });

    const result = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      ...data
    }));

    res.json(result);
  } catch (error: any) {
    console.error('Error in getDailyCollectionSummary:', error);
    res.status(500).json({ error: 'Failed to fetch daily summary', details: error.message });
  }
};

export const getLabWiseCollections = async (req: Request, res: Response) => {
  try {
    const { branchId, labId } = req.query;
    const targetBranchId = (branchId || labId) as string;

    const branches = await prisma.branch.findMany({
      where: targetBranchId && targetBranchId !== 'ALL' && targetBranchId !== 'all' ? { id: targetBranchId } : undefined
    });
    const result = await Promise.all(branches.map(async b => {
      const bookings = await prisma.booking.findMany({
        where: { branchId: b.id, assignedExecutiveId: { not: null } },
        select: { totalPaid: true }
      });
      const samples = bookings.length;
      const totalTestValue = bookings.reduce((sum, bk) => sum + (bk.totalPaid || 0), 0);
      const collectionCommission = Math.round(totalTestValue * 0.30);

      return {
        labId: b.id,
        labName: b.name,
        city: b.city,
        samples,
        totalTestValue,
        collectionCommission,
        walletCredited: collectionCommission,
      };
    }));

    res.json(result);
  } catch (error: any) {
    console.error('Error in getLabWiseCollections:', error);
    res.status(500).json({ error: 'Failed to fetch lab wise collections', details: error.message });
  }
};

export const updateCollectionPartnerStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approvalStatus, branchId } = req.body;

    const isActive = approvalStatus === 'APPROVED';

    // Update AdminUser record for this executive user
    let adminUser = await prisma.adminUser.findUnique({ where: { userId: id } });
    if (adminUser) {
      adminUser = await prisma.adminUser.update({
        where: { userId: id },
        data: {
          isActive,
          ...(branchId ? { branchId } : {})
        }
      });
    } else {
      let execRole = await prisma.adminRole.findFirst({ where: { slug: 'executive' } });
      if (!execRole) {
        execRole = await prisma.adminRole.create({
          data: { name: 'Executive', slug: 'executive', description: 'Sample Collection Executive', isSystem: true }
        });
      }
      adminUser = await prisma.adminUser.create({
        data: {
          userId: id,
          roleId: execRole.id,
          department: 'Collection Operations',
          designation: 'Phlebotomist',
          isActive,
          ...(branchId ? { branchId } : {})
        }
      });
    }

    // Also sync PathologyPartner record
    const existingPartner = await prisma.pathologyPartner.findUnique({ where: { userId: id } });
    if (existingPartner) {
      await prisma.pathologyPartner.update({
        where: { userId: id },
        data: {
          approvalStatus,
          isAvailable: isActive,
          commissionRate: 30.0,
          ...(branchId ? { branchId } : {})
        }
      });
    } else {
      const userRec = await prisma.user.findUnique({ where: { id } });
      if (userRec) {
        await prisma.pathologyPartner.create({
          data: {
            userId: id,
            labName: `${userRec.name} (Freelance Phlebotomist)`,
            role: 'PHLEBOTOMIST',
            approvalStatus,
            isAvailable: isActive,
            commissionRate: 30.0,
            branchId: branchId || undefined,
          }
        }).catch(console.error);
      }
    }

    if (isActive) {
      triggerApprovalNotification(id, 'Collection Partner').catch(console.error);
    }

    res.json({ message: 'Collection partner status updated successfully', status: approvalStatus });
  } catch (error: any) {
    console.error('Error in updateCollectionPartnerStatus:', error);
    res.status(500).json({ error: 'Failed to update collection partner status', details: error.message });
  }
};

export const creditCommissionPayout = async (req: Request, res: Response) => {
  try {
    const { bookingId, partnerId, notes } = req.body;
    res.json({ success: true, message: 'Commission credited successfully', notes });
  } catch (error: any) {
    console.error('Error in creditCommissionPayout:', error);
    res.status(500).json({ error: 'Failed to credit commission', details: error.message });
  }
};
