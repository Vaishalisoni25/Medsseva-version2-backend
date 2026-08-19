import { Router } from 'express';
import {
  getPaymentSummary,
  getPayments,
  getPaymentById,
  getRefunds,
  requestRefund,
  approveRefund,
  rejectRefund,
  getSettlements,
  generateSettlements,
  processSettlement,
  executeRefund,
} from '../controllers/financeController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';
import { strictLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles('ADMIN', 'SUPER_ADMIN'));

router.get('/payment-summary', getPaymentSummary);
router.get('/payments', getPayments);
router.get('/payments/:id', getPaymentById);

router.get('/refunds', getRefunds);
router.post('/refunds', requestRefund);
router.post('/refunds/:id/approve', approveRefund);
router.post('/refunds/:id/reject', rejectRefund);
router.post('/payments/:paymentId/refund', strictLimiter, executeRefund);

router.get('/settlements', getSettlements);
router.post('/settlements/generate', generateSettlements);
router.post('/settlements/:id/process', processSettlement);

export default router;