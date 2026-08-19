import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { submitRating, getBookingRating, getPartnerRatings } from '../controllers/ratingController';

const router = Router();

router.use(authenticate);

router.post('/', submitRating);
router.get('/booking/:bookingId', getBookingRating);
router.get('/partner/:partnerId', getPartnerRatings);

export default router;