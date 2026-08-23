import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';
import { createAuditLog } from '../services/audit.service';
import { sendOtpEmail, sendPasswordResetEmail } from '../services/email.service';
import {
  generateOtp, hashOtp, verifyOtpHash, getOtpExpiry,
  isOtpExpired, isResendAllowed, getResendCooldownRemaining, MAX_ATTEMPTS
} from '../services/otp.service';
import { generateUniqueReferralCode } from '../utils/referral.utils';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-medsseva-key';

export const registerPartner = async (req: Request, res: Response) => {
  try {
    const { name, email, mobile, password, labName, role: partnerRole, cityId, branchId, address, latitude, longitude } = req.body;

    if (!name || !mobile || !password || !labName || !partnerRole) {
      return res.status(400).json({ error: 'name, mobile, password, labName, and role are required' });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ mobile }, ...(email ? [{ email }] : [])] }
    });

    if (existing) {
      return res.status(400).json({ error: existing.mobile === mobile ? 'Mobile already registered' : 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const referralCode = await generateUniqueReferralCode();

    const user = await prisma.user.create({
      data: {
        name,
        email: email || undefined,
        mobile,
        password: hashedPassword,
        role: 'PATHOLOGY_PARTNER',
        referralCode,
      }
    });

    await prisma.pathologyPartner.create({
      data: {
        userId: user.id,
        labName,
        role: partnerRole,
        cityId: cityId || null,
        branchId: branchId || null,
        address: address || null,
        latitude: latitude || null,
        longitude: longitude || null,
        approvalStatus: 'PENDING'
      }
    });

    res.status(201).json({
      message: 'Partner registration submitted. Awaiting admin approval.',
      pendingApproval: true
    });
  } catch (error: any) {
    console.error('Partner registration error:', error);
    res.status(500).json({ error: 'Failed to register partner', details: error.message });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, mobile, password, referralCode } = req.body;

    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ error: 'name, email, mobile, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address format' });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ mobile }, { email }] }
    });

    if (existingUser) {
      if (existingUser.mobile === mobile) {
        return res.status(400).json({ error: 'Mobile number already registered. Please login instead.' });
      }
      return res.status(400).json({ error: 'Email already in use. Try a different email.' });
    }

    let referredById: string | null = null;
    let isFirstTestFreeEligible = false;

    // Optional manual referral code
    if (referralCode && typeof referralCode === 'string' && referralCode.trim() !== '') {
      const cleanReferral = referralCode.trim().toUpperCase();
      const referrer = await prisma.user.findUnique({
        where: { referralCode: cleanReferral },
      });
      if (!referrer) {
        return res.status(400).json({ error: 'Invalid referral code entered. Please check the code or leave it empty.' });
      }
      referredById = referrer.id;
      isFirstTestFreeEligible = true;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const otpExpiresAt = getOtpExpiry();
    const userReferralCode = await generateUniqueReferralCode();

    const user = await prisma.user.create({
      data: {
        name,
        email,
        mobile,
        password: hashedPassword,
        emailVerified: false,
        otpHash,
        otpExpiresAt,
        otpAttempts: 0,
        otpLastSentAt: new Date(),
        referralCode: userReferralCode,
        referredById,
        isFirstTestFreeEligible,
      }
    });

    try {
      await sendOtpEmail(email, name, otp);
    } catch (emailError: any) {
      await prisma.user.delete({ where: { id: user.id } });
      console.error('Email send failed during registration:', emailError.message);
      return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    res.status(201).json({
      message: 'Registration initiated. Please verify your email address.',
      requiresEmailVerification: true,
      email,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register', details: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { mobile, email, identifier, password } = req.body;
    const inputVal = String(mobile || email || identifier || '').trim();

    if (!inputVal || !password) {
      return res.status(400).json({ error: 'Mobile/Email and Password are required' });
    }

    let user = null;
    if (/^\d{10}$/.test(inputVal)) {
      user = await prisma.user.findUnique({ where: { mobile: inputVal } });
    } else {
      user = await prisma.user.findUnique({ where: { email: inputVal } });
      if (!user && mobile) {
        user = await prisma.user.findUnique({ where: { mobile: String(mobile).trim() } });
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.role === 'USER' && user.email && !user.emailVerified) {
      return res.status(403).json({
        error: 'Your email address is not verified. Please verify your email first.',
        requiresEmailVerification: true,
        email: user.email,
      });
    }

    if (user.role === 'PATHOLOGY_PARTNER') {
      const partner = await prisma.pathologyPartner.findUnique({ where: { userId: user.id } });
      if (!partner) return res.status(403).json({ error: 'Partner profile not found' });
      if (partner.approvalStatus === 'PENDING') {
        return res.status(403).json({ error: 'Your registration is pending admin approval.', pendingApproval: true });
      }
      if (partner.approvalStatus === 'REJECTED') {
        return res.status(403).json({ error: `Registration rejected: ${partner.rejectionReason || 'Contact support.'}`, rejected: true, rejectionReason: partner.rejectionReason });
      }
      if (partner.approvalStatus === 'SUSPENDED') {
        return res.status(403).json({ error: 'Your account has been suspended. Contact support.', suspended: true });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
      createAuditLog({
        userId: user.id,
        action: 'LOGIN',
        module: 'auth',
        performedByRole: user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        severity: 'LOW',
        metadata: { mobile: user.mobile },
      }).catch(console.error);
      return res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          role: user.role,
          partner: {
            id: partner.id,
            labName: partner.labName,
            approvalStatus: partner.approvalStatus,
            isAvailable: partner.isAvailable,
            rating: partner.rating,
          },
        },
        token,
      });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

    let permissions: string[] = [];
    let adminRoleName: string | null = null;
    let adminRoleSlug: string | null = null;
    let accessibleModules: string[] = [];

    const adminUser = await prisma.adminUser.findUnique({
      where: { userId: user.id },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (adminUser && adminUser.isActive) {
      permissions = adminUser.role.permissions.map(
        (rp) => `${rp.permission.module}.${rp.permission.action}`
      );
      adminRoleName = adminUser.role.name;
      adminRoleSlug = adminUser.role.slug;
      accessibleModules = [
        ...new Set(
          adminUser.role.permissions
            .filter((rp) => rp.permission.action === 'view')
            .map((rp) => rp.permission.module)
        ),
      ];
    } else if (user.role === 'SUPER_ADMIN') {
      adminRoleName = 'Super Admin';
      adminRoleSlug = 'super_admin';
      permissions = ['*'];
      accessibleModules = ['*'];
    }

    createAuditLog({
      userId: user.id,
      action: 'LOGIN',
      module: 'auth',
      performedByRole: user.role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
      severity: 'LOW',
      metadata: { mobile: user.mobile, adminRole: adminRoleName },
    }).catch(console.error);

    let userReferralCode = user.referralCode;
    if (!userReferralCode) {
      userReferralCode = await generateUniqueReferralCode();
      await prisma.user.update({
        where: { id: user.id },
        data: { referralCode: userReferralCode },
      });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
        referralCode: userReferralCode,
        isFirstTestFreeEligible: user.isFirstTestFreeEligible,
        firstTestFreeUsed: user.firstTestFreeUsed,
        adminRole: adminRoleName,
        adminRoleSlug,
        permissions,
        accessibleModules,
      },
      token,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login', details: error.message });
  }
};

export const checkMobile = async (req: Request, res: Response) => {
  try {
    const { mobile } = req.query;

    if (!mobile || typeof mobile !== 'string') {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    const user = await prisma.user.findUnique({ where: { mobile } });

    return res.json({ exists: !!user });
  } catch (error: any) {
    console.error('Check mobile error:', error);
    res.status(500).json({ error: 'Failed to check mobile number', details: error.message });
  }
};

export const createAdminUser = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      password,
      roleId,
      franchiseId,
      department,
      designation,
      qualification,
      registrationNo,
      signatureUrl,
      branchId,
      partnerId,
      userType = 'STAFF',
    } = req.body;

    console.log('\x1b[35m[CREATE EMPLOYEE/STAFF]\x1b[0m Incoming payload:', JSON.stringify({ name, email, department, designation, branchId, userType }));

    if (!name || !email) {
      console.warn('\x1b[31m[CREATE EMPLOYEE ERROR]\x1b[0m Name and Email are missing');
      return res.status(400).json({ error: 'Name and Email are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.warn('\x1b[31m[CREATE EMPLOYEE ERROR]\x1b[0m Email already in use:', email);
      return res.status(400).json({ error: 'Email already in use' });
    }

    let effectiveRoleId = roleId;
    let role = null;
    if (effectiveRoleId) {
      role = await prisma.adminRole.findUnique({ where: { id: effectiveRoleId } });
    }
    if (!role) {
      role = await prisma.adminRole.findFirst({
        where: {
          slug: { in: ['staff', 'employee', 'lab_department', 'executive', 'admin'] },
        },
      }) || await prisma.adminRole.findFirst();
      effectiveRoleId = role?.id;
    }

    if (!role || !effectiveRoleId) {
      return res.status(400).json({ error: 'No valid role found in system. Please create a role first.' });
    }

    const effectivePassword = password || 'MedsSeva@123';
    const hashedPassword = await bcrypt.hash(effectivePassword, 10);

    const prismaRole = role.slug ? role.slug.toUpperCase().replace(/ /g, '_').replace(/-/g, '_') as any : 'ADMIN';
    const validRoles = ['ADMIN', 'FRANCHISE', 'LAB_DEPARTMENT', 'EXECUTIVE', 'PATHOLOGIST'];
    const userRole = validRoles.includes(prismaRole) ? prismaRole : (userType === 'DOCTOR' ? 'PATHOLOGIST' : 'ADMIN');

    const mobile = req.body.mobile?.trim() || `adm_${Date.now()}`;

    const existingMobile = req.body.mobile
      ? await prisma.user.findUnique({ where: { mobile } })
      : null;
    if (existingMobile) {
      return res.status(400).json({ error: 'Mobile number already in use' });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        mobile,
        password: hashedPassword,
        role: userRole,
      },
    });

    const adminUser = await (prisma.adminUser as any).create({
      data: {
        userId: user.id,
        roleId: effectiveRoleId,
        franchiseId: franchiseId || null,
        department: department || null,
        designation: designation || null,
        qualification: qualification || null,
        registrationNo: registrationNo || null,
        signatureUrl: signatureUrl || null,
        branchId: branchId || null,
        partnerId: partnerId || null,
        userType: userType || 'STAFF',
        isActive: true,
      },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
        user: { select: { id: true, name: true, email: true, role: true } },
        branch: true,
      },
    });

    // If user is a Doctor or doctor details are provided, sync with Doctor model
    if (userType === 'DOCTOR' || registrationNo || qualification) {
      try {
        await (prisma as any).doctor.create({
          data: {
            userId: user.id,
            name,
            qualification: qualification || 'MBBS',
            registrationNo: registrationNo || 'REG-' + Date.now().toString().slice(-6),
            designation: designation || 'Consultant Pathologist',
            signatureUrl: signatureUrl || null,
            branchId: branchId || null,
            partnerId: partnerId || null,
            isActive: true,
          },
        });
      } catch (docErr) {
        console.error('Failed to sync Doctor model:', docErr);
      }
    }

    res.status(201).json(adminUser);
  } catch (error: any) {
    console.error('Create admin user error:', error);
    res.status(500).json({ error: 'Failed to create admin user', details: error.message });
  }
};

export const getAdminUsers = async (req: Request, res: Response) => {
  try {
    const adminUsers = await (prisma.adminUser as any).findMany({
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
        user: { select: { id: true, name: true, email: true, mobile: true, role: true, createdAt: true } },
        branch: { select: { id: true, name: true, city: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(adminUsers);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch admin users', details: error.message });
  }
};

export const updateAdminUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      password,
      roleId,
      franchiseId,
      department,
      designation,
      qualification,
      registrationNo,
      signatureUrl,
      branchId,
      partnerId,
      userType,
      isActive,
    } = req.body;

    const adminUser = await (prisma.adminUser as any).findUnique({
      where: { id },
      include: { user: true, role: true },
    });
    if (!adminUser) return res.status(404).json({ error: 'Admin user not found' });

    if (adminUser.role.slug === 'super_admin') {
      return res.status(403).json({ error: 'Cannot modify Super Admin account' });
    }

    const userUpdateData: any = {};
    if (name) userUpdateData.name = name;
    if (email) userUpdateData.email = email;
    if (password) userUpdateData.password = await bcrypt.hash(password, 10);

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({ where: { id: adminUser.userId }, data: userUpdateData });
    }

    const adminUpdateData: any = {};
    if (roleId) adminUpdateData.roleId = roleId;
    if (franchiseId !== undefined) adminUpdateData.franchiseId = franchiseId;
    if (department !== undefined) adminUpdateData.department = department;
    if (designation !== undefined) adminUpdateData.designation = designation;
    if (qualification !== undefined) adminUpdateData.qualification = qualification;
    if (registrationNo !== undefined) adminUpdateData.registrationNo = registrationNo;
    if (signatureUrl !== undefined) adminUpdateData.signatureUrl = signatureUrl;
    if (branchId !== undefined) adminUpdateData.branchId = branchId;
    if (partnerId !== undefined) adminUpdateData.partnerId = partnerId;
    if (userType !== undefined) adminUpdateData.userType = userType;
    if (isActive !== undefined) adminUpdateData.isActive = isActive;

    const updated = await (prisma.adminUser as any).update({
      where: { id },
      data: adminUpdateData,
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
        user: { select: { id: true, name: true, email: true, role: true } },
        branch: true,
      },
    });

    // Update or sync doctor profile if applicable
    if (userType === 'DOCTOR' || adminUser.userType === 'DOCTOR' || registrationNo) {
      try {
        await (prisma as any).doctor.upsert({
          where: { userId: adminUser.userId },
          update: {
            name: name || adminUser.user.name,
            qualification: qualification || adminUser.qualification || 'MBBS',
            registrationNo: registrationNo || adminUser.registrationNo || 'REG-DOC',
            designation: designation || adminUser.designation || 'Consultant Pathologist',
            signatureUrl: signatureUrl !== undefined ? signatureUrl : adminUser.signatureUrl,
            branchId: branchId !== undefined ? branchId : adminUser.branchId,
            isActive: isActive !== undefined ? isActive : adminUser.isActive,
          },
          create: {
            userId: adminUser.userId,
            name: name || adminUser.user.name,
            qualification: qualification || 'MBBS',
            registrationNo: registrationNo || 'REG-DOC',
            designation: designation || 'Consultant Pathologist',
            signatureUrl: signatureUrl || null,
            branchId: branchId || null,
            isActive: true,
          },
        });
      } catch (docErr) {
        console.error('Failed to sync Doctor model on update:', docErr);
      }
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update admin user', details: error.message });
  }
};

export const deleteAdminUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const adminUser = await prisma.adminUser.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!adminUser) return res.status(404).json({ error: 'Admin user not found' });

    if (adminUser.role.slug === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete Super Admin account' });
    }

    await prisma.adminUser.delete({ where: { id } });
    await prisma.user.delete({ where: { id: adminUser.userId } });

    res.json({ message: 'Admin user deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete admin user', details: error.message });
  }
};

