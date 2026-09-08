import { Router } from 'express';
import {
  getDoctorPortalData,
  getPartnerPortalData,
  getAdminCommissions,
  updateCommissionConfig,
  updatePayoutStatus,
} from '../controllers/commissionController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

// Doctor Portal Data
router.get('/doctor/portal-data', authenticate, getDoctorPortalData);
router.get('/doctor-portal', authenticate, getDoctorPortalData);

// Partner Portal Data
router.get('/partner/portal-data', authenticate, getPartnerPortalData);
router.get('/partner-portal', authenticate, getPartnerPortalData);

// Admin Commission Management
router.get('/admin/all', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getAdminCommissions);
router.patch('/admin/config/:entityType/:id', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), updateCommissionConfig);
router.patch('/admin/payout-status', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), updatePayoutStatus);

export default router;
