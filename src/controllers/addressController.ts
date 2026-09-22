import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { assertPincodeServiceable, normalizePincode } from '../services/serviceArea.service';

export const getAddresses = async (req: Request, res: Response) => {
  try {
    const { mobile } = req.query;

    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    const user = await prisma.user.findUnique({
      where: { mobile: mobile as string }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const addresses = await prisma.address.findMany({
      where: { userId: user.id }
    });

    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
};

export const addAddress = async (req: Request, res: Response) => {
  try {
    const { mobile, type, line1, line2, city, state, pincode, isDefault, latitude, longitude } = req.body;

    const user = await prisma.user.findUnique({
      where: { mobile: mobile as string }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const normalizedPincode = normalizePincode(pincode);
    if (!normalizedPincode || normalizedPincode.length < 6) {
      return res.status(400).json({ error: 'Valid 6-digit pincode is required.' });
    }

    try {
      await assertPincodeServiceable(normalizedPincode);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Services are not available in your area.' });
    }

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.create({
      data: {
        userId: user.id,
        type,
        line1,
        line2,
        city,
        state,
        pincode: normalizedPincode,
        latitude: latitude != null ? Number(latitude) : null,
        longitude: longitude != null ? Number(longitude) : null,
        isDefault
      }
    });

    res.status(201).json(address);
  } catch (error: any) {
    console.error('Error adding address:', error);
    res.status(500).json({ error: 'Failed to add address', details: error.message });
  }
};

export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const address = await prisma.address.delete({
      where: { id }
    });

    res.json({ message: 'Address deleted successfully', address });
  } catch (error: any) {
    console.error('Error deleting address:', error);
    res.status(500).json({ error: 'Failed to delete address', details: error.message });
  }
};
