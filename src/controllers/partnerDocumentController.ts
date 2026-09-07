import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { uploadToCloudinary } from '../middlewares/upload';

export const uploadPartnerOnboardingDocument = async (req: any, res: Response) => {
  try {
    const file = req.file;
    const { documentType, partnerId } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!documentType) {
      return res.status(400).json({ error: 'documentType is required' });
    }

    let fileUrl = '';
    try {
      const uploadRes = await uploadToCloudinary(file.buffer, file.originalname, file.mimetype, 'medseva/partner-documents');
      fileUrl = uploadRes.secure_url;
    } catch (cErr) {
      const base64 = file.buffer.toString('base64');
      fileUrl = `data:${file.mimetype};base64,${base64}`;
    }

    let targetPartnerId = partnerId;

    if (req.user?.id) {
      const p = await prisma.pathologyPartner.findUnique({ where: { userId: req.user.id } });
      if (p) targetPartnerId = p.id;
    }

    if (targetPartnerId) {
      const doc = await prisma.partnerDocument.upsert({
        where: {
          partnerId_documentType: {
            partnerId: targetPartnerId,
            documentType: documentType as any,
          }
        },
        create: {
          partnerId: targetPartnerId,
          documentType: documentType as any,
          fileName: file.originalname,
          fileUrl,
          mimeType: file.mimetype,
          fileSize: file.size,
          status: 'UPLOADED',
        },
        update: {
          fileName: file.originalname,
          fileUrl,
          mimeType: file.mimetype,
          fileSize: file.size,
          status: 'UPLOADED',
          rejectionReason: null,
          correctionReason: null,
          uploadedAt: new Date(),
        }
      });
      return res.json({ message: 'Document uploaded successfully', document: doc });
    }

    return res.json({
      message: 'Document processed',
      document: {
        documentType,
        fileName: file.originalname,
        fileUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
        status: 'UPLOADED',
        uploadedAt: new Date().toISOString(),
      }
    });
  } catch (error: any) {
    console.error('Upload partner document error:', error);
    res.status(500).json({ error: 'Failed to upload document', details: error.message });
  }
};

export const getPartnerOnboardingDocuments = async (req: any, res: Response) => {
  try {
    const partner = await prisma.pathologyPartner.findUnique({
      where: { userId: req.user.id },
      include: { documents: true }
    });
    if (!partner) return res.status(404).json({ error: 'Partner profile not found' });

    res.json({
      partnerId: partner.id,
      approvalStatus: partner.approvalStatus,
      rejectionReason: partner.rejectionReason,
      correctionReason: partner.correctionReason,
      documents: partner.documents,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch partner documents', details: error.message });
  }
};

export const updatePartnerDocumentStatusAdmin = async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    const { status, rejectionReason, correctionReason } = req.body;

    const validStatuses = ['VERIFIED', 'REJECTED', 'CORRECTION_REQUIRED', 'UNDER_REVIEW', 'UPLOADED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid document status' });
    }

    const doc = await prisma.partnerDocument.update({
      where: { id: docId },
      data: {
        status: status as any,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        correctionReason: status === 'CORRECTION_REQUIRED' ? correctionReason : null,
        verifiedAt: status === 'VERIFIED' ? new Date() : null,
        verifiedBy: (req as any).user?.id || 'ADMIN'
      }
    });

    res.json({ message: 'Document verification status updated', document: doc });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update document status', details: error.message });
  }
};
