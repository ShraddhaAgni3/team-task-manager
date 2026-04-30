const state = {
  user: null,
  users: [],
  projects: [],
  tasks: [],
  summary: null,
  projectMembers: [],
  selectedProjectId: null,
  page: 'dashboard',
};

const els = {
  toast: document.getElementById('toast'),
  authScreen: document.getElementById('auth-screen'),
  appScreen: document.getElementById('app-screen'),
  loginForm: document.getElementById('login-form'),
  signupForm: document.getElementById('signup-form'),
  rolePill: document.getElementById('role-pill'),
  userInfo: document.getElementById('user-info'),
  content: document.getElementById('content'),
  pageTitle: document.getElementById('page-title'),
  pageSubtitle: document.getElementById('page-subtitle'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function inputDateToIso(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function isoToDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.style.background = isError ? '#b42318' : '#101828';
  els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 3400);
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || `Request failed with status ${response.status}`;
    if (response.status === 401) {
      state.user = null;
      renderAuth();
    }
    throw new Error(message);
  }

  return data;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setPage(page) {
  state.page = page;
  document.querySelectorAll('.nav-link').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === page);
  });
  renderPage();
}

function renderAuth() {
  els.authScreen.classList.remove('hidden');
  els.appScreen.classList.add('hidden');
}

function renderAppShell() {
  els.authScreen.classList.add('hidden');
  els.appScreen.classList.remove('hidden');
  els.rolePill.textContent = state.user.role;
  els.userInfo.innerHTML = `<strong>${escapeHtml(state.user.name)}</strong><br>${escapeHtml(state.user.email)}`;
  renderPage();
}

async function loadAll() {
  const [usersData, projectsData, tasksData, summaryData] = await Promise.all([
    api('/users'),
    api('/projects'),
    api('/tasks'),
    api('/dashboard/summary'),
  ]);

  state.users = usersData.users;
  state.projects = projectsData.projects;
  state.tasks = tasksData.tasks;
  state.summary = summaryData;

  if (!state.selectedProjectId && state.projects.length) {
    state.selectedProjectId = state.projects[0].id;
  }

  if (state.selectedProjectId && !state.projects.some((project) => project.id === state.selectedProjectId)) {
    state.selectedProjectId = state.projects[0]?.id || null;
  }

  if (state.selectedProjectId) {
    await loadProjectMembers(state.selectedProjectId);
  }
}

async function loadProjectMembers(projectId) {
  if (!projectId) {
    state.projectMembers = [];
    return;
  }
  const data = await api(`/projects/${projectId}/members`);
  state.projectMembers = data.members;
}

function renderPage() {
  if (!state.user) return renderAuth();

  const titleMap = {
    dashboard: ['Dashboard', 'Track team progress, due dates, and overdue work.'],
    projects: ['Projects', 'Manage projects, members, and project-specific tasks.'],
    tasks: ['All Tasks', 'Search and update all tasks you can access.'],
    team: ['Team', 'View users and manage roles as an Admin.'],
  };
  const [title, subtitle] = titleMap[state.page];
  els.pageTitle.textContent = title;
  els.pageSubtitle.textContent = subtitle;

  if (state.page === 'dashboard') renderDashboard();
  if (state.page === 'projects') renderProjects();
  if (state.page === 'tasks') renderTasks();
  if (state.page === 'team') renderTeam();
}

function statusBadge(status) {
  return `<span class="badge ${escapeHtml(status)}">${escapeHtml(status.replaceAll('_', ' '))}</span>`;
}

function priorityBadge(priority) {
  return `<span class="badge ${escapeHtml(priority)}">${escapeHtml(priority)}</span>`;
}

function renderDashboardList(items, emptyText) {
  if (!items?.length) return `<div class="empty">${escapeHtml(emptyText)}</div>`;
  return `
    <div class="list">
      ${items
        .map(
          (item) => `
            <div class="list-item">
              <div>
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.project_key || '')} ${escapeHtml(item.project_name || '')} • ${formatDate(item.due_date)}</p>
              </div>
              <div>${statusBadge(item.status)} ${priorityBadge(item.priority)}</div>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderDashboard() {
  const s = state.summary || {};
  const statusCounts = s.statusCounts || { TODO: 0, IN_PROGRESS: 0, BLOCKED: 0, DONE: 0 };

  els.content.innerHTML = `
    <section class="cards-grid">
      <div class="card"><p>Total visible tasks</p><div class="metric">${s.totalTasks || 0}</div></div>
      <div class="card"><p>To do</p><div class="metric">${statusCounts.TODO || 0}</div></div>
      <div class="card"><p>In progress</p><div class="metric">${statusCounts.IN_PROGRESS || 0}</div></div>
      <div class="card"><p>Overdue</p><div class="metric">${s.overdue?.length || 0}</div></div>
    </section>

    <section class="two-col">
      <div class="panel">
        <h3>My active tasks</h3>
        ${renderDashboardList(s.myTasks, 'No active tasks assigned to you.')}
      </div>
      <div class="panel">
        <h3>Status breakdown</h3>
        <div class="list">
          ${Object.entries(statusCounts)
            .map(([status, count]) => `<div class="list-item"><strong>${statusBadge(status)}</strong><span class="badge">${count}</span></div>`)
            .join('')}
        </div>
      </div>
    </section>

    <section class="two-col">
      <div class="panel">
        <h3>Due soon</h3>
        ${renderDashboardList(s.dueSoon, 'No tasks due in the next 7 days.')}
      </div>
      <div class="panel">
        <h3>Overdue</h3>
        ${renderDashboardList(s.overdue, 'No overdue tasks. Great job!')}
      </div>
    </section>
  `;
}

