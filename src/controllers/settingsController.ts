import { Request, Response } from 'express';
import { ReportDeliveryMode } from '@prisma/client';
import { logAudit } from '../utils/auditLogger';
import { prisma } from '../lib/prisma';

const getOrCreateSettings = async () => {
  let settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings) {
    settings = await prisma.systemSettings.create({ data: { id: 'singleton' } });
  }
  return settings;
};

export const getSettings = async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

export const getVersion = async (req: Request, res: Response) => {  
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'singleton' },
      select: { platformVersion: true },
    });
    res.json({ version: settings?.platformVersion ?? 'Unknown' });
  } catch {
    res.json({ version: 'Unknown' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  const {
    minimumHomeCollectionAmount,
    homeCollectionCharge,
    defaultPartnerCommission,
    labOpenTime,
    labCloseTime,
    reportDeliveryMode,
    currency,
    timezone,
    platformVersion,
    maintenanceMode,
    allowBookings,
    allowPartnerRegistration,
  } = req.body;

  if (minimumHomeCollectionAmount !== undefined && minimumHomeCollectionAmount < 0) {
    return res.status(400).json({ error: 'Minimum home collection amount cannot be negative' });
  }
  if (homeCollectionCharge !== undefined && homeCollectionCharge < 0) {
    return res.status(400).json({ error: 'Home collection charge cannot be negative' });
  }
  if (defaultPartnerCommission !== undefined && (defaultPartnerCommission < 0 || defaultPartnerCommission > 100)) {
    return res.status(400).json({ error: 'Commission must be between 0 and 100' });
  }
  if (labOpenTime && labCloseTime && labOpenTime >= labCloseTime) {
    return res.status(400).json({ error: 'Opening time must be before closing time' });
  }
  if (reportDeliveryMode && !Object.values(ReportDeliveryMode).includes(reportDeliveryMode)) {
    return res.status(400).json({ error: 'Invalid report delivery mode' });
  }

  try {
    const old = await getOrCreateSettings();

    const userId = (req as any).user?.id;

    const updated = await prisma.systemSettings.update({
      where: { id: 'singleton' },
      data: {
        ...(minimumHomeCollectionAmount !== undefined && { minimumHomeCollectionAmount }),
        ...(homeCollectionCharge !== undefined && { homeCollectionCharge }),
        ...(defaultPartnerCommission !== undefined && { defaultPartnerCommission }),
        ...(labOpenTime !== undefined && { labOpenTime }),
        ...(labCloseTime !== undefined && { labCloseTime }),
        ...(reportDeliveryMode !== undefined && { reportDeliveryMode }),
        ...(currency !== undefined && { currency }),
        ...(timezone !== undefined && { timezone }),
        ...(platformVersion !== undefined && { platformVersion }),
        ...(maintenanceMode !== undefined && { maintenanceMode }),
        ...(allowBookings !== undefined && { allowBookings }),
        ...(allowPartnerRegistration !== undefined && { allowPartnerRegistration }),
        updatedBy: userId ?? null,
      },
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'UPDATE_SYSTEM_SETTINGS',
        module: 'settings',
        entityType: 'SystemSettings',
        entityId: 'singleton',
        performedByRole: (req as any).user?.role,
        ipAddress: req.ip,
        requestId: (req as any).requestId,
        severity: 'HIGH',
        status: 'SUCCESS',
        metadata: {
          old: {
            minimumHomeCollectionAmount: old.minimumHomeCollectionAmount,
            homeCollectionCharge: old.homeCollectionCharge,
            defaultPartnerCommission: old.defaultPartnerCommission,
            labOpenTime: old.labOpenTime,
            labCloseTime: old.labCloseTime,
            reportDeliveryMode: old.reportDeliveryMode,
            maintenanceMode: old.maintenanceMode,
            allowBookings: old.allowBookings,
            allowPartnerRegistration: old.allowPartnerRegistration,
          },
          new: {
            minimumHomeCollectionAmount: updated.minimumHomeCollectionAmount,
            homeCollectionCharge: updated.homeCollectionCharge,
            defaultPartnerCommission: updated.defaultPartnerCommission,
            labOpenTime: updated.labOpenTime,
            labCloseTime: updated.labCloseTime,
            reportDeliveryMode: updated.reportDeliveryMode,
            maintenanceMode: updated.maintenanceMode,
            allowBookings: updated.allowBookings,
            allowPartnerRegistration: updated.allowPartnerRegistration,
          },
        },
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
};