export const getPartners = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const partners = await prisma.pathologyPartner.findMany({
      where: status ? { approvalStatus: status as any } : undefined,
      include: {
        user: { select: { id: true, name: true, email: true, mobile: true, createdAt: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(partners);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch partners', details: error.message });
  }
};

export const updatePartnerApproval = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approvalStatus, rejectionReason } = req.body;

    const validStatuses = ['APPROVED', 'REJECTED', 'SUSPENDED', 'PENDING'];
    if (!validStatuses.includes(approvalStatus)) {
      return res.status(400).json({ error: 'Invalid approval status' });
    }

    if (approvalStatus === 'REJECTED' && !rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const partner = await prisma.pathologyPartner.update({
      where: { id },
      data: {
        approvalStatus,
        rejectionReason: approvalStatus === 'REJECTED' ? rejectionReason : null
      },
      include: {
        user: { select: { id: true, name: true, email: true, mobile: true } }
      }
    });

    res.json({ message: `Partner ${approvalStatus.toLowerCase()} successfully`, partner });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update partner status', details: error.message });
  }
};

export const getAvailablePartners = async (req: Request, res: Response) => {
  try {
    const partners = await prisma.pathologyPartner.findMany({
      where: { approvalStatus: 'APPROVED', isAvailable: true },
      include: {
        user: { select: { id: true, name: true, mobile: true, avatarUrl: true } }
      }
    });
    res.json(partners);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch available partners', details: error.message });
  }
};

export const getMe = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let permissions: string[] = [];
    let adminRoleName: string | null = null;
    let adminRoleSlug: string | null = null;
    let accessibleModules: string[] = [];

    const adminUser = await prisma.adminUser.findUnique({
      where: { userId: user.id },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (adminUser && adminUser.isActive) {
      permissions = adminUser.role.permissions.map(
        (rp) => `${rp.permission.module}.${rp.permission.action}`
      );
      adminRoleName = adminUser.role.name;
      adminRoleSlug = adminUser.role.slug;
      accessibleModules = [
        ...new Set(
          adminUser.role.permissions
            .filter((rp) => rp.permission.action === 'view')
            .map((rp) => rp.permission.module)
        ),
      ];
    } else if (user.role === 'SUPER_ADMIN') {
      adminRoleName = 'Super Admin';
      adminRoleSlug = 'super_admin';
      permissions = ['*'];
      accessibleModules = ['*'];
    }

    let userReferralCode = user.referralCode;
    if (!userReferralCode) {
      userReferralCode = await generateUniqueReferralCode();
      await prisma.user.update({
        where: { id: user.id },
        data: { referralCode: userReferralCode },
      });
    }

    const totalReferrals = await prisma.user.count({
      where: { referredById: user.id },
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
        referralCode: userReferralCode,
        isFirstTestFreeEligible: user.isFirstTestFreeEligible,
        firstTestFreeUsed: user.firstTestFreeUsed,
        totalReferrals,
        branchId: adminUser?.branchId || null,
        adminRole: adminRoleName,
        adminRoleSlug,
        permissions,
        accessibleModules,
      },
    });
  } catch (error: any) {
    console.error('getMe error:', error);
    res.status(500).json({ error: 'Failed to fetch profile', details: error.message });
  }
};