function renderProjectCard(project) {
  const active = state.selectedProjectId === project.id ? 'active' : '';
  return `
    <article class="card project-card ${active}" data-select-project="${project.id}">
      <span class="badge">${escapeHtml(project.key)}</span>
      <h3 style="margin-top: 12px">${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.description || 'No description')}</p>
      <p>${project.member_count || 0} members • ${project.task_count || 0} tasks</p>
    </article>
  `;
}

function renderProjectOptions(selectedId = '') {
  return state.projects
    .map((project) => `<option value="${project.id}" ${project.id === selectedId ? 'selected' : ''}>${escapeHtml(project.key)} - ${escapeHtml(project.name)}</option>`)
    .join('');
}

function renderUserOptions(selectedId = '', users = state.users) {
  return `<option value="">Unassigned</option>${users
    .map((user) => `<option value="${user.id}" ${user.id === selectedId ? 'selected' : ''}>${escapeHtml(user.name)} (${escapeHtml(user.email)})</option>`)
    .join('')}`;
}

function renderTaskRows(tasks) {
  if (!tasks.length) {
    return `<div class="empty">No tasks found.</div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Project</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assignee</th>
            <th>Due</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${tasks
            .map(
              (task) => `
                <tr>
                  <td><strong>${escapeHtml(task.title)}</strong><br><span class="hint">${escapeHtml(task.description || '')}</span></td>
                  <td>${escapeHtml(task.project_key)} - ${escapeHtml(task.project_name)}</td>
                  <td>
                    <select data-update-task-status="${task.id}">
                      ${['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']
                        .map((status) => `<option value="${status}" ${task.status === status ? 'selected' : ''}>${status.replaceAll('_', ' ')}</option>`)
                        .join('')}
                    </select>
                  </td>
                  <td>${priorityBadge(task.priority)}</td>
                  <td>${escapeHtml(task.assignee_name || 'Unassigned')}</td>
                  <td>${formatDate(task.due_date)}</td>
                  <td><button class="danger-btn" data-delete-task="${task.id}">Delete</button></td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderCreateProjectForm() {
  if (state.user.role !== 'ADMIN') return '';
  return `
    <section class="panel">
      <h3>Create project</h3>
      <form id="project-form" class="form-grid" style="margin-top: 14px">
        <label>Name <input name="name" placeholder="Mobile App" required /></label>
        <label>Key <input name="key" placeholder="MOB" required maxlength="10" /></label>
        <label class="full">Description <textarea name="description" placeholder="Project goal and notes"></textarea></label>
        <button class="primary-btn" type="submit">Create project</button>
      </form>
    </section>
  `;
}

function renderProjectDetail() {
  const project = state.projects.find((item) => item.id === state.selectedProjectId);
  if (!project) return `<section class="panel"><div class="empty">Select or create a project.</div></section>`;

  const projectTasks = state.tasks.filter((task) => task.project_id === project.id);
  const memberOptions = renderUserOptions('', state.projectMembers.length ? state.projectMembers : state.users);
  const addMemberOptions = state.users
    .filter((user) => !state.projectMembers.some((member) => member.id === user.id))
    .map((user) => `<option value="${user.id}">${escapeHtml(user.name)} (${escapeHtml(user.email)})</option>`)
    .join('');

  return `
    <section class="panel">
      <div class="list-item" style="border: 0; padding: 0; margin-bottom: 18px">
        <div>
          <span class="badge">${escapeHtml(project.key)}</span>
          <h2 style="margin-top: 10px">${escapeHtml(project.name)}</h2>
          <p>${escapeHtml(project.description || '')}</p>
        </div>
        ${
          state.user.role === 'ADMIN'
            ? `<button class="danger-btn" data-delete-project="${project.id}">Delete project</button>`
            : ''
        }
      </div>

      <div class="two-col">
        <div>
          <h3>Create task</h3>
          <form id="task-form" class="form-grid" style="margin-top: 14px">
            <input type="hidden" name="projectId" value="${project.id}" />
            <label>Title <input name="title" placeholder="Create onboarding page" required /></label>
            <label>Assignee <select name="assigneeId">${memberOptions}</select></label>
            <label>Status
              <select name="status">
                <option value="TODO">Todo</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="BLOCKED">Blocked</option>
                <option value="DONE">Done</option>
              </select>
            </label>
            <label>Priority
              <select name="priority">
                <option value="LOW">Low</option>
                <option value="MEDIUM" selected>Medium</option>
                <option value="HIGH">High</option>
              </select>
            </label>
            <label class="full">Due date <input name="dueDate" type="datetime-local" /></label>
            <label class="full">Description <textarea name="description" placeholder="Task details"></textarea></label>
            <button class="primary-btn" type="submit">Create task</button>
          </form>
        </div>

        <div>
          <h3>Members</h3>
          <div class="list">
            ${state.projectMembers
              .map(
                (member) => `
                  <div class="list-item">
                    <div>
                      <h4>${escapeHtml(member.name)}</h4>
                      <p>${escapeHtml(member.email)} • ${escapeHtml(member.role)}</p>
                    </div>
                    ${
                      state.user.role === 'ADMIN'
                        ? `<button class="danger-btn" data-remove-member="${member.id}">Remove</button>`
                        : ''
                    }
                  </div>
                `
              )
              .join('')}
          </div>
          ${
            state.user.role === 'ADMIN'
              ? `
                <form id="add-member-form" class="stack" style="margin-top: 14px">
                  <label>Add member
                    <select name="userId" ${addMemberOptions ? '' : 'disabled'}>
                      ${addMemberOptions || '<option>No available users</option>'}
                    </select>
                  </label>
                  <button class="secondary-btn" type="submit" ${addMemberOptions ? '' : 'disabled'}>Add member</button>
                </form>
              `
              : ''
          }
        </div>
      </div>
    </section>

    <section class="panel">
      <h3>Project tasks</h3>
      <div style="margin-top: 14px">${renderTaskRows(projectTasks)}</div>
    </section>
  `;
}

function renderProjects() {
  els.content.innerHTML = `
    ${renderCreateProjectForm()}
    <section class="three-col">
      ${state.projects.length ? state.projects.map(renderProjectCard).join('') : '<div class="empty">No projects yet.</div>'}
    </section>
    ${renderProjectDetail()}
  `;
}

function renderTasks() {
  els.content.innerHTML = `
    <section class="panel">
      <h3>Filters</h3>
      <form id="task-filter-form" class="filters" style="margin-top: 14px">
        <label>Search <input name="q" placeholder="Search task or project" /></label>
        <label>Project <select name="projectId"><option value="">All projects</option>${renderProjectOptions()}</select></label>
        <label>Status
          <select name="status">
            <option value="">All statuses</option>
            <option value="TODO">Todo</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="DONE">Done</option>
          </select>
        </label>
        <label>Mine
          <select name="mine">
            <option value="">All visible</option>
            <option value="true">Assigned to me</option>
          </select>
        </label>
        <button class="primary-btn" type="submit">Apply filters</button>
      </form>
    </section>
    <section class="panel">
      <h3>Tasks</h3>
      <div style="margin-top: 14px">${renderTaskRows(state.tasks)}</div>
    </section>
  `;
}

function renderTeam() {
  els.content.innerHTML = `
    <section class="panel">
      <h3>Users</h3>
      <div class="table-wrap" style="margin-top: 14px">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            ${state.users
              .map(
                (user) => `
                  <tr>
                    <td><strong>${escapeHtml(user.name)}</strong></td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>
                      ${
                        state.user.role === 'ADMIN'
                          ? `<select data-update-role="${user.id}">
                              <option value="MEMBER" ${user.role === 'MEMBER' ? 'selected' : ''}>Member</option>
                              <option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>Admin</option>
                            </select>`
                          : `<span class="badge">${escapeHtml(user.role)}</span>`
                      }
                    </td>
                    <td>${formatDate(user.createdAt)}</td>
                  </tr>
                `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

async function refreshAndRender(message) {
  await loadAll();
  renderAppShell();
  if (message) showToast(message);
}

async function handleLogin(event) {
  event.preventDefault();
  try {
    const body = formData(event.target);
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify(body) });
    state.user = data.user;
    await refreshAndRender('Logged in successfully');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function handleSignup(event) {
  event.preventDefault();
  try {
    const body = formData(event.target);
    const data = await api('/auth/signup', { method: 'POST', body: JSON.stringify(body) });
    state.user = data.user;
    await refreshAndRender('Account created successfully');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function bootstrap() {
  try {
    const data = await api('/auth/me');
    state.user = data.user;
    await loadAll();
    renderAppShell();
  } catch (_error) {
    renderAuth();
  }
}

els.loginForm.addEventListener('submit', handleLogin);
els.signupForm.addEventListener('submit', handleSignup);

document.querySelectorAll('[data-auth-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const tab = button.dataset.authTab;
    document.querySelectorAll('[data-auth-tab]').forEach((item) => item.classList.toggle('active', item === button));
    els.loginForm.classList.toggle('hidden', tab !== 'login');
    els.signupForm.classList.toggle('hidden', tab !== 'signup');
  });
});

document.querySelectorAll('.nav-link').forEach((button) => {
  button.addEventListener('click', () => setPage(button.dataset.page));
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (_error) {
    // Ignore logout network errors and clear local UI anyway.
  }
  state.user = null;
  renderAuth();
});

document.getElementById('refresh-btn').addEventListener('click', async () => {
  try {
    await refreshAndRender('Data refreshed');
  } catch (error) {
    showToast(error.message, true);
  }
});

document.addEventListener('click', async (event) => {
  const projectCard = event.target.closest('[data-select-project]');
  if (projectCard) {
    state.selectedProjectId = projectCard.dataset.selectProject;
    try {
      await loadProjectMembers(state.selectedProjectId);
      renderPage();
    } catch (error) {
      showToast(error.message, true);
    }
  }

  const deleteTaskButton = event.target.closest('[data-delete-task]');
  if (deleteTaskButton) {
    if (!confirm('Delete this task?')) return;
    try {
      await api(`/tasks/${deleteTaskButton.dataset.deleteTask}`, { method: 'DELETE' });
      await refreshAndRender('Task deleted');
    } catch (error) {
      showToast(error.message, true);
    }
  }

  const deleteProjectButton = event.target.closest('[data-delete-project]');
  if (deleteProjectButton) {
    if (!confirm('Delete this project and all its tasks?')) return;
    try {
      await api(`/projects/${deleteProjectButton.dataset.deleteProject}`, { method: 'DELETE' });
      state.selectedProjectId = null;
      await refreshAndRender('Project deleted');
    } catch (error) {
      showToast(error.message, true);
    }
  }

  const removeMemberButton = event.target.closest('[data-remove-member]');
  if (removeMemberButton && state.selectedProjectId) {
    if (!confirm('Remove this member from the selected project?')) return;
    try {
      await api(`/projects/${state.selectedProjectId}/members/${removeMemberButton.dataset.removeMember}`, { method: 'DELETE' });
      await refreshAndRender('Member removed');
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

document.addEventListener('change', async (event) => {
  const statusSelect = event.target.closest('[data-update-task-status]');
  if (statusSelect) {
    try {
      await api(`/tasks/${statusSelect.dataset.updateTaskStatus}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: statusSelect.value }),
      });
      await refreshAndRender('Task status updated');
    } catch (error) {
      showToast(error.message, true);
    }
  }

  const roleSelect = event.target.closest('[data-update-role]');
  if (roleSelect) {
    try {
      await api(`/users/${roleSelect.dataset.updateRole}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: roleSelect.value }),
      });
      await refreshAndRender('User role updated');
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

document.addEventListener('submit', async (event) => {
  if (event.target.id === 'project-form') {
    event.preventDefault();
    try {
      const body = formData(event.target);
      const data = await api('/projects', { method: 'POST', body: JSON.stringify(body) });
      state.selectedProjectId = data.project.id;
      await refreshAndRender('Project created');
    } catch (error) {
      showToast(error.message, true);
    }
  }

  if (event.target.id === 'task-form') {
    event.preventDefault();
    try {
      const body = formData(event.target);
      const payload = {
        projectId: body.projectId,
        title: body.title,
        description: body.description || '',
        status: body.status,
        priority: body.priority,
        assigneeId: body.assigneeId || null,
        dueDate: inputDateToIso(body.dueDate),
      };
      await api('/tasks', { method: 'POST', body: JSON.stringify(payload) });
      await refreshAndRender('Task created');
    } catch (error) {
      showToast(error.message, true);
    }
  }

  if (event.target.id === 'add-member-form') {
    event.preventDefault();
    try {
      const body = formData(event.target);
      await api(`/projects/${state.selectedProjectId}/members`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await refreshAndRender('Member added');
    } catch (error) {
      showToast(error.message, true);
    }
  }

  if (event.target.id === 'task-filter-form') {
    event.preventDefault();
    try {
      const body = formData(event.target);
      const params = new URLSearchParams();
      Object.entries(body).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const data = await api(`/tasks?${params.toString()}`);
      state.tasks = data.tasks;
      renderTasks();
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

bootstrap();
