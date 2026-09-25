import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { cloudinary } from '../config/cloudinary';
import { uploadFileToStorage } from '../middlewares/upload';
import { triggerApprovalNotification } from '../services/notification.service';

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
      const isPartner = await prisma.pathologyPartner.findUnique({ where: { id: String(branchId) } });
      if (isPartner) {
        where.partnerId = String(branchId);
      } else {
        where.branchId = String(branchId);
      }
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
      email,
      mobile,
      password,
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
      roleId,
      approvalStatus = 'PENDING',
      isActive = false,
      doctorType,
    } = req.body;

    if (!name || !qualification || !registrationNo) {
      return res.status(400).json({ error: 'Name, Qualification, and Registration Number are required' });
    }

    let finalBranchId = null;
    let finalPartnerId = partnerId || null;

    if (branchId) {
      const isBranch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (isBranch) {
        finalBranchId = branchId;
      } else {
        const isPartner = await prisma.pathologyPartner.findUnique({ where: { id: branchId } });
        if (isPartner) {
          finalPartnerId = branchId;
        } else {
          finalBranchId = branchId;
        }
      }
    } else {
      finalBranchId = (!req.user?.isSuperAdmin ? req.user?.branchId : null) || null;
      if (!finalBranchId && !req.user?.isSuperAdmin) {
        finalPartnerId = req.user?.partnerId || null;
      }
    }

    let finalUserId = userId;
    
    // Create User if email and password are provided (Admin flow)
    if (!finalUserId && email && password) {
      const cleanEmail = email.trim().toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existing) {
        return res.status(400).json({ error: 'Email is already registered' });
      }

      const cleanMobile = mobile ? mobile.trim() : undefined;
      if (cleanMobile) {
        const existingMobile = await prisma.user.findUnique({ where: { mobile: cleanMobile } });
        if (existingMobile) {
          return res.status(400).json({ error: 'Mobile number is already registered' });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          mobile: cleanMobile || `doc_${Date.now()}`,
          password: hashedPassword,
          role: 'DOCTOR',
        },
      });
      finalUserId = user.id;

      if (roleId) {
        await (prisma as any).adminUser.create({
          data: {
            userId: user.id,
            roleId,
            department: 'Pathology',
            designation,
            branchId: finalBranchId,
            partnerId: finalPartnerId,
            userType: 'DOCTOR',
            isActive: true,
          }
        });
      }
    }

    const doctorCode = `DOC-${Date.now().toString().slice(-6)}`;

    const doctor = await (prisma as any).doctor.create({
      data: {
        name,
        code: doctorCode,
        qualification,
        registrationNo,
        specialization,
        designation,
        photoUrl: photoUrl || null,
        signatureUrl: signatureUrl || null,
        branchId: finalBranchId,
        cityId: cityId || null,
        partnerId: finalPartnerId,
        userId: finalUserId || null,
        approvalStatus,
        isActive,
        doctorType: (req.body as any).doctorType || 'EMPLOYEE',
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
      approvalStatus,
      rejectionReason,
      commissionRate,
      paymentCycle,
      password,
      doctorType,
    } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (qualification !== undefined) data.qualification = qualification;
    if (registrationNo !== undefined) data.registrationNo = registrationNo;
    if (specialization !== undefined) data.specialization = specialization;
    if (designation !== undefined) data.designation = designation;
    if (photoUrl !== undefined) data.photoUrl = photoUrl;
    if (signatureUrl !== undefined) data.signatureUrl = signatureUrl;
    
    if (branchId !== undefined) {
      if (!branchId) {
        data.branchId = null;
        data.partnerId = null;
      } else {
        const isBranch = await prisma.branch.findUnique({ where: { id: branchId } });
        if (isBranch) {
          data.branchId = branchId;
          data.partnerId = null;
        } else {
          const isPartner = await prisma.pathologyPartner.findUnique({ where: { id: branchId } });
          if (isPartner) {
            data.partnerId = branchId;
            data.branchId = null;
          } else {
            data.branchId = branchId;
          }
        }
      }
    } else if (partnerId !== undefined) {
      data.partnerId = partnerId;
    }
    
    if (cityId !== undefined) data.cityId = cityId;
    if (isActive !== undefined) data.isActive = isActive;
    if (approvalStatus !== undefined) data.approvalStatus = approvalStatus;
    if (rejectionReason !== undefined) data.rejectionReason = rejectionReason;
    if (commissionRate !== undefined) data.commissionRate = Number(commissionRate);
    if (paymentCycle !== undefined) data.paymentCycle = paymentCycle;
    if (doctorType !== undefined) data.doctorType = doctorType;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      data.password = hashedPassword;
    }

    const previousDoctor = await (prisma as any).doctor.findUnique({ where: { id } });
    if (!previousDoctor) return res.status(404).json({ error: 'Doctor not found' });

    const doctor = await (prisma as any).doctor.update({
      where: { id },
      data,
      include: { branch: true },
    });

    if (doctor.userId) {
      const userUpdates: any = {};
      if (name !== undefined) userUpdates.name = name;
      if (password) {
        userUpdates.password = data.password;
      }
      if (isActive !== undefined) {
        userUpdates.isActive = isActive;
      }
      if (Object.keys(userUpdates).length > 0) {
        await prisma.user.update({
          where: { id: doctor.userId },
          data: userUpdates,
        }).catch(console.error);
      }
      if (isActive !== undefined) {
        await prisma.adminUser.updateMany({
          where: { userId: doctor.userId },
          data: { isActive },
        }).catch(console.error);
      }

      const isApprovedNow = (data.approvalStatus === 'APPROVED' || (data.isActive === true && data.approvalStatus !== 'REJECTED' && data.approvalStatus !== 'SUSPENDED'));
      const wasApprovedBefore = (previousDoctor.approvalStatus === 'APPROVED' && previousDoctor.isActive === true);

      if (isApprovedNow && !wasApprovedBefore) {
        triggerApprovalNotification(doctor.userId, 'Doctor').catch(console.error);
      }
    }

    res.json(doctor);
  } catch (error: any) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ error: 'Failed to update doctor', details: error.message });
  }
};