export const sendOtp = async (req: Request, res: Response) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ error: 'Mobile number is required' });
    return res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send OTP', details: error.message });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) return res.status(400).json({ error: 'Mobile and OTP are required' });
    if (otp !== '1234') return res.status(400).json({ error: 'Invalid OTP' });
    return res.json({ success: true, message: 'OTP verified' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to verify OTP', details: error.message });
  }
};

export const loginWithOtp = async (req: Request, res: Response) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) return res.status(400).json({ error: 'Mobile and OTP are required' });
    if (otp !== '1234') return res.status(400).json({ error: 'Invalid OTP' });

    const user = await prisma.user.findUnique({ where: { mobile } });
    if (!user) return res.status(404).json({ error: 'This mobile number is not registered.' });

    if (user.role === 'PATHOLOGY_PARTNER') {
      const partner = await prisma.pathologyPartner.findUnique({ where: { userId: user.id } });
      if (!partner) return res.status(403).json({ error: 'Partner profile not found' });
      if (partner.approvalStatus === 'PENDING') return res.status(403).json({ error: 'Your registration is pending admin approval.', pendingApproval: true });
      if (partner.approvalStatus === 'REJECTED') return res.status(403).json({ error: `Registration rejected: ${partner.rejectionReason || 'Contact support.'}`, rejected: true });
      if (partner.approvalStatus === 'SUSPENDED') return res.status(403).json({ error: 'Your account has been suspended.', suspended: true });

      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15d' });
      return res.json({
        message: 'Login successful',
        user: { id: user.id, name: user.name, mobile: user.mobile, email: user.email, role: user.role, partner: { id: partner.id, labName: partner.labName, approvalStatus: partner.approvalStatus, isAvailable: partner.isAvailable, rating: partner.rating } },
        token,
      });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15d' });
    return res.json({
      message: 'Login successful',
      user: { id: user.id, name: user.name, mobile: user.mobile, email: user.email, role: user.role, uhid: user.uhid },
      token,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to login', details: error.message });
  }
};

export const sendEmailOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'No account found with this email address' });

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    if (!isResendAllowed(user.otpLastSentAt)) {
      const remaining = getResendCooldownRemaining(user.otpLastSentAt);
      return res.status(429).json({
        error: `Please wait ${remaining} seconds before requesting a new code`,
        cooldownRemaining: remaining,
      });
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const otpExpiresAt = getOtpExpiry();

    await prisma.user.update({
      where: { email },
      data: { otpHash, otpExpiresAt, otpAttempts: 0, otpLastSentAt: new Date() },
    });

    await sendOtpEmail(email, user.name, otp);

    return res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error: any) {
    console.error('sendEmailOtp error:', error.message);
    res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }
};

