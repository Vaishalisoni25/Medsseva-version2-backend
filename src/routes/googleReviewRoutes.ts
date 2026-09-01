import { Router } from 'express';
import {
  getGoogleReviewConfig,
  updateGoogleReviewConfig,
  trackGoogleReviewClick,
  trackGoogleReviewSent,
} from '../controllers/googleReviewController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Publicly readable config for review links
router.get('/config', getGoogleReviewConfig);
router.post('/track-click', trackGoogleReviewClick);
router.post('/track-sent', trackGoogleReviewSent);

// Protected admin update
router.put('/config', authenticate, updateGoogleReviewConfig);

export default router;
