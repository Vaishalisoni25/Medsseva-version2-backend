import { Router } from 'express';
import {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
  toggleBranchStatus,
  getAdminLocations,
} from '../controllers/branch.controller';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

router.get('/admin-locations', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PATHOLOGY_PARTNER'), getAdminLocations);
router.get('/', getAllBranches);
router.get('/:id', getBranchById);

router.post('/', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), createBranch);
router.put('/:id', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), updateBranch);
router.delete('/:id', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), deleteBranch);
router.patch('/:id/status', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), toggleBranchStatus);

export default router;