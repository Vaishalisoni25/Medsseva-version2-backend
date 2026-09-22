import { Router } from 'express';
import {
  register, registerPartner, registerDoctor, registerPhlebotomist, login, getAllUsers, checkMobile,
  createPatientUser, updatePatientUser, deletePatientUser,
  getPartners, updatePartnerApproval, getAvailablePartners, getMe,
  sendOtp, verifyOtp, resetPassword, loginWithOtp, loginWithFirebaseToken, registerWithFirebaseToken,
  sendEmailOtp, verifyEmailOtp,
  sendForgotPasswordOtp, verifyForgotPasswordOtp,
  doctorLogin, partnerLogin,
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
router.get('/partners/:id/details', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getPartnerDetails);
router.patch('/partners/:id/approval', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), updatePartnerApproval);
router.patch('/partners/:id/documents/:docId', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), updatePartnerDocumentStatusAdmin);
router.get('/partners/available', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAvailablePartners);

export default router;