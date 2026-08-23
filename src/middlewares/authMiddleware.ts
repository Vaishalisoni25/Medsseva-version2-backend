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

    console.log(`\x1b[36m[AUTH]\x1b[0m ${req.method} ${req.originalUrl} | User: ${userRecord?.email || decoded.id} | Role: ${effectiveRole}`);

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
    console.error('\x1b[31m[AUTH ERROR]\x1b[0m Invalid token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      console.warn(`\x1b[31m[AUTH 401]\x1b[0m No req.user found`);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.isSuperAdmin || req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
      console.log(`\x1b[32m[AUTH OK]\x1b[0m Admin/SuperAdmin bypass for ${req.method} ${req.originalUrl}`);
      return next();
    }
    if (req.user.role && roles.includes(req.user.role)) {
      console.log(`\x1b[32m[AUTH OK]\x1b[0m Role match (${req.user.role}) for ${req.method} ${req.originalUrl}`);
      return next();
    }
    if (req.user.permissions && (req.user.permissions.includes('*') || req.user.permissions.length > 0)) {
      console.log(`\x1b[32m[AUTH OK]\x1b[0m Permissions match for ${req.method} ${req.originalUrl}`);
      return next();
    }
    console.warn(`\x1b[31m[AUTH 403 FORBIDDEN]\x1b[0m User: ${req.user.role} | Needed: [${roles.join(', ')}] on ${req.method} ${req.originalUrl}`);
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
  };
};