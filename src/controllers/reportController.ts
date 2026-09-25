import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { autoConsumeForTest } from './inventoryController';
import { sendNotificationToUser } from '../services/notification.service';
import { sendReportEmail, sendReportSMS, sendReportWhatsApp, ReportDeliveryDetails } from '../services/email.service';
import { prisma } from '../lib/prisma';
import { uploadToCloudinary } from '../middlewares/upload';

export const getBookingsForReport = async (req: AuthRequest, res: Response) => {
  try {
    const { branchId } = req.query;
    const where: any = {
      status: { notIn: ['CANCELLED', 'PENDING'] },
    };

    if (!req.user?.isSuperAdmin) {
      const scopeConditions: any[] = [];
      if (req.user?.branchId) {
        scopeConditions.push({ branchId: req.user.branchId });
      }
      if (req.user?.partnerId) {
        scopeConditions.push({ assignedPartnerId: req.user.partnerId });
      }
      if (scopeConditions.length > 0) {
        where.OR = scopeConditions;
      }
    } else if (branchId) {
      where.branchId = String(branchId);
    }

    const bookings = await prisma.booking.findMany({
      where,
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
        assignedPartner: { include: { user: { select: { name: true, mobile: true } } } },
        branch: true,
        referringDoctor: true,
        sampleDelivery: {
          include: {
            branch: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const withAddress = await Promise.all(
      bookings.map(async (b) => {
        const address = await prisma.address.findUnique({ where: { id: b.addressId } });
        const repBranch = b.report ? resolveReportBranch(b.report) : null;
        const report = b.report ? {
          ...b.report,
          ...resolveReportTechnician(b.report),
          reportBranch: repBranch || (b.report as any).reportBranch || null,
          reportBranchId: repBranch?.id || b.report.reportBranchId || null,
        } : null;
        return { ...b, address, report };
      })
    );

    res.json(withAddress);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch bookings for report', details: error.message });
  }
};

const resolveReportTechnician = (r: any) => {
  let technicianName = r.technicianName || null;
  let technicianQualification = r.technicianQualification || null;
  let technicianSignatureUrl = r.technicianSignatureUrl || null;

  if (!technicianName && r.internalNotes && r.internalNotes.includes('[TECH:')) {
    try {
      const match = r.internalNotes.match(/\[TECH:(\{.*?\})\]/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        technicianName = parsed.name || technicianName;
        technicianQualification = parsed.qualification || technicianQualification;
        technicianSignatureUrl = parsed.signatureUrl || technicianSignatureUrl;
      }
    } catch (e) {}
  }

  return { technicianName, technicianQualification, technicianSignatureUrl };
};

const resolveReportBranch = (r: any) => {
  if (r.reportBranch) {
    return r.reportBranch;
  }
  if (r.internalNotes && r.internalNotes.includes('[BRANCH:')) {
    try {
      const match = r.internalNotes.match(/\[BRANCH:(\{.*?\})\]/);
      if (match && match[1]) {
        return JSON.parse(match[1]);
      }
    } catch (e) {}
  }
  return null;
};

export const getAllReports = async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, status } = req.query;
    const where: any = {};

    if (!req.user?.isSuperAdmin && req.user?.branchId) {
      where.OR = [
        { reportBranchId: req.user.branchId },
        { booking: { branchId: req.user.branchId } },
      ];
    } else if (branchId) {
      where.OR = [
        { reportBranchId: String(branchId) },
        { booking: { branchId: String(branchId) } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const reports = await prisma.report.findMany({
      where,
      include: {
        parameters: true,
        verifiedBy: { select: { name: true } },
        reportBranch: true,
        booking: {
          include: {
            user: { select: { name: true, mobile: true, email: true, addresses: true } },
            tests: { include: { test: true } },
            packages: { include: { package: true } },
            branch: true,
            assignedPartner: { include: { user: { select: { name: true } } } },
            referringDoctor: true,
          },
        },
        auditLogs: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { reportedDate: 'desc' },
    });

    const reportsWithAddress = await Promise.all(
      reports.map(async (r) => {
        let address = null;
        if (r.booking?.addressId) {
          address = await prisma.address.findUnique({ where: { id: r.booking.addressId } });
        }
        const tech = resolveReportTechnician(r);
        const branch = resolveReportBranch(r);
        return {
          ...r,
          ...tech,
          reportBranch: branch || r.reportBranch || null,
          reportBranchId: branch?.id || r.reportBranchId || null,
          booking: r.booking ? {
            ...r.booking,
            address: address || r.booking.user?.addresses?.[0] || null,
          } : null,
        };
      })
    );

    res.json(reportsWithAddress);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch reports', details: error.message });
  }
};
export const getReportById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        parameters: true,
        verifiedBy: { select: { name: true } },
        reportBranch: true,
        booking: {
          include: {
            user: { select: { name: true, mobile: true, email: true, addresses: true } },
            tests: { include: { test: { include: { parameters: true } } } },
            packages: {
              include: {
                package: {
                  include: { testsIncluded: { include: { test: { include: { parameters: true } } } } },
                },
              },
            },
            branch: true,
            assignedPartner: { include: { user: { select: { name: true } } } },
            referringDoctor: true,
          },
        },
        auditLogs: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    let address = null;
    if (report.booking?.addressId) {
      address = await prisma.address.findUnique({ where: { id: report.booking.addressId } });
    }
    let signatureUrl = (report as any).doctorSignatureUrl || null;
    if (!signatureUrl && report.doctorName) {
      const doc = await (prisma as any).doctor.findFirst({
        where: {
          OR: [
            { name: { equals: report.doctorName, mode: 'insensitive' } },
            ...((report as any).doctorRegNo ? [{ registrationNo: (report as any).doctorRegNo }] : []),
          ],
          signatureUrl: { not: null },
        },
        select: { signatureUrl: true },
      });
      if (doc?.signatureUrl) {
        signatureUrl = doc.signatureUrl;
      }
    }

    const tech = resolveReportTechnician(report);
    const repBranch = resolveReportBranch(report);

    const reportWithAddress = {
      ...report,
      ...tech,
      reportBranch: repBranch || report.reportBranch || null,
      reportBranchId: repBranch?.id || report.reportBranchId || null,
      doctorSignatureUrl: signatureUrl,
      booking: report.booking ? {
        ...report.booking,
        address: address || report.booking.user?.addresses?.[0] || null,
      } : null,
    };

    res.json(reportWithAddress);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch report', details: error.message });
  }
};


export const createReport = async (req: AuthRequest, res: Response) => {
  try {
    const {
      bookingId, testName, clinicalNotes, technicianRemarks, doctorRemarks, internalNotes,
      parameters, recipientType, recipientId,
      reportBranchId, branchDetails, doctorName, doctorQualification, doctorRegNo, doctorDesignation, doctorVerifiedAt,
      doctorSignatureUrl,
      technicianName, technicianQualification, technicianSignatureUrl,
    } = req.body;

    const existing = await prisma.report.findUnique({ where: { bookingId } });
    if (existing) {
      return res.status(400).json({ error: 'A report already exists for this booking. Use the update endpoint.' });
    }

    const hasAbnormal = parameters.some((p: any) => p.isAbnormal);

    let finalReportBranchId: string | null = null;
    let resolvedBranchData: any = branchDetails || null;

    if (reportBranchId) {
      const realBranch = await prisma.branch.findUnique({ where: { id: reportBranchId } });
      if (realBranch) {
        finalReportBranchId = realBranch.id;
        resolvedBranchData = {
          id: realBranch.id,
          name: realBranch.name,
          line1: realBranch.line1 || '',
          city: realBranch.city || '',
          state: realBranch.state || '',
          pincode: realBranch.pincode || '',
          contactNumber: realBranch.contactNumber || '',
          email: realBranch.email || '',
          labRegNo: realBranch.labRegNo || '',
          isPartnerLab: false,
        };
      } else {
        const partner = await prisma.pathologyPartner.findUnique({
          where: { id: reportBranchId },
          include: { user: true },
        });
        if (partner) {
          finalReportBranchId = null;
          resolvedBranchData = {
            id: partner.id,
            name: partner.labName || 'Partner Lab',
            line1: partner.address || partner.city || '',
            city: partner.city || '',
            state: partner.state || '',
            pincode: partner.pincode || '',
            contactNumber: partner.user?.mobile || '',
            email: partner.user?.email || '',
            labRegNo: '',
            isPartnerLab: true,
          };
        }
      }
    }

    let finalInternalNotes = internalNotes || '';
    if (technicianName || technicianQualification || technicianSignatureUrl) {
      const techJson = JSON.stringify({
        name: technicianName || null,
        qualification: technicianQualification || 'DMLT',
        signatureUrl: technicianSignatureUrl || null,
      });
      finalInternalNotes = finalInternalNotes.replace(/\[TECH:\{.*?\}\]/g, '').trim();
      finalInternalNotes = `${finalInternalNotes} [TECH:${techJson}]`.trim();
    }

    if (resolvedBranchData) {
      const branchJson = JSON.stringify(resolvedBranchData);
      finalInternalNotes = finalInternalNotes.replace(/\[BRANCH:\{.*?\}\]/g, '').replace(/\[BRANCH_ID:[^\]]+\]/g, '').trim();
      finalInternalNotes = `${finalInternalNotes} [BRANCH:${branchJson}] [BRANCH_ID:${resolvedBranchData.id}]`.trim();
    }

    const report = await (prisma as any).report.create({
      data: {
        bookingId,
        testName,
        clinicalNotes,
        technicianRemarks: technicianRemarks || null,
        doctorRemarks: doctorRemarks || null,
        internalNotes: finalInternalNotes || null,
        status: 'DRAFT',
        hasAbnormalFlags: hasAbnormal,
        recipientType: recipientType || 'USER',
        recipientId: recipientId || null,
        reportBranchId: finalReportBranchId,
        doctorName: doctorName || null,
        doctorQualification: doctorQualification || null,
        doctorRegNo: doctorRegNo || null,
        doctorDesignation: doctorDesignation || null,
        doctorVerifiedAt: doctorVerifiedAt ? new Date(doctorVerifiedAt) : null,
        doctorSignatureUrl: doctorSignatureUrl || null,
        technicianName: technicianName || null,
        technicianQualification: technicianQualification || null,
        technicianSignatureUrl: technicianSignatureUrl || null,
        parameters: {
          create: parameters.map((p: any) => ({
            parameterId: p.parameterId || undefined,
            parameterName: p.parameterName,
            observedValue: String(p.observedValue),
            unit: p.unit || '',
            referenceRange: p.referenceRange || '',
            isAbnormal: p.isAbnormal || false,
          })),
        },
        auditLogs: {
          create: {
            action: 'DRAFT_CREATED',
            performedBy: req.user?.id || 'system',
            details: `Report draft created for booking ${bookingId}`,
          },
        },
      },
      include: { parameters: true, auditLogs: true, reportBranch: true },
    });

    const repBranch = resolveReportBranch(report) || resolvedBranchData;
    res.status(201).json({
      ...report,
      reportBranch: repBranch || report.reportBranch || null,
      reportBranchId: repBranch?.id || report.reportBranchId || null,
    });
  } catch (error: any) {
    console.error('Failed to create report:', error);
    res.status(500).json({ error: 'Failed to create report', details: error.message });
  }
};
export const updateReportDraft = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      clinicalNotes, technicianRemarks, doctorRemarks, internalNotes, parameters,
      reportBranchId, branchDetails, doctorName, doctorQualification, doctorRegNo, doctorDesignation, doctorVerifiedAt,
      doctorSignatureUrl,
      technicianName, technicianQualification, technicianSignatureUrl,
    } = req.body;

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.status === 'VERIFIED' || report.status === 'PUBLISHED') {
      return res.status(400).json({ error: 'Cannot edit a finalized report' });
    }

    await prisma.reportResult.deleteMany({ where: { reportId: id } });

    const hasAbnormal = parameters.some((p: any) => p.isAbnormal);

    let finalReportBranchId: string | null = null;
    let resolvedBranchData: any = branchDetails || null;

    if (reportBranchId !== undefined) {
      if (reportBranchId) {
        const realBranch = await prisma.branch.findUnique({ where: { id: reportBranchId } });
        if (realBranch) {
          finalReportBranchId = realBranch.id;
          resolvedBranchData = {
            id: realBranch.id,
            name: realBranch.name,
            line1: realBranch.line1 || '',
            city: realBranch.city || '',
            state: realBranch.state || '',
            pincode: realBranch.pincode || '',
            contactNumber: realBranch.contactNumber || '',
            email: realBranch.email || '',
            labRegNo: realBranch.labRegNo || '',
            isPartnerLab: false,
          };
        } else {
          const partner = await prisma.pathologyPartner.findUnique({
            where: { id: reportBranchId },
            include: { user: true },
          });
          if (partner) {
            finalReportBranchId = null;
            resolvedBranchData = {
              id: partner.id,
              name: partner.labName || 'Partner Lab',
              line1: partner.address || partner.city || '',
              city: partner.city || '',
              state: partner.state || '',
              pincode: partner.pincode || '',
              contactNumber: partner.user?.mobile || '',
              email: partner.user?.email || '',
              labRegNo: '',
              isPartnerLab: true,
            };
          }
        }
      } else {
        finalReportBranchId = null;
        resolvedBranchData = null;
      }
    } else if (report.reportBranchId) {
      finalReportBranchId = report.reportBranchId;
    }

    let finalInternalNotes = internalNotes !== undefined ? (internalNotes || '') : (report.internalNotes || '');
    if (technicianName !== undefined || technicianQualification !== undefined || technicianSignatureUrl !== undefined) {
      const existingTechMatch = finalInternalNotes.match(/\[TECH:(\{.*?\})\]/);
      let existingTech = {};
      if (existingTechMatch && existingTechMatch[1]) {
        try { existingTech = JSON.parse(existingTechMatch[1]); } catch (e) {}
      }
      const techJson = JSON.stringify({
        ...existingTech,
        name: technicianName !== undefined ? (technicianName || null) : ((report as any).technicianName || null),
        qualification: technicianQualification !== undefined ? (technicianQualification || 'DMLT') : ((report as any).technicianQualification || 'DMLT'),
        signatureUrl: technicianSignatureUrl !== undefined ? (technicianSignatureUrl || null) : ((report as any).technicianSignatureUrl || null),
      });
      finalInternalNotes = finalInternalNotes.replace(/\[TECH:\{.*?\}\]/g, '').trim();
      finalInternalNotes = `${finalInternalNotes} [TECH:${techJson}]`.trim();
    }

    if (resolvedBranchData) {
      const branchJson = JSON.stringify(resolvedBranchData);
      finalInternalNotes = finalInternalNotes.replace(/\[BRANCH:\{.*?\}\]/g, '').replace(/\[BRANCH_ID:[^\]]+\]/g, '').trim();
      finalInternalNotes = `${finalInternalNotes} [BRANCH:${branchJson}] [BRANCH_ID:${resolvedBranchData.id}]`.trim();
    }

    const updated = await (prisma as any).report.update({
      where: { id },
      data: {
        clinicalNotes,
        technicianRemarks: technicianRemarks || null,
        doctorRemarks: doctorRemarks || null,
        internalNotes: finalInternalNotes || null,
        hasAbnormalFlags: hasAbnormal,
        reportBranchId: finalReportBranchId,
        doctorName: doctorName || null,
        doctorQualification: doctorQualification || null,
        doctorRegNo: doctorRegNo || null,
        doctorDesignation: doctorDesignation || null,
        doctorVerifiedAt: doctorVerifiedAt ? new Date(doctorVerifiedAt) : null,
        ...(doctorSignatureUrl !== undefined ? { doctorSignatureUrl: doctorSignatureUrl || null } : {}),
        ...(technicianName !== undefined ? { technicianName: technicianName || null } : {}),
        ...(technicianQualification !== undefined ? { technicianQualification: technicianQualification || null } : {}),
        ...(technicianSignatureUrl !== undefined ? { technicianSignatureUrl: technicianSignatureUrl || null } : {}),
        parameters: {
          create: parameters.map((p: any) => ({
            parameterId: p.parameterId || undefined,
            parameterName: p.parameterName,
            observedValue: String(p.observedValue),
            unit: p.unit || '',
            referenceRange: p.referenceRange || '',
            isAbnormal: p.isAbnormal || false,
          })),
        },
        auditLogs: {
          create: {
            action: 'DRAFT_UPDATED',
            performedBy: req.user?.id || 'system',
            details: `Draft updated with ${parameters.length} parameters`,
          },
        },
      },
      include: { parameters: true, auditLogs: true, reportBranch: true },
    });

    const repBranch = resolveReportBranch(updated) || resolvedBranchData;
    res.json({
      ...updated,
      reportBranch: repBranch || updated.reportBranch || null,
      reportBranchId: repBranch?.id || updated.reportBranchId || null,
    });
  } catch (error: any) {
    console.error('Failed to update report draft:', error);
    res.status(500).json({ error: 'Failed to update draft', details: error.message });
  }
};
export const finalizeReport = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    // Only Super Admin or Branch Admin can approve/finalize reports
    const isSuperAdmin = req.user.isSuperAdmin || req.user.role === 'SUPER_ADMIN';
    const isAdmin = req.user.role === 'ADMIN';

    if (!isSuperAdmin && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Only Super Admin or Branch Admin can approve reports' });
    }

    const report = await prisma.report.findUnique({
      where: { id },
      include: { parameters: true, booking: true },
    });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Branch Admin boundary check: if user has a branch assigned, ensure they only approve reports for their branch
    if (!isSuperAdmin && req.user.branchId) {
      const reportBranch = report.reportBranchId || report.booking?.branchId;
      if (reportBranch && reportBranch !== req.user.branchId) {
        return res.status(403).json({ error: 'Forbidden: Branch Admin can only approve reports for their branch' });
      }
    }

    if (report.parameters.length === 0) {
      return res.status(400).json({ error: 'Cannot finalize a report with no parameters entered' });
    }
    if (report.status === 'VERIFIED' || report.status === 'PUBLISHED') {
      return res.status(400).json({ error: 'Report is already finalized' });
    }

