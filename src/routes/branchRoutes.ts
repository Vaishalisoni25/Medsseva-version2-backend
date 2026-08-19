import { Router } from 'express';
import {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
  toggleBranchStatus,
} from '../controllers/branch.controller';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();


router.get('/', getAllBranches);
router.get('/:id', getBranchById);


router.post('/', authenticate, createBranch);
router.put('/:id', authenticate, updateBranch);
router.delete('/:id', authenticate, deleteBranch);
router.patch('/:id/status', authenticate, toggleBranchStatus);

export default router;