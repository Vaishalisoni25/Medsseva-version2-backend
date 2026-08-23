import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role?: string;
    permissions?: string[];
    branchId?: string | null;
    partnerId?: string | null;
    isSuperAdmin?: boolean;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { id: string; role?: string };
    const isSuperAdmin = decoded.role === 'SUPER_ADMIN';
    let permissions: string[] = isSuperAdmin ? ['*'] : [];
    let branchId: string | null = null;
    let partnerId: string | null = null;

    const [adminUser, userRecord] = await Promise.all([
      prisma.adminUser.findUnique({
        where: { userId: decoded.id },
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: decoded.id },
        select: { role: true, email: true },
      }),
    ]);

    const isAdmin = !!adminUser || userRecord?.role === 'ADMIN' || userRecord?.role === 'SUPER_ADMIN' || decoded.role === 'ADMIN' || decoded.role === 'SUPER_ADMIN';

    if (adminUser && adminUser.isActive) {
      const mappedPerms = adminUser.role?.permissions?.map(
        (rp) => `${rp.permission.module}.${rp.permission.action}`
      ) || [];
      permissions = mappedPerms.length > 0 ? mappedPerms : ['*'];
      branchId = adminUser.branchId || null;
      partnerId = adminUser.partnerId || null;
    } else if (isAdmin) {
      permissions = ['*'];
    }

    const effectiveRole = isSuperAdmin || userRecord?.role === 'SUPER_ADMIN' || decoded.role === 'SUPER_ADMIN'
      ? 'SUPER_ADMIN'
      : (isAdmin ? 'ADMIN' : (userRecord?.role || decoded.role || 'USER'));

    req.user = {
      id: decoded.id,
      role: effectiveRole,
      permissions: permissions.length > 0 ? permissions : ['*'],
      branchId,
      partnerId,
      isSuperAdmin: effectiveRole === 'SUPER_ADMIN',
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.isSuperAdmin || req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
      return next();
    }
    if (req.user.role && roles.includes(req.user.role)) {
      return next();
    }
    if (req.user.permissions && (req.user.permissions.includes('*') || req.user.permissions.length > 0)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
  };
};