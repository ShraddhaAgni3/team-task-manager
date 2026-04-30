# Team Task Manager - Full Stack Assessment

A complete full-stack Team Task Manager where users can sign up, log in, create projects, assign tasks, track progress, and use role-based access control.

## Features

- Authentication: signup, login, logout, current user session
- Roles: `ADMIN` and `MEMBER`
- Project management: create, edit, archive/delete, view project members
- Team management: admin can add/remove project members and change user roles
- Task management: create, assign, update status, priority, due date, delete
- Dashboard: task counts, status breakdown, overdue tasks, due soon tasks
- REST APIs with validations and consistent JSON errors
- SQL database using SQLite with relationships and foreign keys
- Railway-ready config included

## Tech Stack

- Backend: Node.js, Express.js
- Database: SQLite via better-sqlite3
- Auth: JWT stored in HttpOnly cookie
- Validation: Zod
- Frontend: HTML, CSS, Vanilla JavaScript served by Express

## How to Run Locally

### 1. Install Node.js

Use Node.js 20 or newer.

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment file

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
copy .env.example .env
```

### 4. Seed the database

```bash
npm run seed
```

To reset all data and seed fresh demo data:

```bash
npm run reset
```

### 5. Start the app

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin@1234` |
| Member | `member@example.com` | `Member@1234` |
| Member | `designer@example.com` | `Designer@1234` |

## Role Permissions

| Feature | Admin | Member |
|---|---:|---:|
| View dashboard | Yes | Yes |
| Create projects | Yes | No |
| Edit/archive projects | Yes | No |
| Add/remove project members | Yes | No |
| View assigned projects | Yes | Yes |
| Create tasks in accessible projects | Yes | Yes |
| Assign tasks to project members | Yes | Yes |
| Update task status | Yes | Yes |
| Delete any task | Yes | No |
| Delete own task | Yes | Yes |
| Change user roles | Yes | No |

## API Overview

Base URL locally:

```text
http://localhost:3000/api
```

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Create a member account |
| POST | `/auth/login` | Login and set HttpOnly cookie |
| POST | `/auth/logout` | Clear session cookie |
| GET | `/auth/me` | Get current user |

### Users

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users` | List users |
| PATCH | `/users/:id/role` | Admin changes role |

### Projects

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects` | List visible projects |
| POST | `/projects` | Admin creates project |
| GET | `/projects/:id` | Get project detail |
| PATCH | `/projects/:id` | Admin updates project |
| DELETE | `/projects/:id` | Admin deletes project |
| GET | `/projects/:id/members` | List project members |
| POST | `/projects/:id/members` | Admin adds member |
| DELETE | `/projects/:id/members/:userId` | Admin removes member |

### Tasks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/tasks` | List visible tasks with filters |
| POST | `/tasks` | Create task |
| GET | `/tasks/:id` | Get task |
| PATCH | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task |

### Dashboard

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard/summary` | Counts, status, overdue, due soon |
| GET | `/health` | Deployment health check |

## Sample API Requests

### Login

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@1234"}'
```

### Create Project

Use the cookie returned from login.

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -b "token=<cookie-value>" \
  -d '{"name":"Mobile App","key":"MOB","description":"Mobile release work"}'
```

## Database Schema

Main tables:

- `users`
- `projects`
- `project_members`
- `tasks`

Relationships:

- A user can create many projects.
- A project can have many members through `project_members`.
- A project can have many tasks.
- A task belongs to one project.
- A task can be assigned to a user.
- A task has a creator.

## Railway Deployment

1. Push this folder to GitHub.
2. Create a new Railway project.
3. Select **Deploy from GitHub Repo**.
4. Add environment variables:

```text
NODE_ENV=production
JWT_SECRET=<generate-a-long-secret>
DATABASE_PATH=./data/team_task_manager.db
APP_ORIGIN=https://your-railway-domain.up.railway.app
```

5. Railway will use `npm start` from `railway.toml`.
6. After first deploy, open the Railway shell or run locally against the deployment and seed demo data if needed:

```bash
npm run seed
```

Note: SQLite is perfect for local assessment demos. For a long-running production app, PostgreSQL is recommended.

## Demo Video Script 2-5 Minutes

1. Show login with admin account.
2. Show dashboard cards: total tasks, overdue, status counts.
3. Create a new project.
4. Add a member to the project.
5. Create a task, assign it, set due date and priority.
6. Change task status from Todo to In Progress/Done.
7. Log out and log in as member.
8. Show member can access assigned project but cannot create projects or change roles.
9. Show GitHub repo and Railway live URL.

## Project Structure

```text
team-task-manager/
  public/              Frontend files
  scripts/             Seed script
  src/                 Backend source code
    middleware/        Auth and error middleware
    routes/            REST API routes
    auth.js            Cookie/JWT utilities
    db.js              SQLite connection and schema
    server.js          Express app
  data/                Local SQLite DB folder
  railway.toml         Railway deployment config
  Dockerfile           Optional Docker deployment
```
