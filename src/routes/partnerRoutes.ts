import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';
import {
  getPartnerBookings,
  getPartnerNotifications,
  getPartnerHistory,
  acceptBooking,
  rejectBooking,
  updateBookingStatus,
  collectCash,
  initiateUpiCollection,
  checkUpiPaymentStatus,
  verifyUpiPayment,
  toggleAvailability,
  getPartnerProfile,
  getPartnerStats,
  updatePartnerProfile,
  getPartnerAvailability,
  updateAvailabilitySchedule,
  getPartnerBranch,
  getPartnerRatings,
  selectDeliveryBranch,
  confirmBranchDelivery,
  getDeliveryBranches,
  assignPartnerStaff,
  getPartnerBranchStaff,
  getPartnerEarnings,
  updatePayoutFrequency,
  updateCommissionRate,
} from '../controllers/partnerController';
import { verifyCollectionOtp, generateCollectionOtp } from '../controllers/bookingController';

const router = Router();

// Allow PATHOLOGY_PARTNER, EXECUTIVE, and registered phlebotomists
router.use(authenticate, authorizeRoles('PATHOLOGY_PARTNER', 'EXECUTIVE', 'ADMIN', 'SUPER_ADMIN', 'USER'));

router.get('/notifications', getPartnerNotifications);
router.get('/bookings', getPartnerBookings);
router.get('/branch-staff', getPartnerBranchStaff);
router.patch('/bookings/:id/accept', acceptBooking);
router.patch('/bookings/:id/assign-staff', assignPartnerStaff);
router.patch('/bookings/:id/reject', rejectBooking);
router.patch('/bookings/:id/status', updateBookingStatus);
router.post('/bookings/:id/verify-otp', verifyCollectionOtp);
router.get('/bookings/:id/collection-otp', generateCollectionOtp);
router.post('/bookings/:id/collect-cash', collectCash);
router.post('/bookings/:id/collect-upi', initiateUpiCollection);
router.get('/bookings/:id/upi-status', checkUpiPaymentStatus);
router.post('/bookings/:id/verify-upi', verifyUpiPayment);
router.patch('/availability', toggleAvailability);
router.get('/history', getPartnerHistory);
router.get('/profile', getPartnerProfile);
router.get('/stats', getPartnerStats);
router.patch('/profile', updatePartnerProfile);
router.get('/availability/schedule', getPartnerAvailability);
router.patch('/availability/schedule', updateAvailabilitySchedule);
router.get('/branch', getPartnerBranch);
router.get('/ratings', getPartnerRatings);
router.get('/delivery-branches', getDeliveryBranches);
router.post('/bookings/:id/select-branch', selectDeliveryBranch);
router.post('/bookings/:id/confirm-delivery', confirmBranchDelivery);
router.get('/earnings', getPartnerEarnings);
router.patch('/payout-frequency', updatePayoutFrequency);
router.patch('/commission-rate', updateCommissionRate);

import { documentUpload } from '../middlewares/upload';
import {
  uploadPartnerOnboardingDocument,
  getPartnerOnboardingDocuments,
} from '../controllers/partnerDocumentController';

router.post('/documents/upload', documentUpload, uploadPartnerOnboardingDocument);
router.get('/documents', getPartnerOnboardingDocuments);
router.post('/bookings/:id/confirm-delivery', confirmBranchDelivery);

import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

import { getPartnerRatings as getPartnerRatingsAdmin } from '../controllers/ratingController';

router.get('/:partnerId/ratings', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getPartnerRatingsAdmin);

router.post('/change-password', async (req: any, res: any) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.password) {
      return res.status(400).json({ error: 'No password set for this account.' });
    }
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    res.json({ message: 'Password changed successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to change password', details: error.message });
  }
});

export default router;