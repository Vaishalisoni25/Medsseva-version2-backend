import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

interface SupportConfigData {
  id: string;
  supportPhone: string;
  supportCallHours: string;
  supportEmail: string;
  anydeskId: string;
  anydeskPassword?: string | null;
  anydeskInstructions: string;
  isCallSupportEnabled: boolean;
  isAnydeskSupportEnabled: boolean;
  updatedBy?: string | null;
  updatedAt: Date;
  createdAt: Date;
}

const DEFAULT_CONFIG: SupportConfigData = {
  id: 'singleton',
  supportPhone: '+91 98765 43210',
  supportCallHours: 'Mon - Sat: 8:00 AM - 8:00 PM',
  supportEmail: 'support@medsseva.com',
  anydeskId: '982 110 443',
  anydeskPassword: null,
  anydeskInstructions:
    '1. Download & launch the AnyDesk application.\n2. Share your 9-digit AnyDesk Address with our technical support engineer.\n3. Click \'Accept\' when the connection invitation is received.',
  isCallSupportEnabled: true,
  isAnydeskSupportEnabled: true,
  updatedBy: null,
  updatedAt: new Date(),
  createdAt: new Date(),
};

const getOrCreateSupportConfig = async (): Promise<SupportConfigData> => {
  try {
    if ((prisma as any).supportConfig) {
      let config = await (prisma as any).supportConfig.findUnique({
        where: { id: 'singleton' },
      });
      if (!config) {
        config = await (prisma as any).supportConfig.create({
          data: DEFAULT_CONFIG,
        });
      }
      return config;
    }
  } catch {
    // fallback to raw query
  }

  // Raw PostgreSQL queries
  const rows: any = await prisma.$queryRaw`
    SELECT * FROM "SupportConfig" WHERE id = 'singleton' LIMIT 1
  `;

  if (rows && rows.length > 0) {
    return rows[0];
  }

  await prisma.$executeRaw`
    INSERT INTO "SupportConfig" (
      "id", "supportPhone", "supportCallHours", "supportEmail", "anydeskId",
      "anydeskInstructions", "isCallSupportEnabled", "isAnydeskSupportEnabled",
      "updatedAt", "createdAt"
    ) VALUES (
      'singleton',
      ${DEFAULT_CONFIG.supportPhone},
      ${DEFAULT_CONFIG.supportCallHours},
      ${DEFAULT_CONFIG.supportEmail},
      ${DEFAULT_CONFIG.anydeskId},
      ${DEFAULT_CONFIG.anydeskInstructions},
      ${DEFAULT_CONFIG.isCallSupportEnabled},
      ${DEFAULT_CONFIG.isAnydeskSupportEnabled},
      NOW(),
      NOW()
    ) ON CONFLICT ("id") DO NOTHING
  `;

  const inserted: any = await prisma.$queryRaw`
    SELECT * FROM "SupportConfig" WHERE id = 'singleton' LIMIT 1
  `;

  return inserted?.[0] || DEFAULT_CONFIG;
};

export const getSupportConfig = async (_req: Request, res: Response) => {
  try {
    const config = await getOrCreateSupportConfig();
    res.json(config);
  } catch (error: any) {
    console.error('Failed to fetch support config:', error);
    res.status(500).json({ error: 'Failed to fetch support configuration', details: error.message });
  }
};

export const updateSupportConfig = async (req: AuthRequest, res: Response) => {
  try {
    const {
      supportPhone,
      supportCallHours,
      supportEmail,
      anydeskId,
      anydeskPassword,
      anydeskInstructions,
      isCallSupportEnabled,
      isAnydeskSupportEnabled,
    } = req.body;

    const current = await getOrCreateSupportConfig();

    const newPhone = supportPhone !== undefined ? supportPhone : current.supportPhone;
    const newHours = supportCallHours !== undefined ? supportCallHours : current.supportCallHours;
    const newEmail = supportEmail !== undefined ? supportEmail : current.supportEmail;
    const newAnydeskId = anydeskId !== undefined ? anydeskId : current.anydeskId;
    const newPassword = anydeskPassword !== undefined ? anydeskPassword : current.anydeskPassword;
    const newInstructions = anydeskInstructions !== undefined ? anydeskInstructions : current.anydeskInstructions;
    const newCallEnabled = isCallSupportEnabled !== undefined ? Boolean(isCallSupportEnabled) : current.isCallSupportEnabled;
    const newAnydeskEnabled = isAnydeskSupportEnabled !== undefined ? Boolean(isAnydeskSupportEnabled) : current.isAnydeskSupportEnabled;
    const updatedBy = req.user?.id || null;

    try {
      if ((prisma as any).supportConfig) {
        const updated = await (prisma as any).supportConfig.update({
          where: { id: 'singleton' },
          data: {
            supportPhone: newPhone,
            supportCallHours: newHours,
            supportEmail: newEmail,
            anydeskId: newAnydeskId,
            anydeskPassword: newPassword,
            anydeskInstructions: newInstructions,
            isCallSupportEnabled: newCallEnabled,
            isAnydeskSupportEnabled: newAnydeskEnabled,
            updatedBy,
          },
        });
        return res.json({
          message: 'Support channels configuration updated successfully',
          config: updated,
        });
      }
    } catch {
      // fallback to raw query
    }

    await prisma.$executeRaw`
      UPDATE "SupportConfig"
      SET
        "supportPhone" = ${newPhone},
        "supportCallHours" = ${newHours},
        "supportEmail" = ${newEmail},
        "anydeskId" = ${newAnydeskId},
        "anydeskPassword" = ${newPassword},
        "anydeskInstructions" = ${newInstructions},
        "isCallSupportEnabled" = ${newCallEnabled},
        "isAnydeskSupportEnabled" = ${newAnydeskEnabled},
        "updatedBy" = ${updatedBy},
        "updatedAt" = NOW()
      WHERE "id" = 'singleton'
    `;

    const updatedRows: any = await prisma.$queryRaw`
      SELECT * FROM "SupportConfig" WHERE id = 'singleton' LIMIT 1
    `;

    res.json({
      message: 'Support channels configuration updated successfully',
      config: updatedRows?.[0] || DEFAULT_CONFIG,
    });
  } catch (error: any) {
    console.error('Failed to update support config:', error);
    res.status(500).json({ error: 'Failed to update support configuration', details: error.message });
  }
};
