const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('./db');

const COOKIE_NAME = 'ttm_token';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-before-production';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function getSafeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function getUserByToken(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db
      .prepare('SELECT id, name, email, password_hash, role, created_at, updated_at FROM users WHERE id = ?')
      .get(decoded.sub);
    return user || null;
  } catch (_error) {
    return null;
  }
}

module.exports = {
  COOKIE_NAME,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  hashPassword,
  verifyPassword,
  getSafeUser,
  getUserByToken,
};
