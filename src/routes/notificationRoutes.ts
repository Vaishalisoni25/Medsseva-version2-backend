import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';
import {
  registerToken,
  unregisterToken,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationLogs,
  sendBroadcast,
  retryFailed,
} from '../controllers/notificationController';

const router = Router();

router.post('/token/register', authenticate, registerToken);
router.post('/token/unregister', authenticate, unregisterToken);

router.get('/my', authenticate, getMyNotifications);
router.patch('/my/:id/read', authenticate, markAsRead);
router.patch('/my/read-all', authenticate, markAllAsRead);
router.delete('/my/:id', authenticate, deleteNotification);

router.get('/logs', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), getNotificationLogs);
router.post('/broadcast', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), sendBroadcast);
router.post('/retry-failed', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN'), retryFailed);

export default router;