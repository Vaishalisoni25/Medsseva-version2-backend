import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { randomUUID } from 'crypto';



const SKIP_PATHS = [
  '/api/health',
  '/api/payments/webhook',
  '/api/admin/audit-logs/api-requests',
];

export const apiRequestLogger = (req: Request, res: Response, next: NextFunction) => {
  const skip = SKIP_PATHS.some(p => req.path.startsWith(p));
  if (skip) return next();

  const requestId = randomUUID();
  const startTime = Date.now();
  (req as any).requestId = requestId;

  res.on('finish', async () => {
    const method = req.method.toUpperCase();
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isError = res.statusCode >= 400;

    // Smart Logging: Skip normal successful read requests (GET/HEAD/OPTIONS with 2xx/3xx)
    if (!isMutation && !isError) {
      return;
    }

    const latencyMs = Date.now() - startTime;
    const user = (req as any).user;

    try {
      await prisma.apiRequestLog.create({
        data: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          latencyMs,
          ip: req.ip || req.socket?.remoteAddress || null,
          userId: user?.id || null,
          userRole: user?.role || null,
          requestId,
          userAgent: req.headers['user-agent'] || null,
          responseSize: parseInt(res.getHeader('content-length') as string) || null,
        },
      });
    } catch (e) {
      console.error('[ApiRequestLog] Failed to write log:', e);
    }
  });

  next();
};