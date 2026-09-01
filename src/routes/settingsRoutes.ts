import { Router } from 'express';
import { getSettings, updateSettings, getVersion } from '../controllers/settingsController';
import { authenticate } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/rbacMiddleware';

const router = Router();

router.get('/', authenticate, getSettings);
router.get('/version', getVersion);
router.put('/', authenticate, requirePermission('settings.edit'), updateSettings);

export default router;