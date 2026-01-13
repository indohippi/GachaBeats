import { Router } from 'express';
import { db } from '../db';
import { users, insertUserSchema } from '@db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const router = Router();

// Get bcrypt salt rounds from env or use secure default
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

router.post('/register', async (req, res) => {
  try {
    const { username, password } = insertUserSchema.parse(req.body);

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    const [user] = await db.insert(users)
      .values({ username, password: hashedPassword })
      .returning();

    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ id: user.id, username: user.username });
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate')) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    console.error('Registration error:', error);
    res.status(400).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ id: user.id, username: user.username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      res.status(500).json({ error: 'Failed to logout' });
    } else {
      res.json({ success: true });
    }
  });
});

router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, req.session.userId),
    columns: { id: true, username: true }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

export default router;
