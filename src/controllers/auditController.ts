import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';



export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      search,
      module,
      severity,
      status,
      userId,
      branchId,
      from,
      to,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { module: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (module) where.module = module;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (branchId) where.branchId = branchId;

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, mobile: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data: logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch audit logs', details: e.message });
  }
};

export const getAuditLogById = async (req: AuthRequest, res: Response) => {
  try {
    const log = await prisma.auditLog.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    if (!log) return res.status(404).json({ error: 'Audit log not found' });
    res.json(log);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch audit log', details: e.message });
  }
};

export const getAuditModules = async (_req: AuthRequest, res: Response) => {
  try {
    const modules = await prisma.auditLog.findMany({
      select: { module: true },
      distinct: ['module'],
      orderBy: { module: 'asc' },
    });
    res.json(modules.map(m => m.module));
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch modules', details: e.message });
  }
};

export const exportAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { from, to, module, severity } = req.query as Record<string, string>;

    const where: any = {};
    if (module) where.module = module;
    if (severity) where.severity = severity;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const rows = logs.map(l => ({
      id: l.id,
      timestamp: l.createdAt.toISOString(),
      action: l.action,
      module: l.module,
      entityType: l.entityType ?? '',
      entityId: l.entityId ?? '',
      performedBy: l.user?.name ?? '',
      performedByRole: l.performedByRole ?? l.user?.role ?? '',
      ipAddress: l.ipAddress ?? '',
      severity: l.severity,
      status: l.status,
    }));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);

    const headers = Object.keys(rows[0] || {}).join(',');
    const csvRows = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    res.send([headers, ...csvRows].join('\n'));
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to export audit logs', details: e.message });
  }
};

export const getApiRequestLogs = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '100',
      method,
      status,
      search,
      from,
      to,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (method) where.method = method.toUpperCase();
    if (status) {
      const code = parseInt(status);
      if (status === '2xx') where.statusCode = { gte: 200, lt: 300 };
      else if (status === '4xx') where.statusCode = { gte: 400, lt: 500 };
      else if (status === '5xx') where.statusCode = { gte: 500, lt: 600 };
      else if (!isNaN(code)) where.statusCode = code;
    }
    if (search) {
      where.OR = [
        { path: { contains: search, mode: 'insensitive' } },
        { ip: { contains: search } },
      ];
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.apiRequestLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.apiRequestLog.count({ where }),
    ]);

    res.json({
      data: logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch API logs', details: e.message });
  }
};