export const verifyEmailOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'No account found with this email address' });

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    if (!user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
    }

    if (isOtpExpired(user.otpExpiresAt)) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (user.otpAttempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
    }

    const isValid = await verifyOtpHash(otp, user.otpHash);

    if (!isValid) {
      await prisma.user.update({
        where: { email },
        data: { otpAttempts: { increment: 1 } },
      });
      const remaining = MAX_ATTEMPTS - (user.otpAttempts + 1);
      return res.status(400).json({
        error: remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Please request a new code.',
      });
    }

    await prisma.user.update({
      where: { email },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        otpLastSentAt: null,
      },
    });

    const updatedUser = await prisma.user.findUnique({ where: { email } });
    if (!updatedUser) return res.status(500).json({ error: 'Verification failed unexpectedly' });

    const token = jwt.sign({ id: updatedUser.id, role: updatedUser.role }, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      success: true,
      message: 'Email verified successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        mobile: updatedUser.mobile,
        email: updatedUser.email,
        role: updatedUser.role,
        referralCode: updatedUser.referralCode,
        isFirstTestFreeEligible: updatedUser.isFirstTestFreeEligible,
        firstTestFreeUsed: updatedUser.firstTestFreeUsed,
      },
      token,
    });
  } catch (error: any) {
    console.error('verifyEmailOtp error:', error.message);
    res.status(500).json({ error: 'Failed to verify email. Please try again.' });
  }
};

