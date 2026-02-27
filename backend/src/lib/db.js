import mongoose from 'mongoose';
import { ENV } from './env.js';

export const connectDB = async () => {
  // Avoid re-attaching listeners during nodemon restarts
  if (!mongoose.connection.__janvaniListenersAttached) {
    mongoose.connection.__janvaniListenersAttached = true;

    mongoose.connection.on('connected',    () => console.log('✅ MongoDB connected'));
    mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
    mongoose.connection.on('error',    err => console.error('❌ MongoDB error:', err?.message || err));
  }

  if (ENV.SKIP_DB) {
    console.warn('⚠️  SKIP_DB=true — starting without MongoDB');
    return false;
  }

  if (!ENV.DB_URL) {
    console.warn('⚠️  DB_URL not set — starting without MongoDB');
    return false;
  }

  try {
    const conn = await mongoose.connect(ENV.DB_URL, {
      // ── Timeouts ─────────────────────────────────────────────────
      // Atlas M0 (free tier) can take 8-12s on cold start — give it room
      serverSelectionTimeoutMS : 20_000,  // was 5000 — caused timeouts on slow Atlas
      connectTimeoutMS         : 20_000,  // TCP connect budget
      socketTimeoutMS          : 45_000,  // per-operation socket timeout

      // ── Connection pool ──────────────────────────────────────────
      maxPoolSize              : 10,      // reuse up to 10 connections
      minPoolSize              : 2,       // keep 2 warm — reduces cold-start on queries
      maxIdleTimeMS            : 60_000,  // close idle connections after 1 min

      // ── Keep-alive ───────────────────────────────────────────────
      // Prevents Atlas firewall from silently dropping idle TCP connections
      heartbeatFrequencyMS     : 10_000,  // ping Atlas every 10s
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);

    if (ENV.DB_STRICT || ENV.NODE_ENV === 'production') {
      process.exit(1);
    }

    console.warn('⚠️  Continuing without MongoDB (dev mode).');
    console.warn('   Fix Atlas IP allowlist or set DB_STRICT=true to crash on failure.');
    return false;
  }
};