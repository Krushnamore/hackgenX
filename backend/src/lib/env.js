/**
 * backend/src/lib/env.js
 * Accepts both MONGO_URI and DB_URL (project uses DB_URL in .env)
 */

import 'dotenv/config';

const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env variable: ${key}`);
  return val;
};

export const ENV = {
  PORT        : process.env.PORT       || 5000,
  NODE_ENV    : process.env.NODE_ENV   || 'development',
  // Accept either DB_URL (your .env) or MONGO_URI (fallback)
  MONGO_URI   : process.env.DB_URL     || process.env.MONGO_URI
                || (() => { throw new Error('Missing required env variable: DB_URL or MONGO_URI'); })(),
  JWT_SECRET  : required('JWT_SECRET'),
  CLIENT_URL  : process.env.CLIENT_URL || 'http://localhost:5173',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
};