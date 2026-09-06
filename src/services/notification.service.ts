import { NotificationType, NotificationStatus } from '@prisma/client';
import { google } from 'googleapis';
import axios from 'axios';
import { prisma } from '../lib/prisma';

const CHANNEL_MAP: Record<NotificationType, string> = {
  BOOKING_CREATED: 'bookings',
  BOOKING_ACCEPTED: 'bookings',
  BOOKING_REJECTED: 'bookings',
  BOOKING_CANCELLED: 'bookings',
  BOOKING_RESCHEDULED: 'bookings',
  PARTNER_ON_THE_WAY: 'bookings',
  PARTNER_ARRIVED: 'bookings',
  SAMPLE_COLLECTED: 'bookings',
  SAMPLE_RECEIVED_IN_LAB: 'bookings',
  REPORT_READY: 'reports',
  REPORT_SENT: 'reports',
  REPORT_APPROVED: 'reports',
  PAYMENT_SUCCESS: 'payments',
  PAYMENT_FAILED: 'payments',
  NEW_BOOKING_ASSIGNED: 'bookings',
  BOOKING_CANCELLED_BY_USER: 'bookings',
  PATIENT_REACHED_LAB: 'bookings',
  BOOKING_COMPLETED: 'bookings',
  NEW_CHAT_MESSAGE: 'chat',
  SUPPORT_REPLY: 'chat',
  NEW_OFFER: 'general',
  NEW_PACKAGE: 'general',
  PRICE_UPDATE: 'general',
  APPOINTMENT_REMINDER: 'bookings',
  MISSED_APPOINTMENT: 'bookings',
BROADCAST: 'general',
  PARTNER_RATING_REQUEST: 'general',
};

const getDeepLink = (type: NotificationType, data?: Record<string, any>): string => {
  switch (type) {
    case 'BOOKING_CREATED':
    case 'BOOKING_ACCEPTED':
    case 'BOOKING_REJECTED':
    case 'PARTNER_ARRIVED':
      return data?.bookingId ? `medssevaapp://bookings/${data.bookingId}` : 'medssevaapp://bookings';
    case 'PARTNER_ON_THE_WAY':
      return data?.bookingId ? `medssevaapp://track/${data.bookingId}` : 'medssevaapp://bookings';
    case 'SAMPLE_COLLECTED':
      return data?.bookingId ? `medssevaapp://bookings/${data.bookingId}?tab=timeline` : 'medssevaapp://bookings';
    case 'REPORT_READY':
    case 'REPORT_SENT':
    case 'REPORT_APPROVED':
      return 'medssevaapp://reports';
    case 'PAYMENT_SUCCESS':
      return data?.bookingId ? `medssevaapp://bookings/${data.bookingId}` : 'medssevaapp://bookings';
    case 'PAYMENT_FAILED':
      return data?.bookingId ? `medssevaapp://checkout/payment?bookingId=${data.bookingId}` : 'medssevaapp://bookings';
    case 'BOOKING_CANCELLED':
    case 'BOOKING_CANCELLED_BY_USER':
    case 'BOOKING_RESCHEDULED':
      return data?.bookingId ? `medssevaapp://bookings/${data.bookingId}` : 'medssevaapp://bookings';
  case 'PATIENT_REACHED_LAB':
      return data?.bookingId ? `medssevaapp://bookings/${data.bookingId}` : 'medssevaapp://bookings';
    case 'BOOKING_COMPLETED':
      return data?.bookingId ? `medssevaapp://bookings/${data.bookingId}` : 'medssevaapp://bookings';
    case 'NEW_BOOKING_ASSIGNED':
      return 'medssevaapp://partner/home';
    case 'NEW_CHAT_MESSAGE':
    case 'SUPPORT_REPLY':
      return 'medssevaapp://support/chat';
    case 'SAMPLE_RECEIVED_IN_LAB':
      return data?.bookingId ? `medssevaapp://bookings/${data.bookingId}` : 'medssevaapp://bookings';
    case 'NEW_OFFER':
      return data?.offerId ? `medssevaapp://offer/${data.offerId}` : 'medssevaapp://';
    case 'NEW_PACKAGE':
    case 'PRICE_UPDATE':
      return 'medssevaapp://package';
    case 'APPOINTMENT_REMINDER':
    case 'MISSED_APPOINTMENT':
      return data?.bookingId ? `medssevaapp://bookings/${data.bookingId}` : 'medssevaapp://bookings';
case 'PARTNER_RATING_REQUEST':
      return data?.bookingId ? `medssevaapp://bookings/${data.bookingId}` : 'medssevaapp://';
    default:
      return 'medssevaapp://';
  }
};
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

const getAccessToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }
  const auth = new google.auth.GoogleAuth({
    credentials: {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  cachedToken = tokenResponse.token as string;
  tokenExpiry = Date.now() + 3600000;
  return cachedToken;
};
const sendFcmToToken = async (
  fcmToken: string,
  title: string,
  body: string,
  type: NotificationType,
  data?: Record<string, any>
): Promise<{ success: boolean; response?: any; error?: string }> => {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID!;

    const accessToken = await getAccessToken();
    const channel = CHANNEL_MAP[type] || 'general';
    const deepLink = getDeepLink(type, data);

    const payload: any = {
      message: {
        token: fcmToken,
        notification: { title, body },
        android: {
          priority: 'high',
          notification: {
            channel_id: channel,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              sound: 'default',
              badge: 1,
              'content-available': 1,
            },
          },
        },
        data: {
          type,
          deepLink,
          ...(data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {}),
        },
      },
    };

    const response = await axios.post(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return { success: true, response: response.data };
  } catch (error: any) {
    const errMsg = error.response?.data?.error?.message || error.message;
    return { success: false, error: errMsg };
  }
};

const isInvalidToken = (errorMsg: string): boolean => {
  const invalidPatterns = [
    'registration-token-not-registered',
    'invalid-registration-token',
    'INVALID_ARGUMENT',
    'Requested entity was not found',
  ];
  return invalidPatterns.some(p => errorMsg.includes(p));
};

export const sendNotificationToUser = async (
  userId: string,
  title: string,
  body: string,
  type: NotificationType,
  data?: Record<string, any>
): Promise<void> => {
  const deepLink = getDeepLink(type, data);

  await prisma.notification.create({
    data: {
      userId,
      title,
      body,
      type,
      data: data || {},
      deepLink,
    },
  });

  const tokens = await prisma.deviceToken.findMany({ where: { userId } });
  if (tokens.length === 0) return;

  const log = await prisma.notificationLog.create({
    data: { userId, title, body, type, status: 'PENDING' },
  });

  const results = await Promise.allSettled(
    tokens.map(t => sendFcmToToken(t.token, title, body, type, data))
  );

  let anySuccess = false;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const token = tokens[i];

    if (result.status === 'fulfilled' && result.value.success) {
      anySuccess = true;
    } else {
      const errMsg = result.status === 'fulfilled'
        ? (result.value.error || 'Unknown')
        : String((result as PromiseRejectedResult).reason);

      if (isInvalidToken(errMsg)) {
        await prisma.deviceToken.delete({ where: { id: token.id } }).catch(() => {});
        console.log(`Removed invalid FCM token for user ${userId}`);
      }
    }
  }

  await prisma.notificationLog.update({
    where: { id: log.id },
    data: {
      status: anySuccess ? 'SENT' : 'FAILED',
      sentAt: anySuccess ? new Date() : undefined,
      fcmResponse: results.map(r => r.status === 'fulfilled' ? r.value : { error: String((r as any).reason) }),
    },
  });
};

export const sendNotificationToMultipleUsers = async (
  userIds: string[],
  title: string,
  body: string,
  type: NotificationType,
  data?: Record<string, any>
): Promise<void> => {
  await Promise.allSettled(
    userIds.map(uid => sendNotificationToUser(uid, title, body, type, data))
  );
};

export const sendBroadcastToRole = async (
  role: string,
  title: string,
  body: string,
  type: NotificationType,
  data?: Record<string, any>
): Promise<void> => {
  const users = await prisma.user.findMany({
    where: { role: role as any },
    select: { id: true },
  });
  const userIds = users.map(u => u.id);
  await sendNotificationToMultipleUsers(userIds, title, body, type, data);
};

export const sendBroadcastToAllUsers = async (
  title: string,
  body: string,
  type: NotificationType,
  data?: Record<string, any>
): Promise<void> => {
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    select: { id: true },
  });
  const userIds = users.map(u => u.id);
  await sendNotificationToMultipleUsers(userIds, title, body, type, data);
};

export const triggerApprovalNotification = async (
  userId: string,
  roleName: string,
  email?: string | null
): Promise<void> => {
  const title = 'Account Approved!';
  const body = `Congratulations! Your MedsSeva ${roleName} account has been verified and approved by Admin. You can now access your operational dashboard.`;

  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type: 'BROADCAST',
        isRead: false,
        deepLink: 'medssevaapp://',
      },
    });
  } catch (err) {
    console.warn('In-app notification creation error:', err);
  }

  // Attempt push notification
  try {
    const tokens = await prisma.deviceToken.findMany({ where: { userId } });
    for (const tokenRecord of tokens) {
      await sendFcmToToken(tokenRecord.token, title, body, 'BROADCAST', {}).catch(() => {});
    }
  } catch (err) {
    console.warn('Push notification send error:', err);
  }
};

export const retryFailedNotifications = async (): Promise<void> => {
  const failed = await prisma.notificationLog.findMany({
    where: { status: 'FAILED', retryCount: { lt: 3 } },
    take: 50,
  });

  for (const log of failed) {
    if (!log.userId) continue;
    const tokens = await prisma.deviceToken.findMany({ where: { userId: log.userId } });
    if (tokens.length === 0) continue;

    const results = await Promise.allSettled(
      tokens.map(t => sendFcmToToken(t.token, log.title, log.body, log.type, {}))
    );

    const anySuccess = results.some(r => r.status === 'fulfilled' && (r as any).value.success);

    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: anySuccess ? 'SENT' : 'FAILED',
        retryCount: { increment: 1 },
        sentAt: anySuccess ? new Date() : undefined,
      },
    });
  }
};