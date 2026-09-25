import { Router } from 'express';
import { getDashboardAnalytics } from '../controllers/analyticsController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

router.get('/dashboard', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST', 'PATHOLOGY_PARTNER'), getDashboardAnalytics);

export default router;