import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { uploadToCloudinary, cloudinary } from '../middlewares/upload';


// Utility to generate a random 8-digit UHID (e.g., 9482-1029)
const generateUHID = () => {
  const part1 = Math.floor(1000 + Math.random() * 9000);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `${part1}-${part2}`;
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: { familyMembers: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Auto-generate UHID if it doesn't exist
    if (!user.uhid) {
      let unique = false;
      let newUhid = generateUHID();
      while (!unique) {
        const existing = await prisma.user.findUnique({ where: { uhid: newUhid } });
        if (!existing) unique = true;
        else newUhid = generateUHID();
      }
      user = await prisma.user.update({
        where: { id: userId },
        data: { uhid: newUhid },
        include: { familyMembers: true }
      });
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { userId: user.id },
      include: { branch: true, role: true }
    });

    const isEmployee = !!(
      adminUser && (
        adminUser.userType === 'EMPLOYEE' ||
        adminUser.userType === 'STAFF' ||
        adminUser.branchId ||
        adminUser.role?.slug === 'executive' ||
        (adminUser.designation && /phlebotomist|collector|phlebo/i.test(adminUser.designation)) ||
        (adminUser.department && /phlebotom|sample collection/i.test(adminUser.department))
      )
    );

    res.json({
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      uhid: user.uhid,
      avatarUrl: user.avatarUrl ?? null,
      healthScore: user.healthScore,
      dob: user.dob ?? null,
      gender: user.gender ?? null,
      bloodGroup: user.bloodGroup ?? null,
      altMobile: user.altMobile ?? null,
      familyMembers: user.familyMembers,
      isEmployee,
      phlebotomistType: isEmployee ? 'EMPLOYEE' : 'FREELANCER',
      userType: adminUser?.userType || (isEmployee ? 'EMPLOYEE' : null),
      branchId: adminUser?.branchId || null,
      branchName: adminUser?.branch?.name || null,
      designation: adminUser?.designation || null,
      adminRole: adminUser?.role?.name || null,
      adminRoleSlug: adminUser?.role?.slug || null,
    });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile', details: error.message });
  }
};
export const addFamilyMember = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, relation, age, gender } = req.body;

    if (!name || !relation || !age || !gender) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const familyMember = await prisma.family.create({
      data: {
        userId,
        name,
        relation,
        age: parseInt(age),
        gender
      }
    });

    res.status(201).json(familyMember);
  } catch (error: any) {
    console.error('Error adding family member:', error);
    res.status(500).json({ error: 'Failed to add family member', details: error.message });
  }
};

export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

const { name, email, dob, gender, bloodGroup, altMobile } = req.body;

    const updateData: {
      name?: string;
      email?: string;
      dob?: string;
      gender?: string;
      bloodGroup?: string;
      altMobile?: string;
    } = {};

    if (name && typeof name === 'string' && name.trim().length > 1) {
      updateData.name = name.trim();
    }
    if (email && typeof email === 'string' && email.includes('@')) {
      updateData.email = email.trim().toLowerCase();
    }
    if (dob && typeof dob === 'string') {
      updateData.dob = dob.trim();
    }
    if (gender && typeof gender === 'string') {
      updateData.gender = gender.trim();
    }
    if (bloodGroup && typeof bloodGroup === 'string') {
      updateData.bloodGroup = bloodGroup.trim();
    }
    if (altMobile !== undefined) {
      updateData.altMobile = altMobile ? altMobile.trim() : '';
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { familyMembers: true },
    });

    res.json(updated);
  } catch (error: any) {
    // Unique constraint violation (e.g. email already taken)
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'This email is already in use by another account.' });
    }
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMime.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPG, PNG, and WEBP images are allowed.' });
    }

    const maxSize = 5 * 1024 * 1024;
    if (req.file.size > maxSize) {
      return res.status(400).json({ error: 'Image too large. Maximum size is 5MB.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) return res.status(404).json({ error: 'User not found.' });

    if (existingUser.avatarUrl) {
      try {
        const publicIdMatch = existingUser.avatarUrl.match(/medseva\/avatars\/[^.]+/);
        if (publicIdMatch) {
          await cloudinary.uploader.destroy(publicIdMatch[0]);
        }
      } catch {
      }
    }

const { secure_url } = await uploadToCloudinary(
      req.file.buffer,
      `avatar_${userId}_${Date.now()}.${req.file.mimetype.split('/')[1]}`,
      req.file.mimetype,
      'medseva/avatars'
    );
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: secure_url },
    });

    res.json({
      avatarUrl: updated.avatarUrl,
      message: 'Profile image updated successfully.',
    });
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile image.', details: error.message });
  }
};

export const removeFamilyMember = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    // Ensure the family member belongs to the user before deleting
    const familyMember = await prisma.family.findUnique({ where: { id } });
    if (!familyMember || familyMember.userId !== userId) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    await prisma.family.delete({ where: { id } });

    res.json({ success: true, message: 'Family member removed' });
  } catch (error: any) {
    console.error('Error removing family member:', error);
    res.status(500).json({ error: 'Failed to remove family member', details: error.message });
  }
};

export const deleteMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Check if user has active/ongoing bookings
    const activeBookings = await prisma.booking.findMany({
      where: {
        userId,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] }
      }
    });

    if (activeBookings.length > 0) {
      return res.status(400).json({
        error: `Cannot delete account while you have ${activeBookings.length} ongoing test booking(s). Please wait for completion or cancel bookings first.`
      });
    }

    // Cleanly delete user and all associated child entities
    await prisma.$transaction(async (tx) => {
      // 1. Delete associated bookings and their tests/packages/logs/samples
      const userBookings = await tx.booking.findMany({ where: { userId }, select: { id: true } });
      const bookingIds = userBookings.map(b => b.id);
      if (bookingIds.length > 0) {
        await tx.bookingTest.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
        await tx.bookingPackage.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
        await tx.bookingStatusLog.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
        await tx.sampleDelivery.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
        await tx.sample.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
        await tx.report.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
        await tx.partnerRating.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
        await tx.referralCommission.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
        await tx.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }).catch(() => {});
        await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }

      // 2. Delete user's addresses, family members, payment methods, notifications, prescriptions
      await tx.address.deleteMany({ where: { userId } }).catch(() => {});
      await tx.family.deleteMany({ where: { userId } }).catch(() => {});
      await tx.paymentMethod.deleteMany({ where: { userId } }).catch(() => {});
      await tx.upiMethod.deleteMany({ where: { userId } }).catch(() => {});
      await tx.prescription.deleteMany({ where: { userId } }).catch(() => {});
      await tx.notification.deleteMany({ where: { userId } }).catch(() => {});
      await tx.doctor.deleteMany({ where: { userId } }).catch(() => {});
      await tx.pathologyPartner.deleteMany({ where: { userId } }).catch(() => {});
      await tx.adminUser.deleteMany({ where: { userId } }).catch(() => {});

      // 3. Delete user record
      await tx.user.delete({ where: { id: userId } });
    });

    res.json({ success: true, message: 'Your account and data have been permanently deleted.' });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account. Please try again.', details: error.message });
  }
};

