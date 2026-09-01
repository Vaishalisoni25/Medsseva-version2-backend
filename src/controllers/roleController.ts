import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { createAuditLog } from '../services/audit.service';


// GET /api/roles
export const getRoles = async (req: AuthRequest, res: Response) => {
  try {
    const roles = await prisma.adminRole.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { adminUsers: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(roles);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// GET /api/roles/:id
export const getRoleById = async (req: AuthRequest, res: Response) => {
  try {
    const role = await prisma.adminRole.findUnique({
      where: { id: req.params.id },
      include: {
        permissions: { include: { permission: true } },
        adminUsers: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json(role);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// POST /api/roles
export const createRole = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, permissionIds } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '_');

    const role = await prisma.adminRole.create({
      data: {
        name,
        slug,
        description,
        permissions: {
          create: (permissionIds || []).map((pid: string) => ({ permissionId: pid })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });

if (req.user?.id) {
      await createAuditLog({
        userId: req.user.id,
        action: 'ROLE_CREATED',
        module: 'roles_permissions',
        entityType: 'AdminRole',
        entityId: role.id,
        performedByRole: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        severity: 'MEDIUM',
        metadata: { roleName: name },
      });
    }

    res.status(201).json(role);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// PUT /api/roles/:id
export const updateRole = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, permissionIds } = req.body;
    const { id } = req.params;

    const existing = await prisma.adminRole.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Role not found' });
    if (existing.isSystem && existing.slug === 'super_admin') {
      return res.status(403).json({ error: 'Cannot modify Super Admin system role' });
    }

    // Replace all permissions
    await prisma.rolePermission.deleteMany({ where: { roleId: id } });

    const role = await prisma.adminRole.update({
      where: { id },
      data: {
        name,
        description,
        permissions: {
          create: (permissionIds || []).map((pid: string) => ({ permissionId: pid })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });

if (req.user?.id) {
      await createAuditLog({
        userId: req.user.id,
        action: 'ROLE_UPDATED',
        module: 'roles_permissions',
        entityType: 'AdminRole',
        entityId: id,
        performedByRole: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        severity: 'MEDIUM',
        metadata: { roleId: id, roleName: name },
      });
    }

    res.json(role);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// DELETE /api/roles/:id
export const deleteRole = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.adminRole.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Role not found' });
    if (existing.isSystem) return res.status(403).json({ error: 'Cannot delete system roles' });

    await prisma.adminRole.delete({ where: { id } });
    res.json({ message: 'Role deleted' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// POST /api/roles/:id/clone
export const cloneRole = async (req: AuthRequest, res: Response) => {
  try {
    const source = await prisma.adminRole.findUnique({
      where: { id: req.params.id },
      include: { permissions: true },
    });
    if (!source) return res.status(404).json({ error: 'Role not found' });

    const newName = `${source.name} (Copy)`;
    const newSlug = `${source.slug}_copy_${Date.now()}`;

    const cloned = await prisma.adminRole.create({
      data: {
        name: newName,
        slug: newSlug,
        description: source.description || '',
        permissions: {
          create: source.permissions.map((rp) => ({ permissionId: rp.permissionId })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });

    res.status(201).json(cloned);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// GET /api/permissions
export const getAllPermissions = async (_req: AuthRequest, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
    res.json(permissions);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

// GET /api/audit-logs
export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(logs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};


export const assignAdminRole = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, roleId, franchiseId, department } = req.body;

    const adminUser = await prisma.adminUser.upsert({
      where: { userId },
      update: { roleId, franchiseId, department, isActive: true },
      create: { userId, roleId, franchiseId, department, isActive: true },
      include: { role: true, user: { select: { name: true, email: true } } },
    });

if (req.user?.id) {
      await createAuditLog({
        userId: req.user.id,
        action: 'ADMIN_ROLE_ASSIGNED',
        module: 'roles_permissions',
        entityType: 'AdminUser',
        entityId: adminUser.id,
        performedByRole: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        severity: 'HIGH',
        metadata: { targetUserId: userId, roleId },
      });
    }
    res.status(201).json(adminUser);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};