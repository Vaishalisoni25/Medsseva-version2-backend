import { Request, Response } from 'express';
import { branchService } from '../services/branch.service';
import { AuthRequest } from '../middlewares/authMiddleware';
import { prisma } from '../lib/prisma';
export const getAllBranches = async (req: Request, res: Response) => {
  try {
    const branches = await branchService.getAllBranches(req.query as any);
    res.json({ success: true, data: branches });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getBranchById = async (req: Request, res: Response) => {
  try {
    const branch = await branchService.getBranchById(req.params.id);
    res.json({ success: true, data: branch });
  } catch (err: any) {
    res.status(404).json({ success: false, message: err.message });
  }
};

export const createBranch = async (req: Request, res: Response) => {
  try {
    const branch = await branchService.createBranch(req.body);
    res.status(201).json({ success: true, data: branch });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateBranch = async (req: Request, res: Response) => {
  try {
    const branch = await branchService.updateBranch(req.params.id, req.body);
    res.json({ success: true, data: branch });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteBranch = async (req: Request, res: Response) => {
  try {
    await branchService.deleteBranch(req.params.id);
    res.json({ success: true, message: 'Branch deleted successfully' });
  } catch (err: any) {
    res.status(404).json({ success: false, message: err.message });
  }
};

export const toggleBranchStatus = async (req: Request, res: Response) => {
  try {
    let { isActive } = req.body || {};
    if (typeof isActive !== 'boolean') {
      const current = await branchService.getBranchById(req.params.id);
      isActive = !current.isActive;
    }
    const branch = await branchService.toggleStatus(req.params.id, isActive);
    res.json({ success: true, data: branch });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const getAdminLocations = async (req: AuthRequest, res: Response) => {
  try {
    const isSuperAdmin = req.user?.isSuperAdmin || (req.user?.role || '').toUpperCase() === 'SUPER_ADMIN';
    const userBranchId = req.user?.branchId;
    const userPartnerId = req.user?.partnerId;

    let locations: any[] = [];

    if (isSuperAdmin) {
      // Super Admin sees all branches and all partner labs
      const branches = await prisma.branch.findMany({ where: { isActive: true } });
      const partners = await prisma.pathologyPartner.findMany({ where: { approvalStatus: 'APPROVED' } });
      
      locations = [
        ...branches.map(b => ({ id: b.id, name: b.name, city: b.city, type: 'BRANCH' })),
        ...partners.map(p => ({ id: p.id, name: p.labName, city: p.city || 'Partner Lab', type: 'PARTNER' }))
      ];
    } else {
      // Admin sees only their assigned branch or partner lab
      if (userBranchId) {
        const branch = await prisma.branch.findUnique({ where: { id: userBranchId } });
        if (branch) {
          locations.push({ id: branch.id, name: branch.name, city: branch.city, type: 'BRANCH' });
        }
      } else if (userPartnerId) {
        const partner = await prisma.pathologyPartner.findUnique({ where: { id: userPartnerId } });
        if (partner) {
          locations.push({ id: partner.id, name: partner.labName, city: partner.city || 'Partner Lab', type: 'PARTNER' });
        }
      }
    }

    res.json({ success: true, data: locations });
  } catch (err: any) {
    console.error('Error fetching admin locations:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch locations', error: err.message });
  }
};