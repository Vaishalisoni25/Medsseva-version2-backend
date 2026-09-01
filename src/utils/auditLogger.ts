import { prisma } from '../lib/prisma';

interface AuditPayload {
  userId: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  performedByRole?: string;
  ipAddress?: string;
  requestId?: string;
  severity?: string;
  status?: string;
  metadata?: Record<string, any>;
}

export const logAudit = async (payload: AuditPayload) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: payload.action,
        module: payload.module,
        entityType: payload.entityType,
        entityId: payload.entityId,
        performedByRole: payload.performedByRole,
        ipAddress: payload.ipAddress,
        requestId: payload.requestId,
        severity: payload.severity ?? 'LOW',
        status: payload.status ?? 'SUCCESS',
        metadata: payload.metadata,
      },
    });
  } catch {
  }
};