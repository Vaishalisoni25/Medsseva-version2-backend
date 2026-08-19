import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { createAuditLog } from '../services/audit.service';

export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    if (req.user.role === 'SUPER_ADMIN') return next();

    const perms = req.user.permissions || [];
    if (perms.includes('*') || perms.includes(permission)) return next();

    return res.status(403).json({
      error: 'Forbidden',
      message: `You do not have permission: ${permission}`,
    });
  };
};
export const auditLog = (action: string, module: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.id) {
      await createAuditLog({
        userId: req.user.id,
        action,
        module,
        performedByRole: req.user.role,
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'] as string,
        metadata: { params: req.params },
      });
    }
    next();
  };
};