const finalized = await prisma.report.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedById: req.user.id,
        verifiedAt: new Date(),
        auditLogs: {
          create: {
            action: 'REPORT_APPROVED',
            performedBy: req.user.id,
            details: 'Report finalized and approved',
          },
        },
      },
      include: { parameters: true, auditLogs: true, booking: true, reportBranch: true },
    });

const bookingForFinalize = await prisma.booking.findUnique({
      where: { id: report.bookingId },
      select: { collectionMode: true },
    });
    if (bookingForFinalize?.collectionMode === 'LAB') {
      await prisma.booking.update({
        where: { id: report.bookingId },
        data: { status: 'REPORT_READY' },
      });
    } else {
      await prisma.booking.update({
        where: { id: report.bookingId },
        data: { status: 'REPORT_READY' },
      });
    }

sendNotificationToUser(
      finalized.booking.userId,
      'Report Ready',
      'Your diagnostic report is ready. Tap to view.',
      'REPORT_READY',
      { bookingId: report.bookingId }
    ).catch(console.error);

    const bookingWithTests = await prisma.booking.findUnique({
      where: { id: report.bookingId },
      include: { tests: true },
    });

    if (bookingWithTests?.tests?.length) {
      for (const bt of bookingWithTests.tests) {
        await autoConsumeForTest(bt.testId, finalized.booking.bookingCode, req.user?.id);
      }
    }
    const repBranch = resolveReportBranch(finalized);
    res.json({
      ...finalized,
      reportBranch: repBranch || (finalized as any).reportBranch || null,
      reportBranchId: repBranch?.id || finalized.reportBranchId || null,
    });
  } catch (error: any) {
    console.error('Failed to finalize report:', error);
    res.status(500).json({ error: 'Failed to finalize report', details: error.message });
  }
};

