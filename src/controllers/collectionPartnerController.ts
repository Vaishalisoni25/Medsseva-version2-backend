import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { triggerApprovalNotification } from '../services/notification.service';

async function resolveTargetBranchIds(branchId?: string, labId?: string, city?: string): Promise<string[] | undefined> {
  const specific = (branchId && branchId !== 'ALL' && branchId !== 'all') ? branchId : ((labId && labId !== 'ALL' && labId !== 'all') ? labId : undefined);
  if (specific) return [specific];
  if (city && city !== 'ALL' && city !== 'all') {
    const branches = await prisma.branch.findMany({
      where: { city: { equals: city, mode: 'insensitive' } },
      select: { id: true }
    });
    return branches.map(b => b.id);
  }
  return undefined;
}

export const getCollectionPartnersSummary = async (req: Request, res: Response) => {
  try {
    const { branchId, labId, city } = req.query as any;
    const targetBranchIds = await resolveTargetBranchIds(branchId, labId, city);

    const executives = await prisma.user.findMany({
      where: {
        role: 'EXECUTIVE',
        ...(targetBranchIds && targetBranchIds.length > 0 ? {
          OR: [
            { adminUser: { branchId: { in: targetBranchIds } } },
            { pathologyPartner: { branchId: { in: targetBranchIds } } },
            { assignedCollections: { some: { branchId: { in: targetBranchIds } } } }
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
        ...(targetBranchIds && targetBranchIds.length > 0 ? { branchId: { in: targetBranchIds } } : {})
      }
    });

    const totalCollections = bookings.length;
    const totalCommission = bookings.reduce((sum, b) => sum + ((b.totalPaid || 0) * 0.30), 0);
    const totalWalletBalance = totalCommission;

    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, city: true },
      orderBy: { name: 'asc' }
    });

    res.json({
      totalPartners,
      activePartners,
      pendingApprovals,
      totalCollections,
      totalCommission: Math.round(totalCommission),
      totalWalletBalance: Math.round(totalWalletBalance),
      branches,
    });
  } catch (error: any) {
    console.error('Error in getCollectionPartnersSummary:', error);
    res.status(500).json({ error: 'Failed to fetch collection partners summary', details: error.message });
  }
};

