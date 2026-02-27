import mongoose from 'mongoose';
import { ENV } from './env.js';

export const connectDB = async () => {
  // Avoid re-attaching listeners during nodemon restarts / repeated imports
  if (!mongoose.connection.__janvaniListenersAttached) {
    mongoose.connection.__janvaniListenersAttached = true;

    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected');
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err?.message || err);
    });
  }

  if (ENV.SKIP_DB) {
    console.warn('⚠️ SKIP_DB=true — starting backend without MongoDB');
    return false;
  }

  if (!ENV.DB_URL) {
    console.warn('⚠️ DB_URL is not set — starting backend without MongoDB');
    console.warn('   Set DB_URL in your .env (or set SKIP_DB=true to silence this).');
    return false;
  }

  try {
    const conn = await mongoose.connect(ENV.DB_URL, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);

    // In production (or when explicitly strict), fail fast.
    if (ENV.DB_STRICT || ENV.NODE_ENV === 'production') {
      process.exit(1);
    }

    console.warn('⚠️ Continuing without MongoDB (development mode).');
    console.warn('   Fix Atlas connectivity / IP allowlist, or set DB_STRICT=true to crash on failure.');
    return false;
  }
};