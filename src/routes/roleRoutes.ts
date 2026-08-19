import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/rbacMiddleware';
import {
  getRoles, getRoleById, createRole, updateRole,
  deleteRole, cloneRole, getAllPermissions,
  getAuditLogs, assignAdminRole,
} from '../controllers/roleController';

const router = Router();

router.use(authenticate);

router.get('/permissions', getAllPermissions);
router.get('/audit-logs', requirePermission('audit_logs.view'), getAuditLogs);
router.get('/', requirePermission('roles_permissions.view'), getRoles);
router.get('/:id', requirePermission('roles_permissions.view'), getRoleById);
router.post('/', requirePermission('roles_permissions.create'), createRole);
router.put('/:id', requirePermission('roles_permissions.edit'), updateRole);
router.delete('/:id', requirePermission('roles_permissions.delete'), deleteRole);
router.post('/:id/clone', requirePermission('roles_permissions.create'), cloneRole);
router.post('/admin-users', requirePermission('roles_permissions.assign'), assignAdminRole);

export default router;