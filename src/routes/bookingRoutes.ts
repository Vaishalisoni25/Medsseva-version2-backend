import { Router } from 'express';
import {
  getAllBookings,
  createBooking,
  verifyAndCreateBooking,
  updateBookingStatus,
  updatePaymentStatus,
  assignExecutive,
  assignPartner,
  collectSample,
  getAvailableSlots,
  generateCollectionOtp,
  verifyCollectionOtp,
  acceptLabBooking,
  rejectLabBooking,
  patientReachedLab,
  updateLabStatus,
  sendBookingInvoice,
  createWalkinBooking,
} from '../controllers/bookingController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';
import { strictLimiter } from '../middlewares/rateLimiter';
import { validateRequest } from '../middlewares/validateRequest';
import { createBookingSchema } from '../validators/schemas';

const router = Router();

router.get('/available-slots', getAvailableSlots);

router.use(authenticate);

router.get('/', getAllBookings);
router.post('/walkin', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST', 'LAB_DEPARTMENT'), createWalkinBooking);
router.post('/', strictLimiter, validateRequest(createBookingSchema), createBooking);
router.post('/verify-payment', strictLimiter, verifyAndCreateBooking);
router.patch('/:id/status', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'EXECUTIVE', 'PATHOLOGY_PARTNER'), updateBookingStatus);
router.patch('/:id/payment', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'EXECUTIVE', 'PATHOLOGIST'), updatePaymentStatus);
router.patch('/:id/assign-executive', authorizeRoles('ADMIN', 'SUPER_ADMIN'), assignExecutive);
router.patch('/:id/assign-partner', authorizeRoles('ADMIN', 'SUPER_ADMIN'), assignPartner);
router.patch('/:id/accept-lab', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'), acceptLabBooking);
router.patch('/:id/reject-lab', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'), rejectLabBooking);
router.patch('/:id/patient-reached', authorizeRoles('USER', 'ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'), patientReachedLab);
router.patch('/:id/update-lab-status', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'), updateLabStatus);
router.patch('/:id/collect-sample', authorizeRoles('ADMIN', 'PATHOLOGIST', 'EXECUTIVE'), collectSample);
router.get('/:id/collection-otp', generateCollectionOtp);
router.post('/:id/verify-otp', verifyCollectionOtp);
router.post('/:id/send-invoice', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'), sendBookingInvoice);

export default router;