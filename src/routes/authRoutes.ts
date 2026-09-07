import { Router } from 'express';
import {
  register, registerPartner, registerDoctor, registerPhlebotomist, login, getAllUsers, checkMobile,
  getPartners, updatePartnerApproval, getAvailablePartners, getMe,
  sendOtp, verifyOtp, resetPassword, loginWithOtp,
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

router.post('/email/send-otp', sendEmailOtp);
router.post('/email/verify-otp', verifyEmailOtp);
router.post('/email/forgot-password', sendForgotPasswordOtp);
router.post('/email/verify-reset-otp', verifyForgotPasswordOtp);
router.post('/reset-password', resetPassword);

router.get('/me', authenticate, getMe);

// Admin only
router.get('/users', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAllUsers);
router.get('/partners', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getPartners);
router.patch('/partners/:id/approval', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), updatePartnerApproval);
router.get('/partners/available', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAvailablePartners);

export default router;