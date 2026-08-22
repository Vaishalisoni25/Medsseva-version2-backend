import 'dotenv/config';
import { validateEnv } from './config/env';
validateEnv();

import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import app from './app';
import { registerChatHandlers } from './socket/chatHandlers';
import { env } from './config/env';
import os from 'os';
import { prisma } from './lib/prisma';

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : ['http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { id: string; role?: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return next(new Error('User not found'));
    (socket as any).userId = decoded.id;
    (socket as any).userRole = decoded.role;
    (socket as any).userName = user.name;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  registerChatHandlers(io, socket, prisma);
});

httpServer.listen(Number(PORT), '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
      }
    }
  }
  console.log(`Backend server running on http://${localIP}:${PORT}`);
});