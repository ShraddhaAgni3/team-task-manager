# Manual API Test Checklist

Run the app first:

```bash
npm run dev
```

## Health

```bash
curl http://localhost:3000/api/health
```

## Login as Admin

```bash
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@1234"}'
```

## Current User

```bash
curl -b cookies.txt http://localhost:3000/api/auth/me
```

## List Projects

```bash
curl -b cookies.txt http://localhost:3000/api/projects
```

## Create Project

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Hiring Assessment","key":"HR","description":"Demo assessment project"}'
```

## List Tasks

```bash
curl -b cookies.txt http://localhost:3000/api/tasks
```

## Dashboard

```bash
curl -b cookies.txt http://localhost:3000/api/dashboard/summary
```
