import { Router } from 'express';
import {
  getPricingPreview,
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  getRazorpayConfig,
  getInvoice,
  regenerateInvoice,
  getPublicInvoiceVerification,
  getInvoicePdf,
} from '../controllers/paymentController';
import { authenticate } from '../middlewares/authMiddleware';
import { strictLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/webhook', handleWebhook);
router.get('/config', getRazorpayConfig);
router.get('/invoice/:bookingId/verify', getPublicInvoiceVerification);
router.get('/invoice/:bookingId/pdf', getInvoicePdf);

router.use(authenticate);

router.post('/pricing-preview', getPricingPreview);
router.post('/create-order', strictLimiter, createPaymentOrder);
router.post('/verify', strictLimiter, verifyPayment);
router.get('/invoice/:bookingId', getInvoice);
router.post('/invoice/:bookingId/regenerate', regenerateInvoice);

export default router;