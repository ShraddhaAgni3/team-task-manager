const express = require('express');
const { randomUUID } = require('crypto');
const { db, nowIso } = require('../db');
const {
  clearAuthCookie,
  getSafeUser,
  hashPassword,
  setAuthCookie,
  signToken,
  verifyPassword,
} = require('../auth');
const { ApiError, requireAuth } = require('../middleware/auth');
const { loginSchema, signupSchema, validate } = require('../validators');

const router = express.Router();

router.post('/signup', async (req, res, next) => {
  try {
    const body = validate(signupSchema, req.body);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(body.email);
    if (existing) throw new ApiError(409, 'Email is already registered');

    const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    const role = userCount === 0 ? 'ADMIN' : 'MEMBER';
    const passwordHash = await hashPassword(body.password);
    const user = {
      id: randomUUID(),
      name: body.name,
      email: body.email,
      password_hash: passwordHash,
      role,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
      VALUES (@id, @name, @email, @password_hash, @role, @created_at, @updated_at)
    `).run(user);

    const token = signToken(user);
    setAuthCookie(res, token);
    return res.status(201).json({ user: getSafeUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = validate(loginSchema, req.body);
    const user = db
      .prepare('SELECT id, name, email, password_hash, role, created_at, updated_at FROM users WHERE email = ?')
      .get(body.email);

    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const token = signToken(user);
    setAuthCookie(res, token);
    return res.json({ user: getSafeUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  return res.status(204).send();
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.safeUser });
});

module.exports = router;
