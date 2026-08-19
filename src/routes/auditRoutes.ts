import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';
import {
  getAuditLogs,
  getAuditLogById,
  getAuditModules,
  exportAuditLogs,
  getApiRequestLogs,
} from '../controllers/auditController';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN', 'ADMIN'));

router.get('/', getAuditLogs);
router.get('/modules', getAuditModules);
router.get('/export', exportAuditLogs);
router.get('/api-requests', getApiRequestLogs);
router.get('/:id', getAuditLogById);

export default router;