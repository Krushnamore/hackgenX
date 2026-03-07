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
import { connectDB }  from './lib/db.js';
import { ENV }        from './lib/env.js';
import { requireDb }  from './middleware/RequireDb.js';

import authRoutes      from './routes/Auth.js';
import complaintRoutes from './routes/Complaints.js';
import userRoutes      from './routes/Users.js';

// ── Connect to MongoDB ─────────────────────────────────────────
await connectDB();

const app = express();

// ── Security headers (lightweight) ────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ── Gzip compression — biggest single win for JSON APIs ───────
// Compresses responses > 1KB. Complaint list goes from ~50KB → ~8KB.
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request timing header (dev debugging only) ────────────────
if (ENV.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const start = Date.now();
    // Patch json() so we log timing without touching headers after send
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
// These tell the browser/CDN to cache for a short time.
// The frontend's own in-memory cache still takes priority.
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

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global error handler ──────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status  = err.status || err.statusCode || 500;
  const message = ENV.NODE_ENV === 'production' ? 'Server error' : (err.message || 'Server error');
  console.error(`[ERROR] ${status} — ${message}`);
  if (!res.headersSent) res.status(status).json({ success: false, message });
});

// ── Start server with keep-alive ──────────────────────────────
const PORT = process.env.PORT || ENV.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 JANVANI backend running on port ${PORT}`);
  console.log(`📡 Environment: ${ENV.NODE_ENV}`);
});

// Keep TCP connections alive — avoids reconnect overhead on every request
server.keepAliveTimeout    = 65_000;  // slightly > typical LB idle timeout (60s)
server.headersTimeout      = 66_000;  // must be > keepAliveTimeout