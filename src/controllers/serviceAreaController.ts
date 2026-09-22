import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { isPincodeServiceable, normalizePincode } from '../services/serviceArea.service';

export const checkServiceArea = async (req: Request, res: Response) => {
  try {
    const pincode = normalizePincode(req.query.pincode as string);
    if (!pincode || pincode.length < 6) {
      return res.status(400).json({ error: 'Valid 6-digit pincode is required.' });
    }

    const serviceable = await isPincodeServiceable(pincode);
    res.json({
      pincode,
      serviceable,
      message: serviceable
        ? 'Services are available in your area.'
        : 'Services are not available in your area.',
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to check service area', details: error.message });
  }
};

export const listServiceAreas = async (_req: Request, res: Response) => {
  try {
    const areas = await prisma.serviceAreaPincode.findMany({
      orderBy: [{ isActive: 'desc' }, { pincode: 'asc' }],
    });
    res.json(areas);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch service areas', details: error.message });
  }
};

export const createServiceArea = async (req: Request, res: Response) => {
  try {
    const pincode = normalizePincode(req.body.pincode);
    if (!pincode || pincode.length < 6) {
      return res.status(400).json({ error: 'Valid 6-digit pincode is required.' });
    }

    const area = await prisma.serviceAreaPincode.create({
      data: {
        pincode,
        city: req.body.city?.trim() || null,
        state: req.body.state?.trim() || null,
        latitude: req.body.latitude != null ? Number(req.body.latitude) : null,
        longitude: req.body.longitude != null ? Number(req.body.longitude) : null,
        isActive: req.body.isActive !== false,
      },
    });

    res.status(201).json(area);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'This pincode is already configured.' });
    }
    res.status(500).json({ error: 'Failed to create service area', details: error.message });
  }
};

export const updateServiceArea = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data: Record<string, unknown> = {};

    if (req.body.pincode !== undefined) {
      const pincode = normalizePincode(req.body.pincode);
      if (!pincode || pincode.length < 6) {
        return res.status(400).json({ error: 'Valid 6-digit pincode is required.' });
      }
      data.pincode = pincode;
    }
    if (req.body.city !== undefined) data.city = req.body.city?.trim() || null;
    if (req.body.state !== undefined) data.state = req.body.state?.trim() || null;
    if (req.body.latitude !== undefined) data.latitude = req.body.latitude != null ? Number(req.body.latitude) : null;
    if (req.body.longitude !== undefined) data.longitude = req.body.longitude != null ? Number(req.body.longitude) : null;
    if (req.body.isActive !== undefined) data.isActive = !!req.body.isActive;

    const area = await prisma.serviceAreaPincode.update({ where: { id }, data });
    res.json(area);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update service area', details: error.message });
  }
};

export const deleteServiceArea = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.serviceAreaPincode.delete({ where: { id } });
    res.json({ message: 'Service area removed.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete service area', details: error.message });
  }
};

export const syncServiceAreasFromBranches = async (_req: Request, res: Response) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      select: { pincode: true, city: true, state: true, latitude: true, longitude: true },
    });

    let created = 0;
    for (const branch of branches) {
      const pincode = normalizePincode(branch.pincode);
      if (!pincode || pincode.length < 6) continue;

      await prisma.serviceAreaPincode.upsert({
        where: { pincode },
        update: {
          city: branch.city,
          state: branch.state,
          latitude: branch.latitude,
          longitude: branch.longitude,
          isActive: true,
        },
        create: {
          pincode,
          city: branch.city,
          state: branch.state,
          latitude: branch.latitude,
          longitude: branch.longitude,
          isActive: true,
        },
      });
      created += 1;
    }

    res.json({ message: `Synced ${created} service area pincodes from branches.` });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to sync service areas', details: error.message });
  }
};
