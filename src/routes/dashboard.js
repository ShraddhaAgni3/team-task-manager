const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function visibilityJoin(user, params) {
  if (user.role === 'ADMIN') return '';
  params.push(user.id);
  return 'JOIN project_members pm_self ON pm_self.project_id = t.project_id AND pm_self.user_id = ?';
}

router.get('/summary', requireAuth, (req, res) => {
  const params = [];
  const join = visibilityJoin(req.user, params);

  const totalTasks = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      ${join}
      WHERE p.archived = 0
    `)
    .get(...params).count;

  const statusCounts = db
    .prepare(`
      SELECT t.status, COUNT(*) AS count
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      ${join}
      WHERE p.archived = 0
      GROUP BY t.status
    `)
    .all(...params)
    .reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, { TODO: 0, IN_PROGRESS: 0, BLOCKED: 0, DONE: 0 });

  const overdue = db
    .prepare(`
      SELECT
        t.id, t.title, t.status, t.priority, t.due_date,
        p.name AS project_name, p.key AS project_key,
        assignee.name AS assignee_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users assignee ON assignee.id = t.assignee_id
      ${join}
      WHERE p.archived = 0
        AND t.status != 'DONE'
        AND t.due_date IS NOT NULL
        AND datetime(t.due_date) < datetime('now')
      ORDER BY datetime(t.due_date) ASC
      LIMIT 8
    `)
    .all(...params);

  const dueSoon = db
    .prepare(`
      SELECT
        t.id, t.title, t.status, t.priority, t.due_date,
        p.name AS project_name, p.key AS project_key,
        assignee.name AS assignee_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users assignee ON assignee.id = t.assignee_id
      ${join}
      WHERE p.archived = 0
        AND t.status != 'DONE'
        AND t.due_date IS NOT NULL
        AND datetime(t.due_date) >= datetime('now')
        AND datetime(t.due_date) <= datetime('now', '+7 days')
      ORDER BY datetime(t.due_date) ASC
      LIMIT 8
    `)
    .all(...params);

  const projectParams = [];
  let projectSql = `
    SELECT p.id, p.name, p.key, COUNT(t.id) AS task_count
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id
  `;
  if (req.user.role !== 'ADMIN') {
    projectSql += ' JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?';
    projectParams.push(req.user.id);
  }
  projectSql += ' WHERE p.archived = 0 GROUP BY p.id ORDER BY p.created_at DESC LIMIT 5';
  const recentProjects = db.prepare(projectSql).all(...projectParams);

  const myTasks = db
    .prepare(`
      SELECT t.id, t.title, t.status, t.priority, t.due_date, p.name AS project_name, p.key AS project_key
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE p.archived = 0 AND t.assignee_id = ? AND t.status != 'DONE'
      ORDER BY COALESCE(t.due_date, '9999-12-31') ASC
      LIMIT 8
    `)
    .all(req.user.id);

  return res.json({
    totalTasks,
    statusCounts,
    overdueCount: overdue.length,
    overdue,
    dueSoon,
    myTasks,
    recentProjects,
  });
});

module.exports = router;