export const getCollectionPartners = async (req: Request, res: Response) => {
  try {
    const { search, labId, branchId, city, status } = req.query as any;
    const targetBranchIds = await resolveTargetBranchIds(branchId, labId, city);

    const executives = await prisma.user.findMany({
      where: {
        role: 'EXECUTIVE',
        ...(targetBranchIds && targetBranchIds.length > 0 ? {
          OR: [
            { adminUser: { branchId: { in: targetBranchIds } } },
            { pathologyPartner: { branchId: { in: targetBranchIds } } },
            { assignedCollections: { some: { branchId: { in: targetBranchIds } } } }
          ]
        } : {})
      },
      include: {
        adminUser: {
          include: { branch: true }
        },
        pathologyPartner: {
          include: { documents: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = await Promise.all(executives.map(async (e) => {
      const executiveBookings = await prisma.booking.findMany({
        where: { assignedExecutiveId: e.id },
        select: { totalPaid: true, status: true }
      });

      const adminUser = e.adminUser;
      const partner = e.pathologyPartner;

      // In-House Staff Phlebotomist = Created from Admin Panel as Staff / Employee (has adminUser with STAFF/EMPLOYEE or branch assignment)
      // App Freelancer Phlebotomist = Self-registered via Mobile App (adminUser is null or userType is 'FREELANCER')
      const isEmployee = Boolean(
        adminUser &&
        adminUser.userType !== 'FREELANCER' && (
          adminUser.userType === 'STAFF' ||
          adminUser.userType === 'EMPLOYEE' ||
          (adminUser.designation && /phlebotomist|collector|staff|employee/i.test(adminUser.designation)) ||
          adminUser.branchId ||
          adminUser.partnerId
        )
      );
      const phlebotomistType = isEmployee ? 'EMPLOYEE' : 'FREELANCER';

      const totalSamples = executiveBookings.length;
      const totalTestValue = executiveBookings.reduce((sum, b) => sum + (b.totalPaid || 0), 0);
      const commissionRate = isEmployee ? 0 : (partner?.commissionRate ?? 30.0);
      const totalCommissionEarned = isEmployee ? 0 : Math.round(totalTestValue * (commissionRate / 100));
      const walletBalance = totalCommissionEarned;

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
        qualification: adminUser?.qualification || 'Not Specified',
        experience: adminUser?.designation || null,
        serviceArea: adminUser?.department || partner?.address || 'Independent',
        documents: (partner?.documents || []).map((doc: any) => ({
          id: doc.id,
          documentType: doc.documentType,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          status: doc.status,
        })),
        assignedLab: branch ? { id: branch.id, name: branch.name, city: branch.city } : null,
        commissionRate,
        paymentCycle: partner?.paymentCycle || 'WEEKLY',
        isEmployee,
        phlebotomistType,
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
      filtered = filtered.filter(p => !p.assignedLab || p.assignedLab?.id === String(labId));
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
      where: {
        OR: [
          { id },
          { pathologyPartner: { id } }
        ]
      },
      include: {
        adminUser: { include: { branch: true, role: true } },
        pathologyPartner: {
          include: { documents: true }
        }
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

    const adminUser = user.adminUser;
    const isEmployeeStaff = Boolean(
      adminUser &&
      adminUser.userType !== 'FREELANCER' && (
        adminUser.userType === 'EMPLOYEE' ||
        adminUser.userType === 'STAFF' ||
        (adminUser.designation && /phlebotomist|collector|staff|employee/i.test(adminUser.designation)) ||
        adminUser.branchId ||
        adminUser.partnerId
      )
    );

    const partnerCommissionRate = isEmployeeStaff ? 0 : (user.pathologyPartner?.commissionRate ?? 30.0);

    const collectionsHistory = bookings.map(b => {
      const testName = b.tests.map(t => t.test.name).concat(b.packages.map(p => p.package.name)).join(', ') || 'Diagnostic Test';
      const commissionRate = partnerCommissionRate;
      const commissionAmount = isEmployeeStaff ? 0 : Math.round((b.totalPaid || 0) * (commissionRate / 100));

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
          mobile: b.patientMobile || b.user?.mobile || '',
          uhid: b.user?.uhid || null,
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
      labName: isEmployeeStaff ? `${user.name} (In-House Staff)` : `${user.name} (Freelance Phlebotomist)`,
      role: 'PHLEBOTOMIST',
      address: adminUser?.department || 'Independent',
      qualification: adminUser?.qualification || 'Not Specified',
      experience: adminUser?.designation || null,
      serviceArea: adminUser?.department || partner?.address || 'Independent',
      documents: (partner?.documents || []).map((doc: any) => ({
        id: doc.id,
        documentType: doc.documentType,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        status: doc.status,
      })),
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
    const { branchId, labId, city } = req.query as any;
    const targetBranchIds = await resolveTargetBranchIds(branchId, labId, city);

    const bookings = await prisma.booking.findMany({
      where: {
        assignedExecutiveId: { not: null },
        status: { in: ['COMPLETED', 'DELIVERED_TO_LAB', 'REPORT_READY', 'SAMPLE_COLLECTED'] },
        ...(targetBranchIds && targetBranchIds.length > 0 ? { branchId: { in: targetBranchIds } } : {})
      },
      include: {
        assignedExecutive: { select: { id: true, name: true, mobile: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' }
    });

    const dailyMap = new Map<string, any>();

    bookings.forEach(b => {
      const dateStr = (b.scheduledDate || b.createdAt).toISOString().split('T')[0];
      const partnerId = b.assignedExecutiveId!;
      const labId = b.branchId || 'central';
      const key = `${dateStr}_${partnerId}_${labId}`;
      
      if (!dailyMap.has(key)) {
        dailyMap.set(key, {
          date: dateStr,
          partnerId: partnerId,
          collectionPartner: b.assignedExecutive?.name || 'Unknown',
          partnerMobile: b.assignedExecutive?.mobile || '',
          labId: b.branchId || '',
          labPartner: b.branch?.name || 'Central Lab',
          samples: 0,
          testValue: 0,
          commissionRate: 30,
          commission: 0,
          walletCredit: 0,
          status: 'COMPLETED'
        });
      }
      
      const existing = dailyMap.get(key);
      existing.samples += 1;
      existing.testValue += b.totalPaid || 0;
      existing.commission += Math.round((b.totalPaid || 0) * 0.30);
      existing.walletCredit += Math.round((b.totalPaid || 0) * 0.30);
    });

    const result = Array.from(dailyMap.values());
    res.json(result);
  } catch (error: any) {
    console.error('Error in getDailyCollectionSummary:', error);
    res.status(500).json({ error: 'Failed to fetch daily summary', details: error.message });
  }
};

export const getLabWiseCollections = async (req: Request, res: Response) => {
  try {
    const { branchId, labId, city } = req.query as any;
    const targetBranchIds = await resolveTargetBranchIds(branchId, labId, city);

    const bookings = await prisma.booking.findMany({
      where: {
        assignedExecutiveId: { not: null },
        ...(targetBranchIds && targetBranchIds.length > 0 ? { branchId: { in: targetBranchIds } } : {})
      },
      include: {
        assignedExecutive: { select: { id: true, name: true, mobile: true, email: true } },
        branch: { select: { id: true, name: true, city: true } },
      }
    });

    const labWiseMap = new Map<string, any>();

    bookings.forEach(b => {
      const partnerId = b.assignedExecutiveId!;
      const labId = b.branchId || 'central';
      const key = `${partnerId}_${labId}`;

      if (!labWiseMap.has(key)) {
        labWiseMap.set(key, {
          partnerId: partnerId,
          collectionPartner: b.assignedExecutive?.name || 'Unknown',
          partnerMobile: b.assignedExecutive?.mobile || '',
          partnerEmail: b.assignedExecutive?.email || '',
          labId: b.branchId || '',
          labPartner: b.branch?.name || 'Central Lab',
          labCode: '',
          city: b.branch?.city || '',
          numberOfSamples: 0,
          totalTestValue: 0,
          commissionRate: 30, // Default
          totalCommission: 0,
          walletAmountCredited: 0,
          lastDeliveredAt: b.createdAt.toISOString()
        });
      }

      const existing = labWiseMap.get(key);
      existing.numberOfSamples += 1;
      existing.totalTestValue += b.totalPaid || 0;
      existing.totalCommission += Math.round((b.totalPaid || 0) * 0.30);
      existing.walletAmountCredited += Math.round((b.totalPaid || 0) * 0.30);
      if (b.createdAt > new Date(existing.lastDeliveredAt)) {
         existing.lastDeliveredAt = b.createdAt.toISOString();
      }
    });

    const result = Array.from(labWiseMap.values());
    res.json(result);
  } catch (error: any) {
    console.error('Error in getLabWiseCollections:', error);
    res.status(500).json({ error: 'Failed to fetch lab wise collections', details: error.message });
  }
};

export const updateCollectionPartnerStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approvalStatus, branchId, commissionRate, paymentCycle, isAvailable } = req.body;

    const isActive = isAvailable !== undefined ? Boolean(isAvailable) : (approvalStatus === 'APPROVED');

    // Update AdminUser record for this executive user
    let adminUser = await prisma.adminUser.findUnique({ where: { userId: id } });
    if (adminUser) {
      adminUser = await prisma.adminUser.update({
        where: { userId: id },
        data: {
          isActive,
          ...(branchId !== undefined ? { branchId: branchId || null } : {})
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
          userType: 'FREELANCER',
          isActive,
          ...(branchId !== undefined ? { branchId: branchId || null } : {})
        }
      });
    }

    // Also sync PathologyPartner record with dynamic commissionRate
    const existingPartner = await prisma.pathologyPartner.findUnique({ where: { userId: id } });
    const finalCommRate = commissionRate !== undefined ? Number(commissionRate) : (existingPartner?.commissionRate ?? 30.0);
    const finalPaymentCycle = paymentCycle || existingPartner?.paymentCycle || 'WEEKLY';

    if (existingPartner) {
      await prisma.pathologyPartner.update({
        where: { userId: id },
        data: {
          ...(approvalStatus ? { approvalStatus } : {}),
          isAvailable: isActive,
          commissionRate: finalCommRate,
          paymentCycle: finalPaymentCycle,
          ...(branchId !== undefined ? { branchId: branchId || null } : {})
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
            approvalStatus: approvalStatus || 'APPROVED',
            isAvailable: isActive,
            commissionRate: finalCommRate,
            paymentCycle: finalPaymentCycle,
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

export const deleteCollectionPartner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Find user by id or by associated pathologyPartner / adminUser id
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { pathologyPartner: { id } },
          { adminUser: { id } }
        ]
      },
      include: {
        pathologyPartner: true,
        adminUser: true,
      }
    });

    if (!user) {
      // Check if id directly matches pathologyPartner
      const directPartner = await prisma.pathologyPartner.findUnique({ where: { id } });
      if (directPartner) {
        await prisma.booking.updateMany({ where: { assignedPartnerId: id }, data: { assignedPartnerId: null } }).catch(() => {});
        await prisma.partnerDocument.deleteMany({ where: { partnerId: id } }).catch(() => {});
        await prisma.referralCommission.deleteMany({ where: { partnerId: id } }).catch(() => {});
        await prisma.bookingRejection.deleteMany({ where: { partnerId: id } }).catch(() => {});
        await prisma.sampleDelivery.deleteMany({ where: { partnerId: id } }).catch(() => {});
        await prisma.partnerRating.deleteMany({ where: { partnerId: id } }).catch(() => {});
        await prisma.partnerWalletTransaction.deleteMany({ where: { partnerId: id } }).catch(() => {});
        await prisma.pathologyPartner.delete({ where: { id } });
        return res.json({ success: true, message: 'Collection partner deleted successfully' });
      }
      return res.status(404).json({ error: 'Phlebotomist not found' });
    }

    const userId = user.id;

    // 1. Unlink assigned collections and payment receiver in Bookings
    await prisma.booking.updateMany({
      where: { assignedExecutiveId: userId },
      data: { assignedExecutiveId: null }
    }).catch(err => console.warn('Unlink assigned collections warning:', err.message));

    await prisma.booking.updateMany({
      where: { paymentReceivedById: userId },
      data: { paymentReceivedById: null }
    }).catch(err => console.warn('Unlink paymentReceived warning:', err.message));

    // 2. If user has pathologyPartner record (or partnerId exists)
    if (user.pathologyPartner) {
      const pId = user.pathologyPartner.id;
      await prisma.booking.updateMany({ where: { assignedPartnerId: pId }, data: { assignedPartnerId: null } }).catch(() => {});
      await prisma.partnerDocument.deleteMany({ where: { partnerId: pId } }).catch(() => {});
      await prisma.referralCommission.deleteMany({ where: { partnerId: pId } }).catch(() => {});
      await prisma.bookingRejection.deleteMany({ where: { partnerId: pId } }).catch(() => {});
      await prisma.sampleDelivery.deleteMany({ where: { partnerId: pId } }).catch(() => {});
      await prisma.partnerRating.deleteMany({ where: { partnerId: pId } }).catch(() => {});
      await prisma.partnerWalletTransaction.deleteMany({ where: { partnerId: pId } }).catch(() => {});
      await prisma.pathologyPartner.deleteMany({ where: { id: pId } }).catch(() => {});
    }

    // 3. Delete / Unlink all User-level foreign keys
    await prisma.address.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.deviceToken.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.bookingIntent.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.paymentMethod.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.upiMethod.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.conversation.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.family.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.prescription.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.walletTransaction.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.expense.updateMany({ where: { createdById: userId }, data: { createdById: null } }).catch(() => {});
    await prisma.partnerRating.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.adminUser.deleteMany({ where: { userId } }).catch(() => {});

    // Delete any personal bookings created by this user as a patient
    await prisma.booking.deleteMany({ where: { userId } }).catch(() => {});

    // 4. Delete the User record
    await prisma.user.delete({
      where: { id: userId }
    });

    res.json({ success: true, message: 'Phlebotomist deleted successfully' });
  } catch (error: any) {
    console.error('Error in deleteCollectionPartner:', error);
    res.status(500).json({ error: 'Failed to delete collection partner', details: error.message });
  }
};