export const sendReport = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { recipientType, recipientId, channels } = req.body;

    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    if (!recipientType || !recipientId) {
      return res.status(400).json({ error: 'recipientType and recipientId are required' });
    }

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        parameters: true,
        reportBranch: true,
        booking: {
          include: {
            user: { select: { name: true, mobile: true, email: true } },
            tests: { include: { test: true } },
            packages: { include: { package: true } },
            branch: true,
          },
        },
      },
    });

    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.status !== 'VERIFIED' && report.status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'Only finalized reports can be sent' });
    }

    const released = await prisma.report.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        recipientType,
        recipientId,
        auditLogs: {
          create: {
            action: 'REPORT_SENT',
            performedBy: req.user.id,
            details: `Report sent to ${recipientType} ${recipientId} via ${channels ? channels.join(', ') : 'All Channels'}`,
          },
        },
      },
      include: {
        parameters: true,
        auditLogs: true,
        reportBranch: true,
        booking: {
          include: {
            user: { select: { name: true, mobile: true, email: true } },
            branch: true,
          },
        },
      },
    });

    await prisma.booking.update({
      where: { id: report.bookingId },
      data: { status: 'COMPLETED' },
    });

    // In-app push notification
    const targetUserId = (recipientType === 'USER' && recipientId) ? recipientId : released.booking.userId;
    if (targetUserId) {
      sendNotificationToUser(
        targetUserId,
        'Report Ready & Sent',
        'Your diagnostic report has been finalized and sent. You can download it directly from the portal.',
        'REPORT_SENT',
        { bookingId: report.bookingId, reportId: report.id }
      ).catch(console.error);
    }

    // Build multi-channel delivery details
    const patientName = (report.booking as any)?.patientName || report.booking?.user?.name || 'Valued Patient';
    const patientEmail = (report.booking as any)?.patientEmail || report.booking?.user?.email || '';
    const patientMobile = (report.booking as any)?.patientMobile || report.booking?.user?.mobile || '';
    const bookingCode = (report.booking as any)?.bookingCode || report.id.slice(0, 8);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verificationUrl = `${frontendUrl}/verify-report/${report.id}`;

    const testNames: string[] = [];
    if (report.booking?.tests && report.booking.tests.length > 0) {
      report.booking.tests.forEach((t: any) => {
        if (t.test?.name) testNames.push(t.test.name);
      });
    }
    if (report.booking?.packages && report.booking.packages.length > 0) {
      report.booking.packages.forEach((p: any) => {
        if (p.package?.name) testNames.push(p.package.name);
      });
    }
    if (testNames.length === 0 && report.testName) {
      testNames.push(report.testName);
    }

    const deliveryDetails: ReportDeliveryDetails = {
      patientName,
      patientEmail,
      patientMobile,
      testNames,
      reportId: report.id,
      bookingCode,
      reportedDate: (report.reportedDate || new Date()).toISOString(),
      doctorName: report.doctorName || 'Dr. Aditya Tayal',
      branchName: report.reportBranch?.name || report.booking?.branch?.name || 'MedsSeva Reference Lab',
      verificationUrl,
      pdfUrl: report.pdfUrl || null,
    };

    const targetChannels: string[] = Array.isArray(channels) && channels.length > 0
      ? channels
      : ['EMAIL', 'SMS', 'WHATSAPP'];

    const channelResults: Record<string, any> = {};

    // 1. Email with PDF attachment
    if (targetChannels.includes('EMAIL') && patientEmail) {
      try {
        await sendReportEmail(patientEmail, deliveryDetails);
        channelResults.email = { sent: true, recipient: patientEmail };
        await prisma.reportAuditLog.create({
          data: {
            reportId: report.id,
            action: 'EMAIL_SENT',
            performedBy: req.user.id,
            details: `Official report PDF sent to email: ${patientEmail}`,
          },
        });
      } catch (err: any) {
        console.warn('[Report Email Dispatch Failed]', err.message);
        channelResults.email = { sent: false, error: err.message, recipient: patientEmail };
      }
    }

    // 2. SMS with verification link
    if (targetChannels.includes('SMS') && patientMobile) {
      try {
        const smsRes = await sendReportSMS(patientMobile, deliveryDetails);
        channelResults.sms = { sent: smsRes.sent, recipient: patientMobile, error: smsRes.error };
        if (smsRes.sent) {
          await prisma.reportAuditLog.create({
            data: {
              reportId: report.id,
              action: 'SMS_SENT',
              performedBy: req.user.id,
              details: `Verification link sent via SMS to: ${patientMobile}`,
            },
          });
        }
      } catch (err: any) {
        console.warn('[Report SMS Dispatch Failed]', err.message);
        channelResults.sms = { sent: false, error: err.message, recipient: patientMobile };
      }
    }

    // 3. WhatsApp with verification link & PDF
    if (targetChannels.includes('WHATSAPP') && patientMobile) {
      try {
        const waRes = await sendReportWhatsApp(patientMobile, deliveryDetails);
        channelResults.whatsapp = { sent: waRes.sent, shareUrl: waRes.shareUrl, recipient: patientMobile };
        await prisma.reportAuditLog.create({
          data: {
            reportId: report.id,
            action: 'WHATSAPP_SENT',
            performedBy: req.user.id,
            details: `Report notification shared via WhatsApp to: ${patientMobile}`,
          },
        });
      } catch (err: any) {
        console.warn('[Report WhatsApp Dispatch Failed]', err.message);
        channelResults.whatsapp = { sent: false, error: err.message, recipient: patientMobile };
      }
    }

    res.json({
      success: true,
      channels: channelResults,
      report: released,
    });
  } catch (error: any) {
    console.error('Failed to send report:', error);
    res.status(500).json({ error: 'Failed to send report', details: error.message });
  }
};

