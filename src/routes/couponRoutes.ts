import { Router } from 'express';
import {
  getCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  validateCoupon,
  getCouponAnalytics,
} from '../controllers/couponController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.post('/validate', authenticate, validateCoupon);
router.get('/', authenticate, getCoupons);

router.use(authenticate);

router.get('/analytics', getCouponAnalytics);
router.get('/:id', getCouponById);
router.post('/', createCoupon);
router.put('/:id', updateCoupon);
router.patch('/:id/status', toggleCouponStatus);
router.delete('/:id', deleteCoupon);

export default router;