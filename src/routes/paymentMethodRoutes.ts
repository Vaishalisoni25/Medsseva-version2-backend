import { Router } from 'express';
import {
  getPaymentMethods,
  addPaymentMethod,
  setDefaultPaymentMethod,
  removePaymentMethod,
} from '../controllers/paymentMethodController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getPaymentMethods);
router.post('/', addPaymentMethod);
router.patch('/:id/default', setDefaultPaymentMethod);
router.delete('/:id', removePaymentMethod);

export default router;