export const verifyReport = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const report = await prisma.report.update({
      where: { id },
      data: {
        status: 'PENDING_VERIFICATION',
        verifiedById: req.user.id,
        verifiedAt: new Date(),
        auditLogs: {
          create: {
            action: 'SUBMITTED_FOR_REVIEW',
            performedBy: req.user.id,
            details: 'Report submitted for clinical review',
          },
        },
      },
      include: { parameters: true, auditLogs: true },
    });

    res.json(report);
  } catch (error: any) {
    console.error('Failed to verify report:', error);
    res.status(500).json({ error: 'Failed to verify report', details: error.message });
  }
};

export const savePdfUrl = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { pdfUrl, pdfPublicId } = req.body;

    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    if (!pdfUrl || !pdfPublicId) {
      return res.status(400).json({ error: 'pdfUrl and pdfPublicId are required' });
    }

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const updated = await prisma.report.update({
      where: { id },
      data: {
        pdfUrl,
        pdfPublicId,
        pdfUploadedAt: new Date(),
        auditLogs: {
          create: {
            action: 'PDF_UPLOADED',
            performedBy: req.user.id,
            details: `Finalized PDF uploaded to Cloudinary`,
          },
        },
      },
      include: {
        parameters: true,
        auditLogs: true,
        reportBranch: true,
        booking: {
          include: {
            user: { select: { name: true, mobile: true, email: true } },
            branch: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Failed to save PDF URL:', error);
    res.status(500).json({ error: 'Failed to save PDF URL', details: error.message });
  }
};

export const getMyReports = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, mobile: true },
    });

    const userMobile = currentUser?.mobile || (req.user as any)?.mobile;

    const reports = await prisma.report.findMany({
      where: {
        status: { in: ['PUBLISHED', 'VERIFIED'] },
        OR: [
          { booking: { userId: req.user.id } },
          { recipientId: req.user.id },
          ...(userMobile ? [
            { booking: { patientMobile: userMobile } },
            { booking: { user: { mobile: userMobile } } },
          ] : []),
        ],
      },
      include: {
        parameters: true,
        booking: {
          include: {
            tests: { include: { test: true } },
            packages: { include: { package: true } },
            branch: true,
            payment: true,
          },
        },
      },
      orderBy: { reportedDate: 'desc' },
    });

    res.json(reports);
  } catch (error: any) {
    console.error('Failed to fetch reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports', details: error.message });
  }
};

