const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key] || process.env[key]!.trim() === '') {
      missing.push(key);
    }
  }

  const hasImageKit = Boolean(process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_PUBLIC_KEY);
  const hasCloudinary = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

  if (!hasImageKit && !hasCloudinary) {
    missing.push('IMAGEKIT_PRIVATE_KEY & IMAGEKIT_PUBLIC_KEY (or CLOUDINARY credentials)');
  }

  if (missing.length > 0) {
    console.error('[STARTUP] FATAL: Missing required environment variables:');
    for (const key of missing) {
      console.error(`  - ${key}`);
    }
    console.error('[STARTUP] Application cannot start. Configure all required environment variables.');
    process.exit(1);
  }
}

export const env = {
  get jwtSecret(): string {
    return process.env.JWT_SECRET!;
  },
  get razorpayKeyId(): string {
    return process.env.RAZORPAY_KEY_ID!;
  },
  get razorpayKeySecret(): string {
    return process.env.RAZORPAY_KEY_SECRET!;
  },
  get razorpayWebhookSecret(): string {
    return process.env.RAZORPAY_WEBHOOK_SECRET!;
  },
  get cloudinaryCloudName(): string {
    return process.env.CLOUDINARY_CLOUD_NAME!;
  },
  get cloudinaryApiKey(): string {
    return process.env.CLOUDINARY_API_KEY!;
  },
  get cloudinaryApiSecret(): string {
    return process.env.CLOUDINARY_API_SECRET!;
  },
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  },
};  