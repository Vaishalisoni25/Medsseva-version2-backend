import { Router } from 'express';
import { getAllTests, createTest, updateTest, addTestParameter, getTestParameters, getTestById } from '../controllers/testController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', getAllTests);
router.post('/', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), createTest);

router.get('/:id', getTestById);
router.put('/:id', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), updateTest);

router.get('/:testId/parameters', getTestParameters);
router.post('/:testId/parameters', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST'), addTestParameter);

export default router;
