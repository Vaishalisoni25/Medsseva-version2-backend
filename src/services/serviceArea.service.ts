import { prisma } from '../lib/prisma';

export function normalizePincode(pincode: string | null | undefined): string {
  return String(pincode || '').replace(/\D/g, '').slice(0, 6);
}

export async function hasConfiguredServiceAreas(): Promise<boolean> {
  const count = await prisma.serviceAreaPincode.count({ where: { isActive: true } });
  return count > 0;
}

export async function isPincodeServiceable(pincode: string | null | undefined): Promise<boolean> {
  const normalized = normalizePincode(pincode);
  if (!normalized || normalized.length < 6) return false;

  const configured = await hasConfiguredServiceAreas();
  if (!configured) return true;

  const match = await prisma.serviceAreaPincode.findFirst({
    where: { pincode: normalized, isActive: true },
  });
  return !!match;
}

export async function assertPincodeServiceable(pincode: string | null | undefined): Promise<void> {
  const serviceable = await isPincodeServiceable(pincode);
  if (!serviceable) {
    throw new Error('Services are not available in your area.');
  }
}
