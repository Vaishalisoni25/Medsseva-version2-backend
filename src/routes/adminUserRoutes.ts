import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';
import {
  createAdminUser,
  getAdminUsers,
  updateAdminUser,
  deleteAdminUser,
} from '../controllers/authController';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN'));

router.get('/', getAdminUsers);
router.post('/', createAdminUser);
router.put('/:id', updateAdminUser);
router.delete('/:id', deleteAdminUser);

export default router;