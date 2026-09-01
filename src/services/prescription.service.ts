import { PrescriptionStatus } from '@prisma/client';
import { cloudinary } from '../config/cloudinary';
import { prisma } from '../lib/prisma';
export const prescriptionService = {
  async create(data: {
    userId: string;
    bookingId?: string;
    fileUrl: string;
    publicId: string;
    originalFileName: string;
    fileType: string;
    mimeType: string;
    fileSize: number;
    notes?: string;
  }) {
    return prisma.prescription.create({ data });
  },

  async getMyPrescriptions(userId: string) {
    return prisma.prescription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalFileName: true,
        fileUrl: true,
        fileType: true,
        fileSize: true,
        mimeType: true,
        notes: true,
        status: true,
        bookingId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async getById(id: string) {
    return prisma.prescription.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, mobile: true, email: true, uhid: true },
        },
      },
    });
  },

  async getAllForAdmin(filters: {
    status?: PrescriptionStatus;
    search?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { status, search, sortOrder = 'desc' } = filters;

    return prisma.prescription.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search
          ? {
              user: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { mobile: { contains: search, mode: 'insensitive' } },
                  { uhid: { contains: search, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      orderBy: { createdAt: sortOrder },
      include: {
        user: {
          select: { id: true, name: true, mobile: true, email: true, uhid: true },
        },
      },
    });
  },

  async updateStatus(id: string, status: PrescriptionStatus) {
    return prisma.prescription.update({ where: { id }, data: { status } });
  },

  async deleteById(id: string) {
    const prescription = await prisma.prescription.findUnique({ where: { id } });
    if (!prescription) throw new Error('NOT_FOUND');
    await cloudinary.uploader.destroy(prescription.publicId, { resource_type: 'raw' });
    return prisma.prescription.delete({ where: { id } });
  },
};