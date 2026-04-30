require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { initDb, absoluteDatabasePath } = require('./db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const dashboardRoutes = require('./routes/dashboard');
const { errorHandler, notFound } = require('./middleware/error');

const app = express();
const port = Number(process.env.PORT || 3000);
const appOrigin = process.env.APP_ORIGIN || `http://localhost:${port}`;

initDb();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({ origin: appOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), database: path.basename(absoluteDatabasePath) });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use('/api', notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Team Task Manager running at http://localhost:${port}`);
  console.log(`Database: ${absoluteDatabasePath}`);
});
