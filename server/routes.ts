import type { Express } from "express";
import session from "express-session";
import pgSimple from "connect-pg-simple";
import { db } from "../db";
import { sounds, userSounds, users } from "@db/schema";
import { eq } from "drizzle-orm";
import { WebSocketServer, WebSocket as WS } from "ws";
import { RawData } from 'ws';
import { Socket } from "net";
import authRouter from "./auth";

// Extended WebSocket type with our custom properties
interface ExtendedWebSocket extends WS {
  isAlive?: boolean;
  lastPingTime?: number;
  connectionId?: string;
  messageCount?: number;
  connectionStartTime?: number;
  messageSuccessRate?: number;
  latencyHistory?: number[];
  recoveryAttempts?: number;
}

// Constants
const MAX_32_BIT_INT = 0x7FFFFFFF;
const getSafeTimeout = (value: number): number => Math.min(value, MAX_32_BIT_INT);

// Safe timeout values
const SESSION_STORE_CHECK_INTERVAL = getSafeTimeout(5000);
const SESSION_CLEANUP_INTERVAL = getSafeTimeout(86400000);
const WS_PING_INTERVAL = getSafeTimeout(15000);
const WS_PING_TIMEOUT = getSafeTimeout(5000);

function setupSessionStore() {
  console.log('Initializing session store...');
  const PgSession = pgSimple(session);
  
  const sessionStore = new PgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: getSafeTimeout(10000),
      idleTimeoutMillis: getSafeTimeout(30000),
    },
    createTableIfMissing: true,
    pruneSessionInterval: SESSION_CLEANUP_INTERVAL,
    errorLog: (error) => {
      console.error('Session store error:', error);
    },
  });

  const healthCheckInterval = setInterval(async () => {
    try {
      await sessionStore.pruneSessions();
      console.log('Session store health check passed');
    } catch (error) {
      console.error('Session store health check failed:', error);
    }
  }, SESSION_STORE_CHECK_INTERVAL);

  process.on('SIGTERM', () => clearInterval(healthCheckInterval));
  process.on('SIGINT', () => clearInterval(healthCheckInterval));

  return sessionStore;
}

function setupWebSocketServer(): WebSocketServer {
  console.log('Initializing WebSocket server...');
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<ExtendedWebSocket>();
  
  const monitoringInterval = setInterval(() => {
    console.log(`WebSocket status: ${clients.size} clients connected`);
    
    const now = Date.now();
    clients.forEach((ws) => {
      if (now - (ws.lastPingTime || 0) > WS_PING_INTERVAL * 3) {
        console.log('Connection exceeded maximum safe timeout, terminating');
        ws.close();
        return;
      }
      
      if (!ws.isAlive) {
        console.log('Terminating inactive WebSocket connection');
        ws.close();
        return;
      }
      
      ws.isAlive = false;
      ws.lastPingTime = now;
      ws.ping();
    });
  }, WS_PING_INTERVAL);

  process.on('SIGTERM', () => {
    clearInterval(monitoringInterval);
    clients.forEach(ws => ws.close());
    clients.clear();
  });

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  wss.on('connection', (ws: ExtendedWebSocket) => {
    console.log('New WebSocket connection established');
    clients.add(ws);
    
    ws.isAlive = true;
    ws.connectionStartTime = Date.now();
    ws.messageCount = 0;
    ws.recoveryAttempts = 0;
    ws.latencyHistory = [];
    ws.messageSuccessRate = 1.0;
    
    ws.on('error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    ws.on('pong', () => {
      ws.isAlive = true;
      console.log('Received pong from client, connection alive');
    });

    ws.on('message', (message: RawData) => {
      try {
        const now = Date.now();
        ws.lastPingTime = now;
        
        const messageRate = ++ws.messageCount! / ((now - (ws.connectionStartTime || 0)) / 1000);
        const baseLimit = 100;
        const adaptiveLimit = baseLimit * (ws.messageSuccessRate || 1);
        
        if (messageRate > adaptiveLimit) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Rate limit exceeded',
            details: {
              currentRate: messageRate,
              limit: adaptiveLimit,
              successRate: ws.messageSuccessRate
            }
          }));
          return;
        }
        
        const messageData = message instanceof Buffer ? message : Buffer.from(message);
        if (messageData.length > 1024 * 1024) {
          throw new Error('Message size exceeds limit');
        }

        const data = JSON.parse(messageData.toString());
        
        if (!data.type || typeof data.type !== 'string') {
          throw new Error('Invalid message format: missing or invalid type');
        }

        switch (data.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          default:
            console.log('Processing message:', data);
        }
      } catch (error) {
        console.error('WebSocket message processing error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          details: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    // Send initial connection confirmation
    const connectionId = Math.random().toString(36).substr(2, 9);
    ws.connectionId = connectionId;
    ws.send(JSON.stringify({ 
      type: 'connected',
      connectionId,
      timestamp: Date.now(),
      maxMessageSize: 1024 * 1024
    }));
  });

  return wss;
}

export function registerRoutes(app: Express) {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  const sessionStore = setupSessionStore();

  try {
    app.use(session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: getSafeTimeout(30 * 24 * 60 * 60 * 1000),
      },
    }));
    console.log('Session middleware configured successfully');
  } catch (error) {
    console.error('Failed to initialize session middleware:', error);
    throw error;
  }

  const wss = setupWebSocketServer();

  app.use('/api/auth', authRouter);
  
  app.get('/api/sounds', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userSoundsList = await db.query.userSounds.findMany({
        where: eq(userSounds.userId, req.session.userId),
        with: {
          sound: true,
        },
      });

      res.json(userSoundsList.map(us => us.sound));
    } catch (error) {
      console.error('Error fetching sounds:', error);
      res.status(500).json({ error: 'Failed to fetch sounds' });
    }
  });

  app.post('/api/gacha/pull', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, req.session.userId),
      });

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      const lastPull = user.lastPull;
      const now = new Date();
      if (lastPull && lastPull.getDate() === now.getDate()) {
        return res.status(400).json({ error: 'Already pulled today' });
      }

      const allSounds = await db.query.sounds.findMany();
      const rarityWeights = {
        common: 0.7,
        rare: 0.25,
        legendary: 0.05,
      };

      const roll = Math.random();
      const rarity = 
        roll < rarityWeights.legendary ? 'legendary' :
        roll < rarityWeights.legendary + rarityWeights.rare ? 'rare' :
        'common';

      const eligibleSounds = allSounds.filter(s => s.rarity === rarity);
      const selectedSound = eligibleSounds[Math.floor(Math.random() * eligibleSounds.length)];

      await db.insert(userSounds).values({
        userId: req.session.userId,
        soundId: selectedSound.id,
      });

      await db.update(users)
        .set({ lastPull: now })
        .where(eq(users.id, req.session.userId));

      res.json(selectedSound);
    } catch (error) {
      console.error('Error in gacha pull:', error);
      res.status(500).json({ error: 'Failed to process gacha pull' });
    }
  });

  return wss;
}