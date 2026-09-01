import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import Groq from 'groq-sdk';
import { sendNotificationToUser } from '../services/notification.service';
let groqClient: Groq | null = null;
function getGroq(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
  }
  return groqClient;
}

async function fetchLiveContext(userMessage: string, prisma: PrismaClient): Promise<string> {
  const lower = userMessage.toLowerCase();
  const contextParts: string[] = [];

  try {
    const testKeywords = ['price', 'cost', 'test', 'cbc', 'lipid', 'thyroid', 'vitamin', 'diabetes',
      'hba1c', 'blood', 'urine', 'ecg', 'sugar', 'creatinine', 'liver', 'kidney',
      'hemoglobin', 'platelet', 'cholesterol', 'tsh', 'ft3', 'ft4', 'pcod', 'pcos',
      'hormone', 'calcium', 'iron', 'ferritin', 'b12', 'vitamin d', 'serum', 'check'];

    const packageKeywords = ['package', 'full body', 'seva woman', 'sevawoman', 'seva man',
      'sevaman', 'health checkup', 'complete health', 'profile', 'panel', 'bundle'];

    const offerKeywords = ['offer', 'discount', 'coupon', 'promo', 'deal', 'sale', 'code', 'cheap', 'affordable'];

    const branchKeywords = ['branch', 'lab', 'center', 'location', 'address', 'near me', 'visit', 'walk in', 'walkin'];

    const cityKeywords = ['city', 'cities', 'available', 'service', 'area', 'where', 'coverage'];

    const isTestQuery = testKeywords.some((k) => lower.includes(k));
    const isPackageQuery = packageKeywords.some((k) => lower.includes(k));
    const isOfferQuery = offerKeywords.some((k) => lower.includes(k));
    const isBranchQuery = branchKeywords.some((k) => lower.includes(k));
    const isCityQuery = cityKeywords.some((k) => lower.includes(k));

    if (isTestQuery && !isPackageQuery) {
      const words = lower.split(/\s+/).filter((w) => w.length > 2);
      const tests = await prisma.test.findMany({
        where: {
          OR: [
            ...words.map((w) => ({ name: { contains: w, mode: 'insensitive' as const } })),
            ...words.map((w) => ({ description: { contains: w, mode: 'insensitive' as const } })),
          ],
        },
        take: 5,
        select: {
          name: true,
          price: true,
          discountedPrice: true,
          description: true,
          preparation: true,
          reportTime: true,
          fastingRequired: true,
          homeCollection: true,
          category: { select: { name: true } },
        },
      });

      if (tests.length > 0) {
        contextParts.push('MATCHING TESTS FROM DATABASE:');
        tests.forEach((t) => {
          contextParts.push(
            `- ${t.name} | Price: ₹${t.discountedPrice ?? t.price}${t.discountedPrice && t.discountedPrice < t.price ? ` (MRP ₹${t.price})` : ''} | Category: ${t.category?.name || 'General'} | Report Time: ${t.reportTime || 'Same Day'} | Fasting Required: ${t.fastingRequired ? 'Yes' : 'No'} | Home Collection: ${t.homeCollection ? 'Available' : 'Not Available'} | Preparation: ${t.preparation || 'No special preparation needed'} | About: ${t.description || ''}`
          );
        });
      }

      const allTests = await prisma.test.findMany({
        take: 30,
        select: { name: true, price: true, discountedPrice: true, category: { select: { name: true } } },
        orderBy: { name: 'asc' },
        where: { isActive: true },
      });
      if (allTests.length > 0) {
        contextParts.push('ALL AVAILABLE TESTS (name and price):');
        allTests.forEach((t) => {
          contextParts.push(`- ${t.name}: ₹${t.discountedPrice ?? t.price}`);
        });
      }
    }

    if (isPackageQuery) {
      const packages = await prisma.healthPackage.findMany({
        take: 10,
        where: { isActive: true },
        select: {
          name: true,
          price: true,
          oldPrice: true,
          description: true,
          parametersCount: true,
          category: true,
          testsIncluded: { select: { test: { select: { name: true } } }, take: 15 },
        },
      });

      if (packages.length > 0) {
        contextParts.push('AVAILABLE HEALTH PACKAGES FROM DATABASE:');
        packages.forEach((p) => {
          const testList = p.testsIncluded?.map((pt: any) => pt.test?.name).filter(Boolean).join(', ') || '';
          contextParts.push(
            `- ${p.name} | Price: ₹${p.price}${p.oldPrice && p.oldPrice > p.price ? ` (MRP ₹${p.oldPrice})` : ''} | Category: ${p.category || ''} | Parameters: ${p.parametersCount || 0} | Tests Included: ${testList} | Description: ${p.description || ''}`
          );
        });
      }
    }

    if (isOfferQuery) {
      const coupons = await prisma.coupon.findMany({
        where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
        take: 5,
        select: { code: true, discountType: true, discountValue: true, minOrderAmount: true, maxDiscount: true, description: true },
      });

      if (coupons.length > 0) {
        contextParts.push('ACTIVE OFFERS & COUPONS:');
        coupons.forEach((c) => {
          const discountStr = c.discountType === 'PERCENTAGE' ? `${c.discountValue}% off` : `₹${c.discountValue} off`;
          contextParts.push(
            `- Code: ${c.code} | ${discountStr}${c.minOrderAmount ? ` | Min order: ₹${c.minOrderAmount}` : ''}${c.maxDiscount ? ` | Max discount: ₹${c.maxDiscount}` : ''}${c.description ? ` | ${c.description}` : ''}`
          );
        });
      }
    }

    if (isBranchQuery) {
      const branches = await prisma.branch.findMany({
        take: 10,
        where: { isActive: true },
        select: { name: true, line1: true, city: true, state: true, contactNumber: true, workingHours: true },
      });

      if (branches.length > 0) {
        contextParts.push('MEDSEVA BRANCHES:');
        branches.forEach((b) => {
          contextParts.push(
            `- ${b.name} | City: ${b.city || ''}, ${b.state || ''} | Address: ${b.line1 || ''} | Phone: ${b.contactNumber || ''} | Hours: ${b.workingHours || ''}`
          );
        });
      }
    }

    if (isCityQuery) {
      const cities = await prisma.city.findMany({
        where: { isActive: true },
        select: { name: true },
        orderBy: { name: 'asc' },
      });

      if (cities.length > 0) {
        contextParts.push(`CITIES WHERE MEDSEVA IS AVAILABLE: ${cities.map((c) => c.name).join(', ')}`);
      }
    }
  } catch {
  }

  return contextParts.join('\n');
}

