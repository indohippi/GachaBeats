import type { Express } from "express";
import session from "express-session";
import pgSimple from "connect-pg-simple";
import { db } from "../db";
import { sounds, userSounds, users } from "@db/schema";
import { eq } from "drizzle-orm";
import { WebSocket } from "ws";
import authRouter from "./auth";

export function registerRoutes(app: Express) {
  const wss = new WebSocket.Server({ noServer: true });
  const PgSession = pgSimple(session);

  app.use(session({
    store: new PgSession({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  }));

  app.use('/api/auth', authRouter);
  
  app.get('/api/sounds', async (req, res) => {
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
  });

  app.post('/api/gacha/pull', async (req, res) => {
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
  });

  return wss;
}
