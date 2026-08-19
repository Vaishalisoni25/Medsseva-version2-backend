import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import {
  getOrCreateConversation,
  getMessages,
  getAllConversations,
  getConversationById,
  assignConversation,
  getUnreadCount,
} from '../controllers/chatController';

const router = Router();

router.use(authenticate);

router.get('/conversation', getOrCreateConversation);
router.get('/conversation/unread', getUnreadCount);
router.get('/conversation/:id', getConversationById);
router.get('/conversation/:conversationId/messages', getMessages);
router.get('/conversations', getAllConversations);
router.patch('/conversation/:id/assign', assignConversation);

export default router;