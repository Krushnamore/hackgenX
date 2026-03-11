/**
 * server.js — PERFORMANCE OPTIMIZED + SERVES REACT FRONTEND
 */

import express     from 'express';
import cors        from 'cors';
import morgan      from 'morgan';
import mongoose    from 'mongoose';
import compression from 'compression';
import helmet      from 'helmet';
import path        from 'path';
import { fileURLToPath } from 'url';
import { connectDB }  from './lib/db.js';
import { ENV }        from './lib/env.js';
import { requireDb }  from './middleware/RequireDb.js';

import authRoutes      from './routes/Auth.js';
import complaintRoutes from './routes/Complaints.js';
import userRoutes      from './routes/Users.js';

// ── ESM __dirname fix ──────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Connect to MongoDB ─────────────────────────────────────────
await connectDB();

const app = express();

// ── Security headers ───────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ── Gzip compression ───────────────────────────────────────────
app.use(compression());

// ── CORS ───────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  ENV.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.endsWith('.onrender.com')) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ── Body parsing ───────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Dev-only: Request timing + HTTP logging ────────────────────
if (ENV.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const start = Date.now();
    const origJson = res.json.bind(res);
    res.json = (body) => {
      console.debug(`[${req.method}] ${req.path} — ${Date.now() - start}ms`);
      return origJson(body);
    };
    next();
  });
  app.use(morgan('dev'));
}

// ── Cache-Control hints ────────────────────────────────────────
app.use('/api/users/leaderboard', (req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'public, max-age=30');
  next();
});
app.use('/api/complaints/stats', (req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'private, max-age=15');
  next();
});

// ── API Routes ─────────────────────────────────────────────────
app.use('/api/auth',       requireDb, authRoutes);
app.use('/api/complaints', requireDb, complaintRoutes);
app.use('/api/users',      requireDb, userRoutes);

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status : 'ok',
    env    : ENV.NODE_ENV,
    time   : new Date().toISOString(),
    db     : {
      connected  : mongoose.connection.readyState === 1,
      readyState : mongoose.connection.readyState,
      name       : mongoose.connection.name || null,
      host       : mongoose.connection.host || null,
    },
  });
});

// ── Serve React Frontend (PRODUCTION ONLY) ─────────────────────
// ✅ Must come AFTER all /api routes
// ✅ server.js is at /app/backend/src/server.js
// ✅ __dirname   = /app/backend/src
// ✅ frontendDist = /app/Frontend/dist
if (ENV.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../Frontend/dist');

  app.use(express.static(frontendDist));

  // All non-API routes → React app (supports React Router)
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ── 404 (dev only) ─────────────────────────────────────────────
if (ENV.NODE_ENV !== 'production') {
  app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
  });
}

// ── Global error handler ───────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status  = err.status || err.statusCode || 500;
  const message = ENV.NODE_ENV === 'production' ? 'Server error' : (err.message || 'Server error');
  console.error(`[ERROR] ${status} — ${message}`);
  if (!res.headersSent) res.status(status).json({ success: false, message });
});

// ── Start server ───────────────────────────────────────────────
const server = app.listen(ENV.PORT, () => {
  console.log(`🚀 JANVANI backend running on http://localhost:${ENV.PORT}`);
  console.log(`📡 Environment: ${ENV.NODE_ENV}`);
});

server.keepAliveTimeout = 65_000;
server.headersTimeout   = 66_000;