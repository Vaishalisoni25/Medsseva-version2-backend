import { prisma } from '../lib/prisma';

/**
 * Generate a unique 8-character referral code (e.g. MEDS4A9X)
 */
export async function generateUniqueReferralCode(prefix: string = 'MEDS'): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude ambiguous chars like O, 0, I, 1
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `${prefix}${suffix}`;
    const existing = await prisma.user.findUnique({
      where: { referralCode: code },
    });
    if (!existing) {
      return code;
    }
  }

  // Fallback with timestamp suffix if collisions happen
  const timestampSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestampSuffix}`;
}
