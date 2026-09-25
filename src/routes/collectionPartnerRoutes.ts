import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';
import {
  getCollectionPartnersSummary,
  getCollectionPartners,
  getCollectionPartnerDetails,
  getDailyCollectionSummary,
  getLabWiseCollections,
  updateCollectionPartnerStatus,
  creditCommissionPayout,
  deleteCollectionPartner,
} from '../controllers/collectionPartnerController';

const router = Router();

router.use(authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PATHOLOGY_PARTNER'));

router.get('/summary', getCollectionPartnersSummary);
router.get('/', getCollectionPartners);
router.get('/daily-summary', getDailyCollectionSummary);
router.get('/lab-wise', getLabWiseCollections);
router.get('/:id', getCollectionPartnerDetails);
router.patch('/:id/status', updateCollectionPartnerStatus);
router.patch('/commissions/payout', creditCommissionPayout);
router.delete('/:id', deleteCollectionPartner);

export default router;
