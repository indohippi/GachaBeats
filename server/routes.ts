import type { Express } from "express";
import session from "express-session";
import pgSimple from "connect-pg-simple";
import { db } from "../db";
import { sounds, userSounds, users } from "@db/schema";
import { eq } from "drizzle-orm";
import { WebSocketServer } from "ws";
import authRouter from "./auth";

// Constants for session store health checks
const SESSION_STORE_CHECK_INTERVAL = 30000; // 30 seconds
const SESSION_CLEANUP_INTERVAL = 86400000; // 24 hours
const WS_PING_INTERVAL = 30000; // 30 seconds
const WS_PING_TIMEOUT = 5000; // 5 seconds

function setupSessionStore() {
  console.log('Initializing session store...');
  const PgSession = pgSimple(session);
  
  const sessionStore = new PgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    createTableIfMissing: true,
    pruneSessionInterval: SESSION_CLEANUP_INTERVAL,
    errorLog: (error) => {
      console.error('Session store error:', error);
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
  const clients = new Set<WebSocket>();
  
  // WebSocket server monitoring
  const monitoringInterval = setInterval(() => {
    console.log(`WebSocket status: ${clients.size} clients connected`);
    
    // Check all clients' health
    clients.forEach((ws) => {
      if (!(ws as any).isAlive) {
        console.log('Terminating inactive WebSocket connection');
        ws.terminate();
        return;
      }
      
      (ws as any).isAlive = false;
      ws.ping();
    });
  }, WS_PING_INTERVAL);

  // Enhanced WebSocket error handling
  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');
    clients.add(ws);
    
    // Set initial alive state
    (ws as any).isAlive = true;

    ws.on('error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      clients.delete(ws);
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: 'connected' }));
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
