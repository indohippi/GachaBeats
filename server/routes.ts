import type { Express } from "express";
import session from "express-session";
import pgSimple from "connect-pg-simple";
import { db } from "../db";
import { sounds, userSounds, users } from "@db/schema";
import { eq } from "drizzle-orm";
import { WebSocketServer, WebSocket as WS } from "ws";
import { RawData } from 'ws';

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
import authRouter from "./auth";
import { Socket } from "net";

// Constants for session store health checks and WebSocket management
// Safe timeout values within 32-bit integer limits
const SESSION_STORE_CHECK_INTERVAL = 5000; // 5 seconds for faster health checks
const SESSION_CLEANUP_INTERVAL = Math.min(86400000, 0x7FFFFFFF); // 24 hours or max safe value
const WS_PING_INTERVAL = 15000; // 15 seconds for frequent connection checks
const WS_PING_TIMEOUT = 5000; // 5 seconds
const MAX_32_BIT_INT = 0x7FFFFFFF; // Maximum 32-bit signed integer (2147483647)

// Helper function to ensure timeout values are safe
const getSafeTimeout = (value: number): number => Math.min(value, MAX_32_BIT_INT);

function setupSessionStore() {
  console.log('Initializing session store...');
  const PgSession = pgSimple(session);
  
  const sessionStore = new PgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
      // Add connection timeout settings
      connectionTimeoutMillis: getSafeTimeout(10000), // 10 second connection timeout
      idleTimeoutMillis: getSafeTimeout(30000), // 30 second idle timeout
    },
    createTableIfMissing: true,
    pruneSessionInterval: getSafeTimeout(SESSION_CLEANUP_INTERVAL),
    errorLog: (error) => {
      console.error('Session store error:', error);
      // Add specific handling for timeout errors
      if (error.message?.includes('timeout')) {
        console.error('Session store timeout error - attempting recovery');
      }
    },
  });

  // Set up health check interval
  const healthCheckInterval = setInterval(async () => {
    try {
      await sessionStore.pruneSessions();
      console.log('Session store health check passed');
    } catch (error) {
      console.error('Session store health check failed:', error);
      // Attempt to recover the session store
      try {
        await sessionStore.close();
        console.log('Session store closed, attempting to reconnect...');
        // The next request will automatically reconnect
      } catch (closeError) {
        console.error('Failed to close session store:', closeError);
      }
    }
  }, SESSION_STORE_CHECK_INTERVAL);

  // Clean up on process exit
  process.on('SIGTERM', () => clearInterval(healthCheckInterval));
  process.on('SIGINT', () => clearInterval(healthCheckInterval));

  return sessionStore;
}

function setupWebSocketServer(): WebSocketServer {
  console.log('Initializing WebSocket server...');
  const wss = new WebSocketServer({ noServer: true });
  console.log('WebSocket server initialized successfully');
  
  // Track connected clients
  const clients = new Set<WebSocket & { isAlive?: boolean; lastPingTime?: number; connectionId?: string; messageCount?: number; connectionStartTime?: number; messageSuccessRate?: number; }>();
  
  // WebSocket server monitoring with safe timeout values
  const monitoringInterval = setInterval(() => {
    console.log(`WebSocket status: ${clients.size} clients connected`);
    
    const now = Date.now();
    // Check all clients' health
    clients.forEach((ws) => {
      const wsState = ws as any;
      
      // Check if connection has exceeded maximum safe timeout
      if (now - wsState.lastPingTime > getSafeTimeout(WS_PING_INTERVAL * 3)) {
        console.log('Connection exceeded maximum safe timeout, terminating');
        ws.terminate();
        return;
      }
      
      if (!wsState.isAlive) {
        console.log('Terminating inactive WebSocket connection');
        ws.terminate();
        return;
      }
      
      wsState.isAlive = false;
      wsState.lastPingTime = now;
      ws.ping();
    });
  }, getSafeTimeout(WS_PING_INTERVAL));

  // Ensure proper cleanup of monitoring interval
  process.on('SIGTERM', () => {
    clearInterval(monitoringInterval);
    clients.forEach(ws => ws.terminate());
    clients.clear();
  });

  // Enhanced WebSocket error handling
  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');
    clients.add(ws);
    
    // Enhanced connection state tracking
    (ws as any).isAlive = true;
    (ws as any).connectionStartTime = Date.now();
    (ws as any).messageCount = 0;
    (ws as any).lastMessageTime = Date.now();
    (ws as any).recoveryAttempts = 0;
    
    // Connection quality monitoring
    (ws as any).latencyHistory = [];
    (ws as any).messageSuccessRate = 1.0;
    
    // Enhanced error handling
    ws.on('error', (error) => {
      console.error('WebSocket connection error:', error);
      // Log additional connection diagnostics
      const diagnostics = {
        connectionDuration: Date.now() - (ws as any).connectionStartTime,
        messageCount: (ws as any).messageCount,
        isAlive: (ws as any).isAlive,
      };
      console.error('Connection diagnostics:', diagnostics);
    });

    ws.on('pong', () => {
      (ws as any).isAlive = true;
      console.log('Received pong from client, connection alive');
    });

    // Improved message validation and rate limiting
    ws.on('message', (message) => {
      try {
        const now = Date.now();
        (ws as any).lastMessageTime = now;
        
        // Enhanced rate limiting with adaptive thresholds
        const messageRate = ++((ws as any).messageCount) / ((now - (ws as any).connectionStartTime) / 1000);
        const baseLimit = 100; // Base rate limit of 100 messages per second
        const adaptiveLimit = baseLimit * (ws as any).messageSuccessRate;
        
        if (messageRate > adaptiveLimit) {
          console.warn(`Client ${(ws as any).connectionId} exceeding adapted rate limit: ${messageRate.toFixed(2)}/${adaptiveLimit.toFixed(2)} msg/s`);
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Rate limit exceeded',
            details: {
              currentRate: messageRate,
              limit: adaptiveLimit,
              successRate: (ws as any).messageSuccessRate
            }
          }));
          return;
        }
        
        // Track message latency
        const start = performance.now();

        // Frame validation
        if (message.length > 1024 * 1024) { // 1MB limit
          throw new Error('Message size exceeds limit');
        }

        const data = JSON.parse(message.toString());
        
        // Validate message structure
        if (!data.type || typeof data.type !== 'string') {
          throw new Error('Invalid message format: missing or invalid type');
        }

        console.log('Received WebSocket message:', {
          type: data.type,
          size: message.length,
          timestamp: new Date().toISOString()
        });
        
        // Process message based on type
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

    ws.on('close', (code, reason) => {
      console.log(`WebSocket connection closed with code ${code}${reason ? ': ' + reason : ''}`);
      const connectionDuration = Date.now() - (ws as any).connectionStartTime;
      console.log(`Connection duration: ${connectionDuration}ms, Messages processed: ${(ws as any).messageCount}`);
      clients.delete(ws);
    });

    // Send initial connection confirmation with connection ID
    const connectionId = Math.random().toString(36).substr(2, 9);
    (ws as any).connectionId = connectionId;
    ws.send(JSON.stringify({ 
      type: 'connected',
      connectionId,
      timestamp: Date.now(),
      maxMessageSize: 1024 * 1024 // 1MB
    }));
  });

  // Clean up on process exit
  process.on('SIGTERM', () => {
    clearInterval(monitoringInterval);
    wss.close(() => console.log('WebSocket server closed'));
  });

  return wss;
}

