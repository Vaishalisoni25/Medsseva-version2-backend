import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getDoctors = async (req: Request, res: Response) => {
  try {
    const { branchId, cityId, partnerId, specialization, search } = req.query;

    const where: any = { isActive: true };

    if (branchId) {
      where.branchId = String(branchId);
    }
    if (cityId) {
      where.cityId = String(cityId);
    }
    if (partnerId) {
      where.partnerId = String(partnerId);
    }
    if (specialization) {
      where.specialization = { contains: String(specialization), mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { registrationNo: { contains: String(search), mode: 'insensitive' } },
        { qualification: { contains: String(search), mode: 'insensitive' } },
        { specialization: { contains: String(search), mode: 'insensitive' } },
        { designation: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const doctors = await (prisma as any).doctor.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
            code: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            role: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(doctors);
  } catch (error: any) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors', details: error.message });
  }
};

export const getDoctorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doctor = await (prisma as any).doctor.findUnique({
      where: { id },
      include: {
        branch: true,
        user: { select: { id: true, name: true, email: true, mobile: true } },
      },
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json(doctor);
  } catch (error: any) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({ error: 'Failed to fetch doctor', details: error.message });
  }
};

export const createDoctor = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      qualification,
      registrationNo,
      specialization = 'Pathology',
      designation = 'Senior Pathologist',
      photoUrl,
      signatureUrl,
      branchId,
      cityId,
      partnerId,
      userId,
    } = req.body;

    if (!name || !qualification || !registrationNo) {
      return res.status(400).json({ error: 'Name, Qualification, and Registration Number are required' });
    }

    const doctor = await (prisma as any).doctor.create({
      data: {
        name,
        qualification,
        registrationNo,
        specialization,
        designation,
        photoUrl: photoUrl || null,
        signatureUrl: signatureUrl || null,
        branchId: branchId || null,
        cityId: cityId || null,
        partnerId: partnerId || null,
        userId: userId || null,
        isActive: true,
      },
      include: { branch: true },
    });

    res.status(201).json(doctor);
  } catch (error: any) {
    console.error('Error creating doctor:', error);
    res.status(500).json({ error: 'Failed to create doctor', details: error.message });
  }
};

export const updateDoctor = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      qualification,
      registrationNo,
      specialization,
      designation,
      photoUrl,
      signatureUrl,
      branchId,
      cityId,
      partnerId,
      isActive,
    } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (qualification !== undefined) data.qualification = qualification;
    if (registrationNo !== undefined) data.registrationNo = registrationNo;
    if (specialization !== undefined) data.specialization = specialization;
    if (designation !== undefined) data.designation = designation;
    if (photoUrl !== undefined) data.photoUrl = photoUrl;
    if (signatureUrl !== undefined) data.signatureUrl = signatureUrl;
    if (branchId !== undefined) data.branchId = branchId;
    if (cityId !== undefined) data.cityId = cityId;
    if (partnerId !== undefined) data.partnerId = partnerId;
    if (isActive !== undefined) data.isActive = isActive;

    const doctor = await (prisma as any).doctor.update({
      where: { id },
      data,
      include: { branch: true },
    });

    res.json(doctor);
  } catch (error: any) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ error: 'Failed to update doctor', details: error.message });
  }
};

export const deleteDoctor = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await (prisma as any).doctor.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Doctor deactivated successfully' });
  } catch (error: any) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({ error: 'Failed to delete doctor', details: error.message });
  }
};