async function getAIReply(
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  liveContext: string
): Promise<string> {
  try {
    const contextSection = liveContext
      ? `\n\nLIVE DATA FROM MEDSEVA DATABASE (this is the source of truth - always use this data, never invent values):\n${liveContext}\n`
      : '';

    const systemPrompt = `You are SevaBot, MedsSeva's friendly AI Health Assistant. MedsSeva is a diagnostic lab platform offering home blood sample collection, diagnostic tests, health packages, and report delivery across India.${contextSection}

Your responsibilities:
- Answer all questions about MedsSeva services: tests, packages, prices, home collection, booking process, reports, prescriptions, payments, offers, branches, cities, and general health test FAQs
- Always use the LIVE DATA provided above - never invent or guess prices, test names, or any details
- When live data is available, use it to give accurate and specific answers
- Be concise, warm, helpful, and professional
- Support natural conversation: greetings, follow-up questions, clarifications
- Respond in the same language the user uses (Hindi, English, Hinglish, etc.)
- Format prices with the ₹ symbol
- For booking: explain the flow - search test → choose slot → enter address → pay → home collection
- For reports: they appear in the Reports tab and can be downloaded as PDF
- For home collection: available by certified phlebotomists, free above minimum order value
- For prescription upload: Camera, Gallery, or File Picker - supports PDF, JPG, PNG, WEBP, DOC, DOCX
- For payments: UPI, Debit Card, Credit Card, Net Banking, Wallets, Cash on Collection
- For tracking: real-time partner tracking available from Bookings tab

Escalation rules (CRITICAL):
- If the user wants to speak with a human, real person, agent, executive, customer care, customer support, representative, or live support - reply with exactly: ESCALATE
- If the user expresses frustration and demands human help - reply with exactly: ESCALATE
- If you genuinely cannot answer the user's question after reviewing all available context and your knowledge - reply with exactly: ESCALATE
- For greetings (Hi, Hello, Good morning, etc.) - respond warmly, introduce yourself, and ask how you can help
- NEVER reply ESCALATE for normal service questions - always attempt to answer
- NEVER provide medical diagnosis, treatment advice, medicine recommendations, or lab result interpretation
- NEVER answer questions completely unrelated to MedsSeva
- Only reply with the word ESCALATE (nothing else) when escalating`;

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

   const response = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 500,
      temperature: 0.4,
    });

    const text = response.choices[0]?.message?.content?.trim();

    if (!text) return "I'm here to help! Could you please rephrase your question?";
    return text;
  } catch (err) {
    console.error('[SevaBot] Groq error:', err);
    return "I'm having trouble connecting right now. Please try again in a moment.";
  }
}
export function registerChatHandlers(io: Server, socket: Socket, prisma: PrismaClient) {
  const userId = (socket as any).userId as string;
  const userRole = (socket as any).userRole as string;
  const userName = (socket as any).userName as string;

  socket.on('chat:join', async ({ conversationId }: { conversationId: string }) => {
    socket.join(`conversation:${conversationId}`);

    await prisma.chatMessage.updateMany({
      where: { conversationId, isRead: false, senderType: { not: 'USER' } },
      data: { isRead: true, readAt: new Date() },
    });

    io.to(`conversation:${conversationId}`).emit('chat:read', { conversationId, readBy: userId });
  });

  socket.on('chat:send', async ({ conversationId, text, attachmentUrl, attachmentType }: {
    conversationId: string;
    text?: string;
    attachmentUrl?: string;
    attachmentType?: string;
  }) => {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
      });

      if (!conversation) return;

      const isAgent = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
      const senderType = isAgent ? 'AGENT' : 'USER';

      const userMsg = await prisma.chatMessage.create({
        data: {
          conversationId,
          senderType,
          senderId: userId,
          text,
          attachmentUrl,
          attachmentType,
          deliveredAt: new Date(),
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

 io.to(`conversation:${conversationId}`).emit('chat:message', {
        ...userMsg,
        senderName: userName,
      });

    if (isAgent && conversation.userId) {
        sendNotificationToUser(
          conversation.userId,
          'New Support Message',
          text || 'You have a new message from support.',
          'NEW_CHAT_MESSAGE',
          { conversationId }
        ).catch(console.error);
      }

      if (!isAgent && conversation.status === 'HUMAN_ACTIVE' && conversation.assignedToId) {
        const adminUser = await prisma.adminUser.findUnique({
          where: { id: conversation.assignedToId },
          select: { userId: true },
        });
        if (adminUser?.userId) {
          sendNotificationToUser(
            adminUser.userId,
            'New Customer Message',
            text || 'A customer sent a new message.',
            'NEW_CHAT_MESSAGE',
            { conversationId }
          ).catch(console.error);
        }
      }

      if (isAgent) return;
      if (conversation.status === 'HUMAN_ACTIVE') return;
      if (conversation.status === 'PENDING_HUMAN') return;

      if (conversation.status === 'AI_ACTIVE') {
        const history = conversation.messages
          .filter((m) => m.senderType === 'USER' || m.senderType === 'BOT')
          .slice(-12)
          .map((m) => ({
            role: m.senderType === 'USER' ? ('user' as const) : ('assistant' as const),
            content: m.text || '',
          }));

        const liveContext = await fetchLiveContext(text || '', prisma);
        const aiReply = await getAIReply(text || '', history, liveContext);

        if (aiReply === 'ESCALATE') {
          await escalateConversation(io, prisma, conversationId, userId, userName);
          return;
        }

        const botMsg = await prisma.chatMessage.create({
          data: {
            conversationId,
            senderType: 'BOT',
            senderId: 'sevabot',
            text: aiReply,
            deliveredAt: new Date(),
          },
        });

        io.to(`conversation:${conversationId}`).emit('chat:message', botMsg);
      }
    } catch {
      socket.emit('chat:error', { message: 'Failed to send message' });
    }
  });

  socket.on('chat:request_support', async ({ conversationId }: { conversationId: string }) => {
    try {
      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation) return;
      if (conversation.status === 'PENDING_HUMAN' || conversation.status === 'HUMAN_ACTIVE') return;
      await escalateConversation(io, prisma, conversationId, userId, userName);
    } catch {
      socket.emit('chat:error', { message: 'Failed to connect to support' });
    }
  });

  socket.on('chat:typing', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
    socket.to(`conversation:${conversationId}`).emit('chat:typing', {
      conversationId,
      userId,
      userName,
      isTyping,
    });
  });

  socket.on('chat:agent_join', async ({ conversationId }: { conversationId: string }) => {
    const isAgent = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    if (!isAgent) return;

    const adminUser = await prisma.adminUser.findUnique({ where: { userId } });
    if (!adminUser) return;

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'HUMAN_ACTIVE', assignedToId: adminUser.id },
    });

    await prisma.supportAssignment.create({
      data: { conversationId, adminUserId: adminUser.id },
    });

    const joinMsg = await prisma.chatMessage.create({
      data: {
        conversationId,
        senderType: 'BOT',
        senderId: 'system',
        text: `${userName} from MedsSeva Support has joined the conversation.`,
        deliveredAt: new Date(),
      },
    });

    socket.join(`conversation:${conversationId}`);
    io.to(`conversation:${conversationId}`).emit('chat:message', joinMsg);
    io.to(`conversation:${conversationId}`).emit('chat:status_change', {
      conversationId,
      status: 'HUMAN_ACTIVE',
      agentName: userName,
    });
  });

  socket.on('chat:close', async ({ conversationId }: { conversationId: string }) => {
    const isAgent = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    if (!isAgent) return;

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'CLOSED' },
    });

    await prisma.supportAssignment.updateMany({
      where: { conversationId, closedAt: null },
      data: { closedAt: new Date() },
    });

    const closeMsg = await prisma.chatMessage.create({
      data: {
        conversationId,
        senderType: 'BOT',
        senderId: 'system',
        text: 'This conversation has been closed by the support team. If you need further assistance, feel free to message again.',
        deliveredAt: new Date(),
      },
    });

    io.to(`conversation:${conversationId}`).emit('chat:message', closeMsg);
    io.to(`conversation:${conversationId}`).emit('chat:status_change', {
      conversationId,
      status: 'CLOSED',
    });
  });

  socket.on('chat:reopen', async ({ conversationId }: { conversationId: string }) => {
    const isAgent = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    if (!isAgent) return;

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'AI_ACTIVE', assignedToId: null },
    });

    io.to(`conversation:${conversationId}`).emit('chat:status_change', {
      conversationId,
      status: 'AI_ACTIVE',
    });
  });

  socket.on('support:join_room', () => {
    const isAgent = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    if (isAgent) socket.join('support:room');
  });

socket.on('lims:join', () => {
    const isLabStaff = ['ADMIN', 'SUPER_ADMIN', 'PATHOLOGIST', 'LAB_DEPARTMENT'].includes(userRole);
    if (isLabStaff) socket.join('lims:room');
  });

  socket.on('disconnect', () => {
    socket.leave('support:room');
    socket.leave('lims:room');
  });
}

async function escalateConversation(
  io: Server,
  prisma: PrismaClient,
  conversationId: string,
  userId: string,
  userName: string
) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'PENDING_HUMAN' },
  });

  const escalationMsg = await prisma.chatMessage.create({
    data: {
      conversationId,
      senderType: 'BOT',
      senderId: 'sevabot',
      text: "I'm connecting you with a MedsSeva Customer Support Representative. Please wait a moment.",
      deliveredAt: new Date(),
    },
  });

  io.to(`conversation:${conversationId}`).emit('chat:message', escalationMsg);
  io.to(`conversation:${conversationId}`).emit('chat:status_change', {
    conversationId,
    status: 'PENDING_HUMAN',
  });

  io.to('support:room').emit('chat:new_pending', { conversationId, userId, userName });
}