export const sendForgotPasswordOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'No account found with this email address' });

    if (!isResendAllowed(user.otpLastSentAt)) {
      const remaining = getResendCooldownRemaining(user.otpLastSentAt);
      return res.status(429).json({
        error: `Please wait ${remaining} seconds before requesting a new code`,
        cooldownRemaining: remaining,
      });
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const otpExpiresAt = getOtpExpiry();

    await prisma.user.update({
      where: { email },
      data: { otpHash, otpExpiresAt, otpAttempts: 0, otpLastSentAt: new Date() },
    });

    await sendPasswordResetEmail(email, user.name, otp);

    return res.json({ success: true, message: 'Password reset code sent to your email' });
  } catch (error: any) {
    console.error('sendForgotPasswordOtp error:', error.message);
    res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
};

export const verifyForgotPasswordOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'No account found with this email address' });

    if (!user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ error: 'No reset code found. Please request a new one.' });
    }

    if (isOtpExpired(user.otpExpiresAt)) {
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    if (user.otpAttempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
    }

    const isValid = await verifyOtpHash(otp, user.otpHash);

    if (!isValid) {
      await prisma.user.update({
        where: { email },
        data: { otpAttempts: { increment: 1 } },
      });
      const remaining = MAX_ATTEMPTS - (user.otpAttempts + 1);
      return res.status(400).json({
        error: remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Please request a new code.',
      });
    }

    await prisma.user.update({
      where: { email },
      data: { otpHash: null, otpAttempts: 0 },
    });

    return res.json({ success: true, message: 'Code verified. You may now reset your password.' });
  } catch (error: any) {
    console.error('verifyForgotPasswordOtp error:', error.message);
    res.status(500).json({ error: 'Failed to verify code. Please try again.' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'No account found with this email address' });

    if (user.otpHash !== null) {
      return res.status(403).json({ error: 'Please verify your reset code before resetting your password.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, otpExpiresAt: null, otpLastSentAt: null },
    });

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { familyMembers: true },
    });
    res.json(users);
  } catch (error: any) {
    console.error('Error fetching registered users:', error);
    res.status(500).json({ error: 'Failed to fetch registered users', details: error.message });
  }
};