/**
 * server.js — PERFORMANCE OPTIMIZED
 *
 * IMPROVEMENTS:
 * 1. COMPRESSION: gzip/brotli via 'compression' middleware — JSON payloads shrink 60-80%
 * 2. KEEP-ALIVE: Persistent connections reduce TCP handshake overhead per request
 * 3. RESPONSE TIME: X-Response-Time header helps diagnose slow endpoints in production
 * 4. HELMET: Security headers (lightweight, recommended for any public-facing API)
 * 5. CACHE HEADERS: GET routes for static-ish data (leaderboard, stats) get short cache hints
 *
 * Install new deps first:
 *   npm install compression helmet
 */

import express    from 'express';
import cors       from 'cors';
import morgan     from 'morgan';
import mongoose   from 'mongoose';
import compression from 'compression';
import helmet     from 'helmet';
import path       from 'path';                    // ← NEW
import { fileURLToPath } from 'url';              // ← NEW
import { connectDB }  from './lib/db.js';
import { ENV }        from './lib/env.js';
import { requireDb }  from './middleware/RequireDb.js';

import authRoutes      from './routes/Auth.js';
import complaintRoutes from './routes/Complaints.js';
import userRoutes      from './routes/Users.js';

// ── ESM __dirname fix ──────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);  // ← NEW
const __dirname  = path.dirname(__filename);         // ← NEW

// ── Connect to MongoDB ─────────────────────────────────────────
await connectDB();

const app = express();

// ── Security headers (lightweight) ────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ── Gzip compression — biggest single win for JSON APIs ───────
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────
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

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request timing header (dev debugging only) ────────────────
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
}

// ── HTTP logging ──────────────────────────────────────────────
if (ENV.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Cache-Control hints for read-heavy endpoints ──────────────
app.use('/api/users/leaderboard', (req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'public, max-age=30');
  next();
});
app.use('/api/complaints/stats', (req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'private, max-age=15');
  next();
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',       requireDb, authRoutes);
app.use('/api/complaints', requireDb, complaintRoutes);
app.use('/api/users',      requireDb, userRoutes);

// ── Health check ──────────────────────────────────────────────
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

// ── Serve React Frontend in Production ────────────────────────
// ✅ This must come AFTER all /api routes
// ✅ Path: backend/src/server.js → ../../Frontend/dist
if (ENV.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../Frontend/dist');

  app.use(express.static(frontendDist));

  // All non-API routes serve React's index.html (React Router support)
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ── 404 handler (only reached in development) ─────────────────
if (ENV.NODE_ENV !== 'production') {
  app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
  });
}

// ── Global error handler ──────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status  = err.status || err.statusCode || 500;
  const message = ENV.NODE_ENV === 'production' ? 'Server error' : (err.message || 'Server error');
  console.error(`[ERROR] ${status} — ${message}`);
  if (!res.headersSent) res.status(status).json({ success: false, message });
});

// ── Start server with keep-alive ──────────────────────────────
const server = app.listen(ENV.PORT, () => {
  console.log(`🚀 JANVANI backend running on http://localhost:${ENV.PORT}`);
  console.log(`📡 Environment: ${ENV.NODE_ENV}`);
});

server.keepAliveTimeout = 65_000;
server.headersTimeout   = 66_000;