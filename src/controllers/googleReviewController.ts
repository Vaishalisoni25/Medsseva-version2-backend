import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

const DEFAULT_REVIEW_CONFIG = {
  id: 'singleton',
  labPlaceName: 'MedsSeva Diagnostic Center & Pathology Laboratory',
  placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
  googleReviewUrl: 'https://g.page/r/medsseva-pathology/review',
  customMessage: 'Dear Patient, thank you for choosing MedsSeva Diagnostics! Please take a moment to share your valuable rating & review with us on Google:',
  totalClicks: 124,
  totalReviewsSent: 48,
  isActive: true,
};

const ensureReviewConfig = async () => {
  try {
    if ((prisma as any).googleReviewConfig) {
      let config = await (prisma as any).googleReviewConfig.findUnique({
        where: { id: 'singleton' },
      });
      if (!config) {
        config = await (prisma as any).googleReviewConfig.create({
          data: DEFAULT_REVIEW_CONFIG,
        });
      }
      return config;
    }
  } catch {
    // fallback
  }

  const existing: any = await prisma.$queryRaw`
    SELECT * FROM "GoogleReviewConfig" WHERE id = 'singleton' LIMIT 1
  `;
  if (!existing || existing.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO "GoogleReviewConfig" ("id", "labPlaceName", "placeId", "googleReviewUrl", "customMessage", "totalClicks", "totalReviewsSent", "isActive", "updatedAt", "createdAt")
      VALUES (
        'singleton',
        ${DEFAULT_REVIEW_CONFIG.labPlaceName},
        ${DEFAULT_REVIEW_CONFIG.placeId},
        ${DEFAULT_REVIEW_CONFIG.googleReviewUrl},
        ${DEFAULT_REVIEW_CONFIG.customMessage},
        ${DEFAULT_REVIEW_CONFIG.totalClicks},
        ${DEFAULT_REVIEW_CONFIG.totalReviewsSent},
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT ("id") DO NOTHING
    `;
    const inserted: any = await prisma.$queryRaw`SELECT * FROM "GoogleReviewConfig" WHERE id = 'singleton' LIMIT 1`;
    return inserted?.[0];
  }
  return existing[0];
};

export const getGoogleReviewConfig = async (_req: Request, res: Response) => {
  try {
    const config = await ensureReviewConfig();
    res.json(config);
  } catch (error: any) {
    console.error('Failed to get Google Review config:', error);
    res.status(500).json({ error: 'Failed to fetch Google Review config', details: error.message });
  }
};

export const updateGoogleReviewConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { labPlaceName, placeId, googleReviewUrl, customMessage, isActive } = req.body;

    if (!googleReviewUrl || !googleReviewUrl.trim()) {
      return res.status(400).json({ error: 'Google Review URL is required' });
    }

    const data: any = {
      updatedBy: req.user?.id || null,
      updatedAt: new Date(),
    };

    if (labPlaceName !== undefined) data.labPlaceName = labPlaceName.trim();
    if (placeId !== undefined) data.placeId = placeId ? placeId.trim() : null;
    if (googleReviewUrl !== undefined) data.googleReviewUrl = googleReviewUrl.trim();
    if (customMessage !== undefined) data.customMessage = customMessage.trim();
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    try {
      if ((prisma as any).googleReviewConfig) {
        const updated = await (prisma as any).googleReviewConfig.upsert({
          where: { id: 'singleton' },
          create: {
            ...DEFAULT_REVIEW_CONFIG,
            ...data,
            id: 'singleton',
          },
          update: data,
        });
        return res.json({ message: 'Google Review config updated successfully', config: updated });
      }
    } catch {
      // fallback
    }

    await prisma.$executeRaw`
      INSERT INTO "GoogleReviewConfig" ("id", "labPlaceName", "placeId", "googleReviewUrl", "customMessage", "isActive", "updatedBy", "updatedAt", "createdAt")
      VALUES (
        'singleton',
        ${data.labPlaceName || DEFAULT_REVIEW_CONFIG.labPlaceName},
        ${data.placeId || null},
        ${data.googleReviewUrl},
        ${data.customMessage || DEFAULT_REVIEW_CONFIG.customMessage},
        ${data.isActive !== undefined ? data.isActive : true},
        ${data.updatedBy},
        NOW(),
        NOW()
      )
      ON CONFLICT ("id") DO UPDATE SET
        "labPlaceName" = COALESCE(${data.labPlaceName}, "GoogleReviewConfig"."labPlaceName"),
        "placeId" = ${data.placeId},
        "googleReviewUrl" = COALESCE(${data.googleReviewUrl}, "GoogleReviewConfig"."googleReviewUrl"),
        "customMessage" = COALESCE(${data.customMessage}, "GoogleReviewConfig"."customMessage"),
        "isActive" = COALESCE(${data.isActive}, "GoogleReviewConfig"."isActive"),
        "updatedBy" = ${data.updatedBy},
        "updatedAt" = NOW()
    `;

    const updatedRows: any = await prisma.$queryRaw`SELECT * FROM "GoogleReviewConfig" WHERE id = 'singleton' LIMIT 1`;
    res.json({ message: 'Google Review config updated successfully', config: updatedRows?.[0] });
  } catch (error: any) {
    console.error('Failed to update Google Review config:', error);
    res.status(500).json({ error: 'Failed to update Google Review config', details: error.message });
  }
};

export const trackGoogleReviewClick = async (_req: Request, res: Response) => {
  try {
    try {
      if ((prisma as any).googleReviewConfig) {
        await (prisma as any).googleReviewConfig.update({
          where: { id: 'singleton' },
          data: { totalClicks: { increment: 1 } },
        });
        return res.json({ success: true });
      }
    } catch {
      // fallback
    }

    await prisma.$executeRaw`
      UPDATE "GoogleReviewConfig"
      SET "totalClicks" = "totalClicks" + 1
      WHERE id = 'singleton'
    `;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to track review click' });
  }
};

export const trackGoogleReviewSent = async (_req: Request, res: Response) => {
  try {
    try {
      if ((prisma as any).googleReviewConfig) {
        await (prisma as any).googleReviewConfig.update({
          where: { id: 'singleton' },
          data: { totalReviewsSent: { increment: 1 } },
        });
        return res.json({ success: true });
      }
    } catch {
      // fallback
    }

    await prisma.$executeRaw`
      UPDATE "GoogleReviewConfig"
      SET "totalReviewsSent" = "totalReviewsSent" + 1
      WHERE id = 'singleton'
    `;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to track review sent' });
  }
};
