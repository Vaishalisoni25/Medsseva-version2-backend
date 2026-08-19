import { Request, Response } from 'express';
import { branchService } from '../services/branch.service';

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
    const { isActive } = req.body;
    const branch = await branchService.toggleStatus(req.params.id, isActive);
    res.json({ success: true, data: branch });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};