import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getDoctors = async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, cityId, partnerId, specialization, search, status } = req.query;

    const isSuperAdmin = req.user?.isSuperAdmin || (req.user?.role || '').toUpperCase() === 'SUPER_ADMIN';
    const isAdmin = isSuperAdmin || (req.user?.role || '').toUpperCase() === 'ADMIN';
    const userBranchId = req.user?.branchId;

    const where: any = {};
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'pending' || status === 'inactive') {
      where.isActive = false;
    } else if (!status && !isAdmin) {
      where.isActive = true;
    }

    if (!isSuperAdmin && userBranchId) {
      where.branchId = userBranchId;
    } else if (branchId) {
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

    const targetBranchId = branchId || (!req.user?.isSuperAdmin ? req.user?.branchId : null) || null;

    const doctor = await (prisma as any).doctor.create({
      data: {
        name,
        qualification,
        registrationNo,
        specialization,
        designation,
        photoUrl: photoUrl || null,
        signatureUrl: signatureUrl || null,
        branchId: targetBranchId,
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

export const createDoctorSamplePickupRequest = async (req: AuthRequest, res: Response) => {
  try {
    const doctorUserId = req.user?.id;
    if (!doctorUserId) {
      return res.status(401).json({ error: 'Unauthorized Doctor request' });
    }
    const { patientName, patientMobile, patientAge, patientGender, testIds, address, latitude, longitude, notes } = req.body;

    if (!patientName || !patientMobile) {
      return res.status(400).json({ error: 'Patient name and mobile are required for sample pickup request' });
    }

    const bookingCode = `DOC-PU-${Date.now().toString().slice(-6)}`;

    // Create Home Collection booking entering main distribution engine (WAITING_FOR_PARTNER)
    const booking = await prisma.booking.create({
      data: {
        bookingCode,
        userId: doctorUserId,
        patientName,
        patientMobile,
        patientAge: patientAge ? Number(patientAge) : null,
        patientGender: patientGender || null,
        scheduledDate: new Date(),
        scheduledSlot: 'ASAP Pickup',
        totalPaid: 0,
        collectionMode: 'HOME',
        status: 'WAITING_FOR_PARTNER',
        partnerNote: notes ? `Doctor Pickup Request: ${notes}` : 'Doctor Clinic Sample Pickup Request',
        addressId: address || 'Doctor Clinic Location',
      }
    });

    res.status(201).json({
      message: 'Sample pickup request created successfully and broadcast to nearby collection partners',
      booking
    });
  } catch (error: any) {
    console.error('Error creating doctor sample pickup request:', error);
    res.status(500).json({ error: 'Failed to create sample pickup request', details: error.message });
  }
};

export const doctorDirectSampleHandover = async (req: AuthRequest, res: Response) => {
  try {
    const doctorUserId = req.user?.id;
    if (!doctorUserId) {
      return res.status(401).json({ error: 'Unauthorized Doctor request' });
    }
    const { targetBranchId, patientName, patientMobile, sampleType, notes } = req.body;

    if (!targetBranchId || !patientName) {
      return res.status(400).json({ error: 'Target branch ID and patient name are required' });
    }

    const bookingCode = `DOC-HO-${Date.now().toString().slice(-6)}`;

    const booking = await prisma.booking.create({
      data: {
        bookingCode,
        userId: doctorUserId,
        patientName,
        patientMobile: patientMobile || null,
        scheduledDate: new Date(),
        scheduledSlot: 'Direct Handover',
        totalPaid: 0,
        collectionMode: 'LAB',
        branchId: targetBranchId,
        status: 'DELIVERED_TO_LAB',
        partnerNote: notes ? `Doctor Direct Handover: ${notes}` : 'Direct Doctor Sample Handover',
        addressId: 'Direct Lab Handover',
      }
    });

    const accessionNumber = `SMP-HO-${bookingCode.slice(-6)}`;
    const sample = await prisma.sample.create({
      data: {
        bookingId: booking.id,
        accessionNumber,
        sampleType: sampleType || 'Blood / Serum',
        receivedById: doctorUserId,
        notes: notes || 'Handed over directly by Doctor',
        status: 'RECEIVED',
        branchId: targetBranchId,
      }
    });

    res.status(201).json({
      message: 'Sample handed over to target lab branch successfully',
      booking,
      sample
    });
  } catch (error: any) {
    console.error('Error in doctorDirectSampleHandover:', error);
    res.status(500).json({ error: 'Failed to complete direct sample handover', details: error.message });
  }
};
