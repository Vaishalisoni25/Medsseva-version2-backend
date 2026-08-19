import { Router } from 'express';
import { getLimsQueue, receiveSample, startProcessing } from '../controllers/sampleController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

router.get('/queue', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST', 'LAB_DEPARTMENT'), getLimsQueue);
router.post('/receive', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST', 'LAB_DEPARTMENT'), receiveSample);
router.patch('/:bookingId/process', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST', 'LAB_DEPARTMENT'), startProcessing);

export default router;