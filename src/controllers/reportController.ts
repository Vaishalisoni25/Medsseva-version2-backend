import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { autoConsumeForTest } from './inventoryController';
import { sendNotificationToUser } from '../services/notification.service';
import { prisma } from '../lib/prisma';
import { uploadToCloudinary } from '../middlewares/upload';

export const getBookingsForReport = async (req: AuthRequest, res: Response) => {
  try {
    const { branchId } = req.query;
    const where: any = {
      status: { notIn: ['CANCELLED', 'PENDING'] },
    };

    if (!req.user?.isSuperAdmin && req.user?.branchId) {
      where.branchId = req.user.branchId;
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
        return { ...b, address };
      })
    );

    res.json(withAddress);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch bookings for report', details: error.message });
  }
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
            user: { select: { name: true, mobile: true, email: true } },
            tests: { include: { test: true } },
            packages: { include: { package: true } },
            branch: true,
            assignedPartner: { include: { user: { select: { name: true } } } },
          },
        },
        auditLogs: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { reportedDate: 'desc' },
    });
    res.json(reports);
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
            user: { select: { name: true, mobile: true, email: true } },
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
          },
        },
        auditLogs: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch report', details: error.message });
  }
};


export const createReport = async (req: AuthRequest, res: Response) => {
  try {
    const {
      bookingId, testName, clinicalNotes, technicianRemarks, doctorRemarks, internalNotes,
      parameters, recipientType, recipientId,
      reportBranchId, doctorName, doctorQualification, doctorRegNo, doctorDesignation, doctorVerifiedAt,
    } = req.body;

    const existing = await prisma.report.findUnique({ where: { bookingId } });
    if (existing) {
      return res.status(400).json({ error: 'A report already exists for this booking. Use the update endpoint.' });
    }

    const hasAbnormal = parameters.some((p: any) => p.isAbnormal);

    const report = await prisma.report.create({
      data: {
        bookingId,
        testName,
        clinicalNotes,
        technicianRemarks: technicianRemarks || null,
        doctorRemarks: doctorRemarks || null,
        internalNotes: internalNotes || null,
        status: 'DRAFT',
        hasAbnormalFlags: hasAbnormal,
        recipientType: recipientType || 'USER',
        recipientId: recipientId || null,
        reportBranchId: reportBranchId || null,
        doctorName: doctorName || null,
        doctorQualification: doctorQualification || null,
        doctorRegNo: doctorRegNo || null,
        doctorDesignation: doctorDesignation || null,
        doctorVerifiedAt: doctorVerifiedAt ? new Date(doctorVerifiedAt) : null,
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

    res.status(201).json(report);
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
      reportBranchId, doctorName, doctorQualification, doctorRegNo, doctorDesignation, doctorVerifiedAt,
    } = req.body;

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.status === 'APPROVED' || report.status === 'RELEASED') {
      return res.status(400).json({ error: 'Cannot edit a finalized report' });
    }

    await prisma.reportResult.deleteMany({ where: { reportId: id } });

    const hasAbnormal = parameters.some((p: any) => p.isAbnormal);

    const updated = await prisma.report.update({
      where: { id },
      data: {
        clinicalNotes,
        technicianRemarks: technicianRemarks || null,
        doctorRemarks: doctorRemarks || null,
        internalNotes: internalNotes || null,
        hasAbnormalFlags: hasAbnormal,
        reportBranchId: reportBranchId || null,
        doctorName: doctorName || null,
        doctorQualification: doctorQualification || null,
        doctorRegNo: doctorRegNo || null,
        doctorDesignation: doctorDesignation || null,
        doctorVerifiedAt: doctorVerifiedAt ? new Date(doctorVerifiedAt) : null,
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

    res.json(updated);
  } catch (error: any) {
    console.error('Failed to update report draft:', error);
    res.status(500).json({ error: 'Failed to update draft', details: error.message });
  }
};
export const finalizeReport = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const report = await prisma.report.findUnique({
      where: { id },
      include: { parameters: true },
    });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.parameters.length === 0) {
      return res.status(400).json({ error: 'Cannot finalize a report with no parameters entered' });
    }
    if (report.status === 'APPROVED' || report.status === 'RELEASED') {
      return res.status(400).json({ error: 'Report is already finalized' });
    }

const finalized = await prisma.report.update({
      where: { id },
      data: {
        status: 'APPROVED',
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
      include: { parameters: true, auditLogs: true, booking: true },
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
    res.json(finalized);
  } catch (error: any) {
    console.error('Failed to finalize report:', error);
    res.status(500).json({ error: 'Failed to finalize report', details: error.message });
  }
};

export const sendReport = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { recipientType, recipientId } = req.body;

    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    if (!recipientType || !recipientId) {
      return res.status(400).json({ error: 'recipientType and recipientId are required' });
    }

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.status !== 'APPROVED' && report.status !== 'RELEASED') {
      return res.status(400).json({ error: 'Only finalized reports can be sent' });
    }

    const released = await prisma.report.update({
      where: { id },
      data: {
        status: 'RELEASED',
        recipientType,
        recipientId,
        auditLogs: {
          create: {
            action: 'REPORT_SENT',
            performedBy: req.user.id,
            details: `Report sent to ${recipientType} ${recipientId}`,
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

const bookingForSend = await prisma.booking.findUnique({
      where: { id: report.bookingId },
      select: { collectionMode: true },
    });
    await prisma.booking.update({
      where: { id: report.bookingId },
      data: { status: 'COMPLETED' },
    });
    const targetUserId = (recipientType === 'USER' && recipientId) ? recipientId : released.booking.userId;
    if (targetUserId) {
      sendNotificationToUser(
        targetUserId,
        'Report Sent',
        'Your report has been sent. You can download it from the Reports tab.',
        'REPORT_SENT',
        { bookingId: report.bookingId }
      ).catch(console.error);
    }

    res.json(released);
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
        status: 'UNDER_REVIEW',
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
        status: { in: ['RELEASED', 'APPROVED'] },
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