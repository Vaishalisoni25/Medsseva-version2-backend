import { Request, Response } from 'express';
import { prescriptionService } from '../services/prescription.service';
import { uploadToCloudinary } from '../middlewares/upload';
import { PrescriptionStatus } from '@prisma/client';

export const prescriptionController = {
async upload(req: Request, res: Response) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: 'No file uploaded.' });
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized.' });
      }

      const { secure_url, public_id } = await uploadToCloudinary(file.buffer, file.originalname, file.mimetype);

      const ext = (file.originalname.split('.').pop() || '').toLowerCase();
      const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
      const fileType = isImage ? 'IMAGE' : ext.toUpperCase();

      const prescription = await prescriptionService.create({
        userId,
        bookingId: req.body.bookingId || undefined,
        fileUrl: secure_url,
        publicId: public_id,
        originalFileName: file.originalname,
        fileType,
        mimeType: file.mimetype,
        fileSize: file.size,
        notes: req.body.notes || undefined,
      });

      return res.status(201).json({ success: true, data: prescription });
    } catch (error: any) {
      if (error.message?.startsWith('INVALID_FILE_TYPE:')) {
        return res.status(400).json({ message: error.message.split(':')[1] });
      }
      return res.status(500).json({ message: 'Upload failed. Please try again.' });
    }
  },

  async getMyPrescriptions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const data = await prescriptionService.getMyPrescriptions(userId);
      return res.json({ success: true, data });
    } catch {
      return res.status(500).json({ message: 'Failed to fetch prescriptions.' });
    }
  },

  async getAllForAdmin(req: Request, res: Response) {
    try {
      const { status, search, sort } = req.query;
      const data = await prescriptionService.getAllForAdmin({
        status: status as PrescriptionStatus | undefined,
        search: search as string | undefined,
        sortOrder: sort === 'asc' ? 'asc' : 'desc',
      });
      return res.json({ success: true, data });
    } catch {
      return res.status(500).json({ message: 'Failed to fetch prescriptions.' });
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ['PENDING', 'UNDER_REVIEW', 'REVIEWED', 'COMPLETED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value.' });
      }
      const updated = await prescriptionService.updateStatus(id, status as PrescriptionStatus);
      return res.json({ success: true, data: updated });
    } catch {
      return res.status(500).json({ message: 'Failed to update status.' });
    }
  },

  async deletePrescription(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      const prescription = await prescriptionService.getById(id);
      if (!prescription) {
        return res.status(404).json({ message: 'Prescription not found.' });
      }

      const isOwner = prescription.userId === userId;
      const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized to delete this prescription.' });
      }

      if (isOwner && !isAdmin && prescription.status !== 'PENDING') {
        return res.status(403).json({ message: 'Cannot delete a prescription that is under review or beyond.' });
      }

      await prescriptionService.deleteById(id);
      return res.json({ success: true, message: 'Prescription deleted.' });
    } catch {
      return res.status(500).json({ message: 'Failed to delete prescription.' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      const prescription = await prescriptionService.getById(id);
      if (!prescription) {
        return res.status(404).json({ message: 'Prescription not found.' });
      }

      const isOwner = prescription.userId === userId;
      const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Not authorized.' });
      }

      return res.json({ success: true, data: prescription });
    } catch {
      return res.status(500).json({ message: 'Failed to fetch prescription.' });
    }
  },
};