const express = require('express');
const { db, nowIso } = require('../db');
const { getSafeUser } = require('../auth');
const { ApiError, requireAuth, requireAdmin } = require('../middleware/auth');
const { rolePatchSchema, validate } = require('../validators');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const params = [];
  let sql = `
    SELECT id, name, email, role, created_at, updated_at
    FROM users
  `;

  if (q) {
    sql += ' WHERE lower(name) LIKE ? OR lower(email) LIKE ?';
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY name COLLATE NOCASE ASC';
  const users = db.prepare(sql).all(...params).map(getSafeUser);
  return res.json({ users });
});

router.patch('/:id/role', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const body = validate(rolePatchSchema, req.body);
    const existing = db
      .prepare('SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?')
      .get(req.params.id);

    if (!existing) throw new ApiError(404, 'User not found');

    const adminCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN'").get().count;
    if (existing.role === 'ADMIN' && body.role === 'MEMBER' && adminCount <= 1) {
      throw new ApiError(409, 'At least one admin must remain in the system');
    }

    db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(body.role, nowIso(), req.params.id);
    const updated = db
      .prepare('SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?')
      .get(req.params.id);

    return res.json({ user: getSafeUser(updated) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
