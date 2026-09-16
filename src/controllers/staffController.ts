import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

// GET /api/staff
export const getStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { branchId, department, designation, search } = req.query;

    const isSuperAdmin = req.user?.isSuperAdmin || (req.user?.role || '').toUpperCase() === 'SUPER_ADMIN';
    const userBranchId = req.user?.branchId;

    const where: any = {
      userType: { in: ['STAFF', 'EMPLOYEE'] },
    };

    if (!isSuperAdmin && userBranchId) {
      where.branchId = userBranchId;
    } else if (branchId) {
      where.branchId = String(branchId);
    }

    if (department && department !== 'ALL') {
      where.department = String(department);
    }

    if (designation && designation !== 'ALL') {
      where.designation = String(designation);
    }

    if (search) {
      const q = String(search).toLowerCase();
      where.OR = [
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { mobile: { contains: q, mode: 'insensitive' } } },
        { department: { contains: q, mode: 'insensitive' } },
        { designation: { contains: q, mode: 'insensitive' } },
      ];
    }

    const staffList = await (prisma.adminUser as any).findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            role: true,
            createdAt: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(staffList);
  } catch (error: any) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff members', details: error.message });
  }
};

// GET /api/staff/:id
export const getStaffById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staff = await (prisma.adminUser as any).findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            role: true,
            createdAt: true,
          },
        },
        role: true,
        branch: true,
      },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json(staff);
  } catch (error: any) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({ error: 'Failed to fetch staff member', details: error.message });
  }
};

// POST /api/staff
export const createStaff = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      email,
      mobile,
      password,
      roleId,
      department,
      designation,
      branchId,
      franchiseId,
      userType = 'EMPLOYEE',
    } = req.body;

    console.log('[CREATE STAFF] Request received:', JSON.stringify({ name, email, department, designation, branchId }));

    if (!name || !email) {
      return res.status(400).json({ error: 'Full Name and Email are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(400).json({ error: 'Email is already registered in the system' });
    }

    // Auto-resolve branch
    const isSuperAdmin = req.user?.isSuperAdmin || (req.user?.role || '').toUpperCase() === 'SUPER_ADMIN';
    const targetBranchId = branchId || (!isSuperAdmin ? req.user?.branchId : null) || null;

    const isPhlebo =
      (designation && /phlebotomist|collector|phlebo/i.test(designation)) ||
      (department && /phlebotom|sample collection/i.test(department));

    // Find a valid role for staff
    let effectiveRoleId = roleId;
    let role = null;
    if (effectiveRoleId) {
      role = await prisma.adminRole.findUnique({ where: { id: effectiveRoleId } });
    }
    if (isPhlebo) {
      let execRole = await prisma.adminRole.findFirst({ where: { slug: 'executive' } });
      if (!execRole) {
        execRole = await prisma.adminRole.create({
          data: { name: 'Executive', slug: 'executive', description: 'Sample Collection Executive / Phlebotomist', isSystem: true }
        });
      }
      role = execRole;
      effectiveRoleId = execRole.id;
    } else if (!role) {
      role = await prisma.adminRole.findFirst({
        where: {
          slug: { in: ['staff', 'employee', 'lab_department', 'executive', 'admin'] },
        },
      }) || await prisma.adminRole.findFirst();
      effectiveRoleId = role?.id;
    }

    if (!role || !effectiveRoleId) {
      return res.status(400).json({ error: 'No default staff role found in system. Please contact administrator.' });
    }

    const effectivePassword = password || 'MedsSeva@123';
    const hashedPassword = await bcrypt.hash(effectivePassword, 10);
    const cleanMobile = mobile?.trim() || `staff_${Date.now()}`;

    if (mobile?.trim()) {
      const existingMobile = await prisma.user.findUnique({ where: { mobile: cleanMobile } });
      if (existingMobile) {
        return res.status(400).json({ error: 'Mobile number is already registered' });
      }
    }

    const userRole = isPhlebo ? 'EXECUTIVE' : 'ADMIN';

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        mobile: cleanMobile,
        password: hashedPassword,
        role: userRole,
      },
    });

    const staff = await (prisma.adminUser as any).create({
      data: {
        userId: user.id,
        roleId: effectiveRoleId,
        franchiseId: franchiseId || null,
        department: department || (isPhlebo ? 'Sample Collection (Phlebotomy)' : 'Pathology Lab'),
        designation: designation || (isPhlebo ? 'Phlebotomist / Sample Collector' : 'Lab Technician'),
        branchId: targetBranchId,
        userType: isPhlebo ? 'STAFF' : (userType || 'EMPLOYEE'),
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            role: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            city: true,
            code: true,
          },
        },
      },
    });

    if (isPhlebo) {
      await prisma.pathologyPartner.upsert({
        where: { userId: user.id },
        update: {
          labName: `${user.name} (Phlebotomist)`,
          role: 'PHLEBOTOMIST',
          approvalStatus: 'APPROVED',
          isAvailable: true,
          branchId: targetBranchId,
        },
        create: {
          userId: user.id,
          labName: `${user.name} (Phlebotomist)`,
          role: 'PHLEBOTOMIST',
          partnerCode: `PHLEBO-${user.id.slice(0, 5).toUpperCase()}`,
          address: department || 'Sample Collection (Phlebotomy)',
          approvalStatus: 'APPROVED',
          commissionRate: 15,
          paymentCycle: 'WEEKLY',
          isAvailable: true,
          branchId: targetBranchId,
        },
      }).catch(err => console.warn('Pathology partner creation for phlebotomist staff non-fatal:', err.message));
    }

    console.log('[CREATE STAFF] Success! Registered staff:', staff.id, 'Branch:', targetBranchId);
    res.status(201).json(staff);
  } catch (error: any) {
    console.error('Error creating staff:', error);
    res.status(500).json({ error: 'Failed to create staff member', details: error.message });
  }
};

