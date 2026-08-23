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

    const adminUser = await prisma.adminUser.findUnique({
      where: { userId: decoded.id },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (adminUser && adminUser.isActive) {
      permissions = adminUser.role.permissions.map(
        (rp) => `${rp.permission.module}.${rp.permission.action}`
      );
      branchId = adminUser.branchId || null;
      partnerId = adminUser.partnerId || null;
    }

    req.user = {
      id: decoded.id,
      role: decoded.role,
      permissions,
      branchId,
      partnerId,
      isSuperAdmin,
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
    if (req.user.isSuperAdmin || req.user.role === 'SUPER_ADMIN') {
      return next();
    }
    if (req.user.role && roles.includes(req.user.role)) {
      return next();
    }
    if (req.user.permissions && req.user.permissions.length > 0) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
  };
};