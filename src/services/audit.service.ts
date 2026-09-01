import { prisma } from '../lib/prisma';

export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AuditStatus = 'SUCCESS' | 'FAILURE';

interface CreateAuditLogParams {
  userId: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  performedByRole?: string;
  branchId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  severity?: AuditSeverity;
  status?: AuditStatus;
  metadata?: Record<string, any>;
}

export const createAuditLog = async (params: CreateAuditLogParams): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        module: params.module,
        entityType: params.entityType,
        entityId: params.entityId,
        performedByRole: params.performedByRole,
        branchId: params.branchId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
        severity: params.severity ?? 'LOW',
        status: params.status ?? 'SUCCESS',
        metadata: params.metadata,
      },
    });
  } catch (e) {
    console.error('[AuditLog] Failed to write audit log:', e);
  }
};