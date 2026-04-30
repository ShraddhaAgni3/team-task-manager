const express = require('express');
const { randomUUID } = require('crypto');
const { db, nowIso } = require('../db');
const { ApiError, requireAuth } = require('../middleware/auth');
const { taskCreateSchema, taskPatchSchema, validate } = require('../validators');
const { canAccessProject } = require('./projects');

const router = express.Router();

function getTask(taskId) {
  return db
    .prepare(`
      SELECT
        t.id, t.project_id, t.title, t.description, t.status, t.priority,
        t.assignee_id, t.created_by_id, t.due_date, t.created_at, t.updated_at,
        p.name AS project_name, p.key AS project_key,
        assignee.name AS assignee_name, assignee.email AS assignee_email,
        creator.name AS created_by_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN users creator ON creator.id = t.created_by_id
      LEFT JOIN users assignee ON assignee.id = t.assignee_id
      WHERE t.id = ?
    `)
    .get(taskId);
}

function ensureAssigneeCanReceiveTask(projectId, assigneeId) {
  if (!assigneeId) return;
  const membership = db
    .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(projectId, assigneeId);
  if (!membership) {
    throw new ApiError(422, 'Assignee must be a member of the project');
  }
}

router.get('/', requireAuth, (req, res) => {
  const params = [];
  const where = ['p.archived = 0'];

  let sql = `
    SELECT
      t.id, t.project_id, t.title, t.description, t.status, t.priority,
      t.assignee_id, t.created_by_id, t.due_date, t.created_at, t.updated_at,
      p.name AS project_name, p.key AS project_key,
      assignee.name AS assignee_name, assignee.email AS assignee_email,
      creator.name AS created_by_name
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN users creator ON creator.id = t.created_by_id
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
  `;

  if (req.user.role !== 'ADMIN') {
    sql += ' JOIN project_members pm_self ON pm_self.project_id = t.project_id AND pm_self.user_id = ?';
    params.push(req.user.id);
  }

  if (req.query.projectId) {
    where.push('t.project_id = ?');
    params.push(req.query.projectId);
  }

  if (req.query.status) {
    where.push('t.status = ?');
    params.push(req.query.status);
  }

  if (req.query.assigneeId) {
    where.push('t.assignee_id = ?');
    params.push(req.query.assigneeId);
  }

  if (req.query.mine === 'true') {
    where.push('t.assignee_id = ?');
    params.push(req.user.id);
  }

  const q = String(req.query.q || '').trim().toLowerCase();
  if (q) {
    where.push('(lower(t.title) LIKE ? OR lower(t.description) LIKE ? OR lower(p.name) LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += ` WHERE ${where.join(' AND ')} ORDER BY COALESCE(t.due_date, '9999-12-31') ASC, t.created_at DESC`;
  const tasks = db.prepare(sql).all(...params);
  return res.json({ tasks });
});

router.post('/', requireAuth, (req, res, next) => {
  try {
    const body = validate(taskCreateSchema, req.body);
    const project = db.prepare('SELECT id FROM projects WHERE id = ? AND archived = 0').get(body.projectId);
    if (!project) throw new ApiError(404, 'Project not found');
    if (!canAccessProject(req.user, body.projectId)) throw new ApiError(403, 'You are not a member of this project');

    ensureAssigneeCanReceiveTask(body.projectId, body.assigneeId);

    const task = {
      id: randomUUID(),
      project_id: body.projectId,
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      assignee_id: body.assigneeId || null,
      created_by_id: req.user.id,
      due_date: body.dueDate || null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    db.prepare(`
      INSERT INTO tasks (
        id, project_id, title, description, status, priority, assignee_id,
        created_by_id, due_date, created_at, updated_at
      ) VALUES (
        @id, @project_id, @title, @description, @status, @priority, @assignee_id,
        @created_by_id, @due_date, @created_at, @updated_at
      )
    `).run(task);

    return res.status(201).json({ task: getTask(task.id) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const task = getTask(req.params.id);
    if (!task) throw new ApiError(404, 'Task not found');
    if (!canAccessProject(req.user, task.project_id)) throw new ApiError(403, 'You cannot access this task');
    return res.json({ task });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', requireAuth, (req, res, next) => {
  try {
    const body = validate(taskPatchSchema, req.body);
    const task = getTask(req.params.id);
    if (!task) throw new ApiError(404, 'Task not found');
    if (!canAccessProject(req.user, task.project_id)) throw new ApiError(403, 'You cannot update this task');

    const assigneeId = Object.prototype.hasOwnProperty.call(body, 'assigneeId')
      ? body.assigneeId
      : task.assignee_id;
    ensureAssigneeCanReceiveTask(task.project_id, assigneeId);

    const updated = {
      id: req.params.id,
      title: body.title ?? task.title,
      description: body.description ?? task.description ?? '',
      status: body.status ?? task.status,
      priority: body.priority ?? task.priority,
      assignee_id: assigneeId || null,
      due_date: Object.prototype.hasOwnProperty.call(body, 'dueDate') ? body.dueDate : task.due_date,
      updated_at: nowIso(),
    };

    db.prepare(`
      UPDATE tasks
      SET title = @title,
          description = @description,
          status = @status,
          priority = @priority,
          assignee_id = @assignee_id,
          due_date = @due_date,
          updated_at = @updated_at
      WHERE id = @id
    `).run(updated);

    return res.json({ task: getTask(req.params.id) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requireAuth, (req, res, next) => {
  try {
    const task = getTask(req.params.id);
    if (!task) throw new ApiError(404, 'Task not found');
    if (!canAccessProject(req.user, task.project_id)) throw new ApiError(403, 'You cannot access this task');
    if (req.user.role !== 'ADMIN' && task.created_by_id !== req.user.id) {
      throw new ApiError(403, 'Only admins or the task creator can delete this task');
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
module.exports.getTask = getTask;
