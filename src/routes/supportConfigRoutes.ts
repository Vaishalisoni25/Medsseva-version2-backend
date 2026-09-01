import { Router } from 'express';
import { getSupportConfig, updateSupportConfig } from '../controllers/supportConfigController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Public / Authenticated Support Channels info
router.get('/config', getSupportConfig);

// Admin Update Support Channels config
router.put('/config', authenticate, updateSupportConfig);
router.patch('/config', authenticate, updateSupportConfig);

export default router;
