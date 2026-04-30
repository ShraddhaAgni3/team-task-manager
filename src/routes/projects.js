const express = require('express');
const { randomUUID } = require('crypto');
const { db, nowIso } = require('../db');
const { getSafeUser } = require('../auth');
const { ApiError, requireAdmin, requireAuth } = require('../middleware/auth');
const {
  memberAddSchema,
  projectCreateSchema,
  projectPatchSchema,
  validate,
} = require('../validators');

const router = express.Router();

function canAccessProject(user, projectId) {
  if (user.role === 'ADMIN') return true;
  const membership = db
    .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(projectId, user.id);
  return Boolean(membership);
}

function getProject(projectId) {
  return db
    .prepare(`
      SELECT
        p.id, p.name, p.key, p.description, p.archived, p.created_by_id,
        p.created_at, p.updated_at,
        u.name AS created_by_name,
        COUNT(DISTINCT pm.user_id) AS member_count,
        COUNT(DISTINCT t.id) AS task_count
      FROM projects p
      JOIN users u ON u.id = p.created_by_id
      LEFT JOIN project_members pm ON pm.project_id = p.id
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.id = ?
      GROUP BY p.id
    `)
    .get(projectId);
}

router.get('/', requireAuth, (req, res) => {
  const archived = req.query.archived === 'true' ? 1 : 0;
  const q = String(req.query.q || '').trim().toLowerCase();
  const params = [];

  let sql = `
    SELECT
      p.id, p.name, p.key, p.description, p.archived, p.created_by_id,
      p.created_at, p.updated_at,
      u.name AS created_by_name,
      COUNT(DISTINCT pm_all.user_id) AS member_count,
      COUNT(DISTINCT t.id) AS task_count
    FROM projects p
    JOIN users u ON u.id = p.created_by_id
    LEFT JOIN project_members pm_all ON pm_all.project_id = p.id
    LEFT JOIN tasks t ON t.project_id = p.id
  `;

  if (req.user.role !== 'ADMIN') {
    sql += ' JOIN project_members pm_self ON pm_self.project_id = p.id AND pm_self.user_id = ?';
    params.push(req.user.id);
  }

  sql += ' WHERE p.archived = ?';
  params.push(archived);

  if (q) {
    sql += ' AND (lower(p.name) LIKE ? OR lower(p.key) LIKE ? OR lower(p.description) LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += ' GROUP BY p.id ORDER BY p.created_at DESC';

  const projects = db.prepare(sql).all(...params);
  return res.json({ projects });
});

router.post('/', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const body = validate(projectCreateSchema, req.body);
    const duplicate = db.prepare('SELECT id FROM projects WHERE key = ?').get(body.key);
    if (duplicate) throw new ApiError(409, 'Project key already exists');

    const project = {
      id: randomUUID(),
      name: body.name,
      key: body.key,
      description: body.description,
      archived: 0,
      created_by_id: req.user.id,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const createProject = db.transaction(() => {
      db.prepare(`
        INSERT INTO projects (id, name, key, description, archived, created_by_id, created_at, updated_at)
        VALUES (@id, @name, @key, @description, @archived, @created_by_id, @created_at, @updated_at)
      `).run(project);
      db.prepare('INSERT INTO project_members (project_id, user_id, joined_at) VALUES (?, ?, ?)')
        .run(project.id, req.user.id, nowIso());
    });

    createProject();
    return res.status(201).json({ project: getProject(project.id) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const project = getProject(req.params.id);
    if (!project) throw new ApiError(404, 'Project not found');
    if (!canAccessProject(req.user, req.params.id)) throw new ApiError(403, 'You are not a member of this project');
    return res.json({ project });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const body = validate(projectPatchSchema, req.body);
    const project = getProject(req.params.id);
    if (!project) throw new ApiError(404, 'Project not found');

    if (body.key) {
      const duplicate = db.prepare('SELECT id FROM projects WHERE key = ? AND id != ?').get(body.key, req.params.id);
      if (duplicate) throw new ApiError(409, 'Project key already exists');
    }

    const updated = {
      name: body.name ?? project.name,
      key: body.key ?? project.key,
      description: body.description ?? project.description ?? '',
      archived: typeof body.archived === 'boolean' ? Number(body.archived) : project.archived,
      updated_at: nowIso(),
      id: req.params.id,
    };

    db.prepare(`
      UPDATE projects
      SET name = @name, key = @key, description = @description, archived = @archived, updated_at = @updated_at
      WHERE id = @id
    `).run(updated);

    return res.json({ project: getProject(req.params.id) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const project = getProject(req.params.id);
    if (!project) throw new ApiError(404, 'Project not found');
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/members', requireAuth, (req, res, next) => {
  try {
    const project = getProject(req.params.id);
    if (!project) throw new ApiError(404, 'Project not found');
    if (!canAccessProject(req.user, req.params.id)) throw new ApiError(403, 'You are not a member of this project');

    const members = db
      .prepare(`
        SELECT u.id, u.name, u.email, u.role, u.created_at, u.updated_at, pm.joined_at
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = ?
        ORDER BY u.name COLLATE NOCASE ASC
      `)
      .all(req.params.id)
      .map((row) => ({ ...getSafeUser(row), joinedAt: row.joined_at }));

    return res.json({ members });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/members', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const body = validate(memberAddSchema, req.body);
    const project = getProject(req.params.id);
    if (!project) throw new ApiError(404, 'Project not found');

    const user = db.prepare('SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?').get(body.userId);
    if (!user) throw new ApiError(404, 'User not found');

    const existing = db
      .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(req.params.id, body.userId);
    if (existing) throw new ApiError(409, 'User is already a project member');

    db.prepare('INSERT INTO project_members (project_id, user_id, joined_at) VALUES (?, ?, ?)')
      .run(req.params.id, body.userId, nowIso());

    return res.status(201).json({ member: getSafeUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id/members/:userId', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const project = getProject(req.params.id);
    if (!project) throw new ApiError(404, 'Project not found');

    const result = db
      .prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?')
      .run(req.params.id, req.params.userId);

    if (result.changes === 0) throw new ApiError(404, 'Project member not found');
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
module.exports.canAccessProject = canAccessProject;
module.exports.getProject = getProject;