// PUT /api/staff/:id
export const updateStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      mobile,
      password,
      roleId,
      department,
      designation,
      branchId,
      franchiseId,
      isActive,
    } = req.body;

    const existingStaff = await (prisma.adminUser as any).findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existingStaff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Update user record if name/email/mobile changed
    const userData: any = {};
    if (name) userData.name = name.trim();
    if (email) userData.email = email.trim().toLowerCase();
    if (mobile) userData.mobile = mobile.trim();
    if (password) userData.password = await bcrypt.hash(password, 10);

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: existingStaff.userId },
        data: userData,
      });
    }

    // Update adminUser record
    const staffData: any = {};
    if (department !== undefined) staffData.department = department;
    if (designation !== undefined) staffData.designation = designation;
    if (branchId !== undefined) staffData.branchId = branchId || null;
    if (franchiseId !== undefined) staffData.franchiseId = franchiseId || null;
    if (roleId !== undefined) staffData.roleId = roleId;
    if (isActive !== undefined) staffData.isActive = isActive;

    const updated = await (prisma.adminUser as any).update({
      where: { id },
      data: staffData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            role: true,
          },
        },
        role: true,
        branch: true,
      },
    });

    const isPhlebo =
      (designation && /phlebotomist|collector|phlebo/i.test(designation)) ||
      (department && /phlebotom|sample collection/i.test(department)) ||
      (existingStaff.designation && /phlebotomist|collector|phlebo/i.test(existingStaff.designation)) ||
      (existingStaff.department && /phlebotom|sample collection/i.test(existingStaff.department));

    if (isPhlebo) {
      if (existingStaff.user?.role !== 'EXECUTIVE') {
        await prisma.user.update({
          where: { id: existingStaff.userId },
          data: { role: 'EXECUTIVE' },
        }).catch(console.error);
      }

      await prisma.pathologyPartner.upsert({
        where: { userId: existingStaff.userId },
        update: {
          approvalStatus: isActive === false ? 'SUSPENDED' : 'APPROVED',
          isAvailable: isActive !== false,
          branchId: branchId || undefined,
        },
        create: {
          userId: existingStaff.userId,
          labName: `${existingStaff.user.name} (Phlebotomist)`,
          role: 'PHLEBOTOMIST',
          partnerCode: `PHLEBO-${existingStaff.userId.slice(0, 5).toUpperCase()}`,
          address: department || existingStaff.department || 'Sample Collection (Phlebotomy)',
          approvalStatus: isActive === false ? 'SUSPENDED' : 'APPROVED',
          commissionRate: 15,
          paymentCycle: 'WEEKLY',
          isAvailable: isActive !== false,
          branchId: branchId || undefined,
        },
      }).catch(console.error);
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating staff:', error);
    res.status(500).json({ error: 'Failed to update staff member', details: error.message });
  }
};

// DELETE /api/staff/:id
export const deleteStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staff = await (prisma.adminUser as any).findUnique({
      where: { id },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await (prisma.adminUser as any).delete({ where: { id } });
    if (staff.userId) {
      try {
        await prisma.user.delete({ where: { id: staff.userId } });
      } catch (e) {
        console.warn('Could not cascade delete user:', e);
      }
    }

    res.json({ message: 'Staff member deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ error: 'Failed to delete staff member', details: error.message });
  }
};
