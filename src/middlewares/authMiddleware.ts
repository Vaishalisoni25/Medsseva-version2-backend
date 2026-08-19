import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role?: string;
    permissions?: string[]; // e.g. ['bookings.view', 'reports.approve']
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
    req.user = { id: decoded.id, role: decoded.role, permissions: [] };

    const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST', 'LAB_DEPARTMENT'];
    if (!decoded.role || !adminRoles.includes(decoded.role)) {
      return next();
    }

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
      req.user.permissions = adminUser.role.permissions.map(
        (rp) => `${rp.permission.module}.${rp.permission.action}`
      );
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.role) {
      return res.status(403).json({ error: 'Forbidden: Role not assigned' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
};