import { Router } from 'express';
import { db } from '../db';
import { users, insertUserSchema } from '@db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = insertUserSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [user] = await db.insert(users)
      .values({ username, password: hashedPassword })
      .returning();

    req.session.userId = user.id;
    res.json({ id: user.id, username: user.username });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input or username taken' });
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
    res.json({ id: user.id, username: user.username });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input' });
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