export function registerRoutes(app: Express) {
  // Verify required environment variables
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  console.log('Setting up session management...');
  const sessionStore = setupSessionStore();

  // Configure session middleware with enhanced error handling
  try {
    app.use(session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
    }));
    console.log('Session middleware configured successfully');
  } catch (error) {
    console.error('Failed to initialize session middleware:', error);
    throw error;
  }

  // Initialize WebSocket server
  const wss = setupWebSocketServer();

  // API routes setup
  app.use('/api/auth', authRouter);
  
  // Request validation logging middleware
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`API Request: ${req.method} ${req.path}`);
      console.log('Request body:', req.body);
      console.log('Request query:', req.query);
    }
    next();
  });

  // API routes with enhanced error handling
  app.get('/api/sounds', async (req, res) => {
    try {
      if (!req.session.userId) {
        console.log('Unauthorized access attempt to /api/sounds');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userSoundsList = await db.query.userSounds.findMany({
        where: eq(userSounds.userId, req.session.userId),
        with: {
          sound: true,
        },
      });

      console.log(`Retrieved ${userSoundsList.length} sounds for user ${req.session.userId}`);
      res.json(userSoundsList.map(us => us.sound));
    } catch (error) {
      console.error('Error fetching sounds:', error);
      res.status(500).json({ error: 'Failed to fetch sounds' });
    }
  });

  app.post('/api/gacha/pull', async (req, res) => {
    try {
      if (!req.session.userId) {
        console.log('Unauthorized gacha pull attempt');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, req.session.userId),
      });

      if (!user) {
        console.log(`User not found: ${req.session.userId}`);
        return res.status(401).json({ error: 'User not found' });
      }

      const lastPull = user.lastPull;
      const now = new Date();
      if (lastPull && lastPull.getDate() === now.getDate()) {
        console.log(`User ${req.session.userId} attempted multiple pulls in one day`);
        return res.status(400).json({ error: 'Already pulled today' });
      }

      // Random sound selection with rarity weights
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

      console.log(`Gacha pull for user ${req.session.userId}: rolled ${rarity}`);

      const eligibleSounds = allSounds.filter(s => s.rarity === rarity);
      const selectedSound = eligibleSounds[Math.floor(Math.random() * eligibleSounds.length)];

      await db.insert(userSounds).values({
        userId: req.session.userId,
        soundId: selectedSound.id,
      });

      await db.update(users)
        .set({ lastPull: now })
        .where(eq(users.id, req.session.userId));

      console.log(`User ${req.session.userId} obtained sound: ${selectedSound.name} (${selectedSound.rarity})`);
      res.json(selectedSound);
    } catch (error) {
      console.error('Error in gacha pull:', error);
      res.status(500).json({ error: 'Failed to process gacha pull' });
    }
  });

  return wss;
}
