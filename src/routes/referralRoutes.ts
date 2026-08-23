import { Router } from 'express';
import { getMyReferralInfo } from '../controllers/referralController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.get('/my-referral', authenticate, getMyReferralInfo);

export default router;
