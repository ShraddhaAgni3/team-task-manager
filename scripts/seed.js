require('dotenv').config();

const { randomUUID } = require('crypto');
const { db, initDb, resetDb, nowIso, absoluteDatabasePath } = require('../src/db');
const { hashPassword } = require('../src/auth');

const shouldReset = process.argv.includes('--reset');

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(18, 0, 0, 0);
  return date.toISOString();
}

async function createUser({ name, email, password, role }) {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) return existing;

  const user = {
    id: randomUUID(),
    name,
    email,
    password_hash: await hashPassword(password),
    role,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
    VALUES (@id, @name, @email, @password_hash, @role, @created_at, @updated_at)
  `).run(user);
  return user;
}

function createProject({ name, key, description, createdById }) {
  const existing = db.prepare('SELECT * FROM projects WHERE key = ?').get(key);
  if (existing) return existing;

  const project = {
    id: randomUUID(),
    name,
    key,
    description,
    archived: 0,
    created_by_id: createdById,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  db.prepare(`
    INSERT INTO projects (id, name, key, description, archived, created_by_id, created_at, updated_at)
    VALUES (@id, @name, @key, @description, @archived, @created_by_id, @created_at, @updated_at)
  `).run(project);
  return project;
}

function addMember(projectId, userId) {
  db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, joined_at) VALUES (?, ?, ?)')
    .run(projectId, userId, nowIso());
}

function createTask({ projectId, title, description, status, priority, assigneeId, createdById, dueDate }) {
  const existing = db
    .prepare('SELECT * FROM tasks WHERE project_id = ? AND title = ?')
    .get(projectId, title);
  if (existing) return existing;

  const task = {
    id: randomUUID(),
    project_id: projectId,
    title,
    description,
    status,
    priority,
    assignee_id: assigneeId,
    created_by_id: createdById,
    due_date: dueDate,
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
  return task;
}

async function main() {
  initDb();
  if (shouldReset) resetDb();

  const admin = await createUser({
    name: 'Asha Admin',
    email: 'admin@example.com',
    password: 'Admin@1234',
    role: 'ADMIN',
  });

  const member = await createUser({
    name: 'Ravi Member',
    email: 'member@example.com',
    password: 'Member@1234',
    role: 'MEMBER',
  });

  const designer = await createUser({
    name: 'Neha Designer',
    email: 'designer@example.com',
    password: 'Designer@1234',
    role: 'MEMBER',
  });

  const web = createProject({
    name: 'Website Revamp',
    key: 'WEB',
    description: 'Redesign marketing website and improve onboarding pages.',
    createdById: admin.id,
  });

  const ops = createProject({
    name: 'Internal Operations',
    key: 'OPS',
    description: 'Process improvements, internal tooling, and reporting tasks.',
    createdById: admin.id,
  });

  addMember(web.id, admin.id);
  addMember(web.id, member.id);
  addMember(web.id, designer.id);
  addMember(ops.id, admin.id);
  addMember(ops.id, member.id);

  createTask({
    projectId: web.id,
    title: 'Create landing page wireframe',
    description: 'Prepare first version of homepage and features section wireframe.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assigneeId: designer.id,
    createdById: admin.id,
    dueDate: addDays(2),
  });

  createTask({
    projectId: web.id,
    title: 'Build signup and login screens',
    description: 'Implement responsive auth screens and connect them to backend APIs.',
    status: 'TODO',
    priority: 'HIGH',
    assigneeId: member.id,
    createdById: admin.id,
    dueDate: addDays(4),
  });

  createTask({
    projectId: web.id,
    title: 'Review accessibility checklist',
    description: 'Check labels, colors, keyboard navigation, and focus states.',
    status: 'BLOCKED',
    priority: 'MEDIUM',
    assigneeId: designer.id,
    createdById: member.id,
    dueDate: addDays(-1),
  });

  createTask({
    projectId: ops.id,
    title: 'Create weekly dashboard template',
    description: 'Summarize team progress and overdue items for weekly review.',
    status: 'DONE',
    priority: 'MEDIUM',
    assigneeId: member.id,
    createdById: admin.id,
    dueDate: addDays(-3),
  });

  createTask({
    projectId: ops.id,
    title: 'Document deployment checklist',
    description: 'Write steps for Railway deployment, env variables, and demo accounts.',
    status: 'TODO',
    priority: 'LOW',
    assigneeId: admin.id,
    createdById: admin.id,
    dueDate: addDays(6),
  });

  console.log('Database seeded successfully.');
  console.log(`Database file: ${absoluteDatabasePath}`);
  console.log('Demo accounts:');
  console.log('  Admin  - admin@example.com / Admin@1234');
  console.log('  Member - member@example.com / Member@1234');
  console.log('  Member - designer@example.com / Designer@1234');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
