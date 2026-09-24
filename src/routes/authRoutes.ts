import { Router } from 'express';
import {
  register, registerPartner, registerDoctor, registerPhlebotomist, login, getAllUsers, checkMobile,
  createPatientUser, updatePatientUser, deletePatientUser,
  getPartners, updatePartnerApproval, getAvailablePartners, getMe,
  updatePartnerByAdmin, createPartnerByAdmin, deletePartnerByAdmin,
  sendOtp, verifyOtp, resetPassword, loginWithOtp, loginWithFirebaseToken, registerWithFirebaseToken,
  sendEmailOtp, verifyEmailOtp,
  sendForgotPasswordOtp, verifyForgotPasswordOtp,
  doctorLogin, partnerLogin, updatePartner
} from '../controllers/authController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

// Public
router.get('/check-mobile', checkMobile);
router.post('/register', register);
router.post('/register/partner', registerPartner);
router.post('/register/doctor', registerDoctor);
router.post('/register/phlebotomist', registerPhlebotomist);
router.post('/login', login);
router.post('/doctor/login', doctorLogin);
router.post('/partner/login', partnerLogin);
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);
router.post('/otp/login', loginWithOtp);
router.post('/firebase/login', loginWithFirebaseToken);
router.post('/firebase/register', registerWithFirebaseToken);
router.post('/demo-login', async (req, res) => {
  const { role } = req.body;
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // First find any active user with this role
    let user = await prisma.user.findFirst({
      where: { role: role, isActive: true },
    });
    
    // If no user exists, create a dummy one for testing
    if (!user) {
      const dummyMobile = '9' + Math.floor(100000000 + Math.random() * 900000000).toString();
      const dummyName = `Demo ${role} User`;
      
      user = await prisma.user.create({
        data: {
          name: dummyName,
          mobile: dummyMobile,
          role: role,
          isActive: true,
          isVerified: true
        }
      });
      
      // Also create associated role-specific record if needed to avoid relational errors later
      if (role === 'DOCTOR') {
        await prisma.doctor.create({
          data: {
            userId: user.id,
            clinicName: 'Demo Clinic',
            specialization: 'General',
            registrationNumber: 'REG-' + dummyMobile,
            isVerified: true
          }
        });
      } else if (role === 'PATHOLOGY_PARTNER') {
        await prisma.partner.create({
          data: {
            userId: user.id,
            role: 'PATHOLOGY_PARTNER',
            labName: 'Demo Lab',
            registrationNumber: 'REG-' + dummyMobile,
            isVerified: true,
            status: 'APPROVED'
          }
        });
      } else if (role === 'EXECUTIVE') {
        // Find or create a default partner to attach the phlebotomist to
        let defaultPartner = await prisma.partner.findFirst({ where: { role: 'PATHOLOGY_PARTNER' } });
        if (!defaultPartner) {
          const pUser = await prisma.user.create({
            data: { name: 'Demo Partner', mobile: '8' + dummyMobile.slice(1), role: 'PATHOLOGY_PARTNER', isActive: true, isVerified: true }
          });
          defaultPartner = await prisma.partner.create({
            data: { userId: pUser.id, role: 'PATHOLOGY_PARTNER', labName: 'Demo Lab', isVerified: true, status: 'APPROVED' }
          });
        }
        await prisma.partner.create({
          data: {
            userId: user.id,
            role: 'PHLEBOTOMIST',
            parentPartnerId: defaultPartner.id,
            isVerified: true,
            status: 'APPROVED'
          }
        });
      }
    }
    
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: user.id, role: user.role, mobile: user.mobile },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );
    
    // Send full user info including nested relations if needed by the app
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { pathologyPartner: true, doctor: true }
    });
    
    res.json({ success: true, token, user: fullUser, message: 'Demo login successful' });
  } catch (error: any) {
    console.error('Demo login error:', error);
    res.status(500).json({ error: 'Demo login failed: ' + (error?.message || '') });
  }
});

router.post('/email/send-otp', sendEmailOtp);
router.post('/email/verify-otp', verifyEmailOtp);
router.post('/email/forgot-password', sendForgotPasswordOtp);
router.post('/email/verify-reset-otp', verifyForgotPasswordOtp);
router.post('/reset-password', resetPassword);

router.get('/me', authenticate, getMe);

import { documentUpload } from '../middlewares/upload';
import {
  uploadPartnerOnboardingDocument,
  updatePartnerDocumentStatusAdmin,
} from '../controllers/partnerDocumentController';
import { getPartnerDetails } from '../controllers/authController';

router.post('/register/partner-document', documentUpload, uploadPartnerOnboardingDocument);

// Admin only
router.get('/users', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAllUsers);
router.post('/users', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), createPatientUser);
router.put('/users/:id', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), updatePatientUser);
router.patch('/users/:id', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), updatePatientUser);
router.delete('/users/:id', authenticate, authorizeRoles('SUPER_ADMIN'), deletePatientUser);
router.get('/partners', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getPartners);
router.post('/partners', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), createPartnerByAdmin);
router.put('/partners/:id', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), updatePartnerByAdmin);
router.delete('/partners/:id', authenticate, authorizeRoles('SUPER_ADMIN'), deletePartnerByAdmin);
router.get('/partners/:id/details', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getPartnerDetails);
router.patch('/partners/:id/approval', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), updatePartnerApproval);
router.patch('/partners/:id/documents/:docId', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), updatePartnerDocumentStatusAdmin);
router.get('/partners/available', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAvailablePartners);

export default router;