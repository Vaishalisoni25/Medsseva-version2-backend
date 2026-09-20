import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;

export function generateOtp(length: number = 4): string {
  if (length === 4) {
    const num = Math.floor(1000 + Math.random() * 9000);
    return num.toString();
  }
  const buffer = crypto.randomBytes(3);
  const num = buffer.readUIntBE(0, 3) % 900000 + 100000;
  return num.toString();
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

export async function verifyOtpHash(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

export function getOtpExpiry(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

export function isOtpExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return new Date() > expiresAt;
}

export function isResendAllowed(lastSentAt: Date | null): boolean {
  if (!lastSentAt) return true;
  const diff = (Date.now() - lastSentAt.getTime()) / 1000;
  return diff >= RESEND_COOLDOWN_SECONDS;
}

export function getResendCooldownRemaining(lastSentAt: Date | null): number {
  if (!lastSentAt) return 0;
  const diff = (Date.now() - lastSentAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - diff));
}

export { MAX_ATTEMPTS };