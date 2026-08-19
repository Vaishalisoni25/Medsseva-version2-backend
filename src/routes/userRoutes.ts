import { Router } from 'express';
import { getMe, updateMe, addFamilyMember, removeFamilyMember, uploadAvatar } from '../controllers/userController';
import { authenticate } from '../middlewares/authMiddleware';
import { avatarUpload } from '../middlewares/upload';

const router = Router();


router.use(authenticate);

router.get('/me', getMe);
router.patch('/me', updateMe);
router.post('/me/avatar', avatarUpload, uploadAvatar);
router.post('/family', addFamilyMember);
router.delete('/family/:id', removeFamilyMember);

export default router;