// Update own profile for Doctor portal
export const updateDoctorProfileSelf = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { commissionRate, paymentCycle, designation, qualification, specialization } = req.body;

    const doctor = await prisma.doctor.findFirst({
      where: {
        OR: [{ userId }, { id: userId }],
      },
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const dataToUpdate: any = {};
    if (commissionRate !== undefined) dataToUpdate.commissionRate = Number(commissionRate);
    if (paymentCycle) dataToUpdate.paymentCycle = paymentCycle;
    if (designation !== undefined) dataToUpdate.designation = designation;
    if (qualification !== undefined) dataToUpdate.qualification = qualification;
    if (specialization !== undefined) dataToUpdate.specialization = specialization;

    const updated = await prisma.doctor.update({
      where: { id: doctor.id },
      data: dataToUpdate,
    });

    res.json({ success: true, doctor: updated });
  } catch (error) {
    console.error('Error updating doctor profile (self):', error);
    res.status(500).json({ error: 'Failed to update profile' });
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
      console.log('--- PICKUP REQUEST ---', JSON.stringify(req.body));
      const doctorUserId = req.user?.id;
      if (!doctorUserId) {
        return res.status(401).json({ error: 'Unauthorized Doctor request' });
      }
      const { patientName, patientMobile, patientAge, patientGender, testIds = [], packageIds = [], address, latitude, longitude, notes } = req.body;
  
      if (!patientName || !patientMobile) {
        return res.status(400).json({ error: 'Patient name and mobile are required for sample pickup request' });
      }
  
      const doctor = await (prisma as any).doctor.findFirst({
        where: { OR: [{ userId: doctorUserId }, { id: doctorUserId }] },
      });
  
      let totalBilled = 0;
      if (Array.isArray(testIds) && testIds.length > 0) {
        const tests = await prisma.test.findMany({ where: { id: { in: testIds } } });
        totalBilled += tests.reduce((sum, t) => sum + (t.price || 0), 0);
      }
      if (Array.isArray(packageIds) && packageIds.length > 0) {
        const pkgs = await prisma.healthPackage.findMany({ where: { id: { in: packageIds } } });
        totalBilled += pkgs.reduce((sum, p) => sum + (p.price || 0), 0);
      }
  
      let finalAddressId = null;
      if (address && address !== 'Doctor Clinic Location') {
        // Create an address record for accurate radius calculations
        const newAddr = await prisma.address.create({
          data: {
            userId: doctorUserId,
            type: 'CLINIC',
            line1: address,
            city: 'Unknown',
            state: 'Unknown',
            pincode: '000000',
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null,
          }
        });
        finalAddressId = newAddr.id;
      }
  
      const bookingCode = `DOC-PU-${Date.now().toString().slice(-6)}`;
  
      // Create Home Collection booking entering main distribution engine (WAITING_FOR_PARTNER)
      const booking = await prisma.booking.create({
        data: {
          bookingCode,
          userId: doctorUserId,
          referringDoctorId: doctor?.id || null,
          branchId: doctor?.branchId || null,
          patientName,
          patientMobile,
          patientAge: patientAge ? Number(patientAge) : null,
          patientGender: patientGender || null,
          scheduledDate: new Date(),
          scheduledSlot: 'ASAP Pickup',
          totalPaid: totalBilled,
          collectionMode: 'HOME',
          status: 'WAITING_FOR_PARTNER',
          partnerNote: notes ? `Doctor Pickup Request: ${notes}` : 'Doctor Clinic Sample Pickup Request',
          addressId: finalAddressId,
          ...(Array.isArray(testIds) && testIds.length > 0 ? {
            tests: {
              create: testIds.map((tid: string) => ({ testId: tid }))
            }
          } : {}),
          ...(Array.isArray(packageIds) && packageIds.length > 0 ? {
            packages: {
              create: packageIds.map((pid: string) => ({ packageId: pid }))
            }
          } : {})
        },
        include: {
          tests: { include: { test: true } },
          packages: { include: { package: true } }
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
    const { targetBranchId, patientName, patientMobile, patientAge, patientGender, testIds = [], packageIds = [], address, latitude, longitude, sampleType, notes } = req.body;

    if (!targetBranchId || !patientName) {
      return res.status(400).json({ error: 'Target branch ID and patient name are required' });
    }

    const doctor = await (prisma as any).doctor.findFirst({
      where: { OR: [{ userId: doctorUserId }, { id: doctorUserId }] },
    });

    let totalBilled = 0;
    if (Array.isArray(testIds) && testIds.length > 0) {
      const tests = await prisma.test.findMany({ where: { id: { in: testIds } } });
      totalBilled += tests.reduce((sum, t) => sum + (t.price || 0), 0);
    }
    if (Array.isArray(packageIds) && packageIds.length > 0) {
      const pkgs = await prisma.healthPackage.findMany({ where: { id: { in: packageIds } } });
      totalBilled += pkgs.reduce((sum, p) => sum + (p.price || 0), 0);
    }

    let finalAddressId = null;
    if (address && address !== 'Direct Lab Handover') {
      const newAddr = await prisma.address.create({
        data: {
          userId: doctorUserId,
          type: 'CLINIC',
          line1: address,
          city: 'Unknown',
          state: 'Unknown',
          pincode: '000000',
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
        }
      });
      finalAddressId = newAddr.id;
    }

    const bookingCode = `DOC-HO-${Date.now().toString().slice(-6)}`;

    const booking = await prisma.booking.create({
      data: {
        bookingCode,
        userId: doctorUserId,
        referringDoctorId: doctor?.id || null,
        patientName,
        patientMobile: patientMobile || null,
        patientAge: patientAge ? Number(patientAge) : null,
        patientGender: patientGender || null,
        scheduledDate: new Date(),
        scheduledSlot: 'Direct Handover',
        totalPaid: totalBilled,
        collectionMode: 'LAB',
        branchId: targetBranchId,
        status: 'DELIVERED_TO_LAB',
        partnerNote: notes ? `Doctor Direct Handover: ${notes}` : 'Direct Doctor Sample Handover',
        addressId: finalAddressId,
        ...(Array.isArray(testIds) && testIds.length > 0 ? {
          tests: {
            create: testIds.map((tid: string) => ({ testId: tid }))
          }
        } : {}),
        ...(Array.isArray(packageIds) && packageIds.length > 0 ? {
          packages: {
            create: packageIds.map((pid: string) => ({ packageId: pid }))
          }
        } : {})
      },
      include: {
        tests: { include: { test: true } },
        packages: { include: { package: true } }
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
      }
    });

    res.status(201).json({
      message: 'Direct sample handover registered. Sample marked as delivered to lab.',
      booking,
      sample
    });
  } catch (error: any) {
    console.error('Error registering direct sample handover:', error);
    res.status(500).json({ error: 'Failed to register sample handover', details: error.message });
  }
};

export const uploadDoctorSignature = async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No signature image file provided' });
    }

    const { doctorId } = req.body;
    const fileName = file.originalname || `signature_${doctorId || Date.now()}.png`;
    const result = await uploadFileToStorage(file.buffer, fileName, file.mimetype, 'medseva/signatures');

    const signatureUrl = result.secure_url;
    if (doctorId) {
      await (prisma as any).doctor.update({
        where: { id: doctorId },
        data: { signatureUrl },
      });
    }

    res.json({
      success: true,
      url: signatureUrl,
      publicId: result.public_id,
    });
  } catch (error: any) {
    console.error('Error uploading doctor signature:', error);
    res.status(500).json({ error: 'Signature upload failed', details: error.message });
  }
};
