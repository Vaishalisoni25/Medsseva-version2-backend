import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  sendNotificationToUser,
  sendNotificationToMultipleUsers,
  sendBroadcastToAllUsers,
  sendBroadcastToRole,
  retryFailedNotifications,
} from '../services/notification.service';



export const registerToken = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { token, platform } = req.body;

    if (!token || !platform) {
      return res.status(400).json({ error: 'token and platform are required' });
    }

    await prisma.deviceToken.upsert({
      where: { userId_token: { userId, token } },
      update: { platform, updatedAt: new Date() },
      create: { userId, token, platform },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to register token', details: error.message });
  }
};

export const unregisterToken = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    await prisma.deviceToken.deleteMany({ where: { userId, token } });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to unregister token', details: error.message });
  }
};

export const getMyNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.json({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + notifications.length < total,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to mark as read', details: error.message });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to mark all as read', details: error.message });
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.delete({ where: { id } });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete notification', details: error.message });
  }
};

export const getNotificationLogs = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notificationLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch logs', details: error.message });
  }
};

export const sendBroadcast = async (req: Request, res: Response) => {
  try {
    const { title, body, target, userIds, partnerIds } = req.body;

    if (!title || !body || !target) {
      return res.status(400).json({ error: 'title, body, and target are required' });
    }

    if (target === 'ALL_USERS') {
      await sendBroadcastToAllUsers(title, body, 'BROADCAST');
    } else if (target === 'ALL_PARTNERS') {
      await sendBroadcastToRole('PATHOLOGY_PARTNER', title, body, 'BROADCAST');
    } else if (target === 'SELECTED_USERS' && Array.isArray(userIds)) {
      await sendNotificationToMultipleUsers(userIds, title, body, 'BROADCAST');
    } else if (target === 'SELECTED_PARTNERS' && Array.isArray(partnerIds)) {
      await sendNotificationToMultipleUsers(partnerIds, title, body, 'BROADCAST');
    } else {
      return res.status(400).json({ error: 'Invalid target or missing userIds/partnerIds' });
    }

    res.json({ success: true, message: 'Broadcast sent' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send broadcast', details: error.message });
  }
};

export const retryFailed = async (req: Request, res: Response) => {
  try {
    await retryFailedNotifications();
    res.json({ success: true, message: 'Retry triggered' });
  } catch (error: any) {
    res.status(500).json({ error: 'Retry failed', details: error.message });
  }
};