export const uploadReportPdf = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const { secure_url, public_id } = await uploadToCloudinary(req.file.buffer, req.file.originalname, req.file.mimetype, 'medseva/reports');

    const updated = await prisma.report.update({
      where: { id },
      data: {
        pdfUrl: secure_url,
        pdfPublicId: public_id,
        pdfUploadedAt: new Date(),
        auditLogs: {
          create: {
            action: 'PDF_UPLOADED',
            performedBy: req.user.id,
            details: `Finalized PDF uploaded to Cloudinary`,
          },
        },
      },
      include: {
        parameters: true,
        auditLogs: true,
        reportBranch: true,
        booking: {
          include: {
            user: { select: { name: true, mobile: true, email: true } },
            branch: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Failed to upload report PDF:', error);
    res.status(500).json({ error: 'Failed to upload report PDF', details: error.message });
  }
};

export const getPublicReportVerification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        parameters: true,
        verifiedBy: { select: { name: true } },
        reportBranch: true,
        booking: {
          include: {
            user: { select: { name: true } },
            tests: { include: { test: true } },
            packages: { include: { package: true } },
            branch: true,
          },
        },
      },
    });

    if (!report) {
      return res.status(404).json({ error: 'Lab report not found or invalid QR code.' });
    }

    const maskName = (name: string) => {
      if (!name) return 'Patient';
      return name
        .split(' ')
        .map(part => {
          if (part.length <= 1) return part;
          return part[0] + '*'.repeat(part.length - 1);
        })
        .join(' ');
    };

    const patientName = report.booking?.patientName || report.booking?.user?.name || 'Patient';
    const maskedName = maskName(patientName);

    const testNames: string[] = [];
    if (report.booking?.tests && report.booking.tests.length > 0) {
      report.booking.tests.forEach((t: any) => {
        if (t.test?.name) testNames.push(t.test.name);
      });
    }
    if (report.booking?.packages && report.booking.packages.length > 0) {
      report.booking.packages.forEach((p: any) => {
        if (p.package?.name) testNames.push(p.package.name);
      });
    }
    if (testNames.length === 0 && report.testName) {
      testNames.push(report.testName);
    }

    const branch = resolveReportBranch(report) || report.reportBranch || report.booking?.branch;

    res.json({
      verified: true,
      reportId: report.id,
      bookingCode: report.booking?.bookingCode || report.id.slice(0, 8),
      patientName: maskedName,
      patientAge: report.booking?.patientAge ?? null,
      patientGender: report.booking?.patientGender || null,
      doctorName: report.doctorName || report.verifiedBy?.name || 'Dr. Aditya Tayal',
      doctorQualification: report.doctorQualification || 'MD, DNB (Pathology)',
      doctorDesignation: report.doctorDesignation || 'Chief of Laboratory',
      status: report.status,
      reportedDate: report.reportedDate,
      branchName: branch?.name || 'MedsSeva Central Reference Lab',
      branchCity: branch?.city || 'Delhi NCR',
      tests: testNames,
      pdfUrl: report.pdfUrl || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to verify lab report', details: error.message });
  }
};