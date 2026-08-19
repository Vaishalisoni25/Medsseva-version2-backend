import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { sendNotificationToUser } from '../services/notification.service';



export const getOrCreateConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    let conversation = await prisma.conversation.findFirst({
      where: { userId, status: { not: 'CLOSED' } },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 50 },
        assignedTo: { include: { user: true } },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { userId, status: 'AI_ACTIVE' },
        include: {
          messages: true,
          assignedTo: { include: { user: true } },
        },
      });
    }

    res.json(conversation);
  } catch {
    res.status(500).json({ error: 'Failed to get conversation' });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { cursor, limit = '30' } = req.query;

    const messages = await prisma.chatMessage.findMany({
      where: {
        conversationId,
        ...(cursor ? { createdAt: { lt: new Date(cursor as string) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });

    res.json(messages.reverse());
  } catch {
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

export const getAllConversations = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search } = req.query;

    const conversations = await prisma.conversation.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(search
          ? { user: { name: { contains: search as string, mode: 'insensitive' } } }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true, mobile: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        assignedTo: { include: { user: { select: { name: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(conversations);
  } catch {
    res.status(500).json({ error: 'Failed to get conversations' });
  }
};

export const getConversationById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, mobile: true, avatarUrl: true, bookings: { take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, bookingCode: true, status: true, createdAt: true } } } },
        messages: { orderBy: { createdAt: 'asc' }, take: 50 },
        assignedTo: { include: { user: { select: { name: true } } } },
        assignments: { include: { adminUser: { include: { user: { select: { name: true } } } } }, orderBy: { assignedAt: 'desc' } },
      },
    });

    if (!conversation) return res.status(404).json({ error: 'Not found' });

    res.json(conversation);
  } catch {
    res.status(500).json({ error: 'Failed to get conversation' });
  }
};

export const assignConversation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { adminUserId } = req.body;

    const conversation = await prisma.conversation.update({
      where: { id },
      data: { assignedToId: adminUserId, status: 'HUMAN_ACTIVE' },
    });

    await prisma.supportAssignment.create({
      data: { conversationId: id, adminUserId },
    });

const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true } } },
    });

    if (conv) {
      sendNotificationToUser(conv.userId, 'Support Agent Assigned', 'A support agent has joined your conversation.', 'SUPPORT_REPLY').catch(console.error);
    }

    res.json(conversation);
  } catch {
    res.status(500).json({ error: 'Failed to assign' });
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const conversation = await prisma.conversation.findFirst({
      where: { userId, status: { not: 'CLOSED' } },
      select: { id: true },
    });

    if (!conversation) return res.json({ count: 0 });

    const count = await prisma.chatMessage.count({
      where: {
        conversationId: conversation.id,
        isRead: false,
        senderType: { not: 'USER' },
      },
    });

    res.json({ count });
  } catch {
    res.status(500).json({ error: 'Failed to get unread count' });
  }
};