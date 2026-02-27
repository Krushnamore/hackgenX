import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT       : process.env.PORT       || 5000,
  DB_URL     : process.env.DB_URL,
  SKIP_DB    : process.env.SKIP_DB === 'true',
  DB_STRICT  : process.env.DB_STRICT === 'true',
  JWT_SECRET : process.env.JWT_SECRET,
  JWT_EXPIRES: process.env.JWT_EXPIRES_IN || '24h',
  NODE_ENV   : process.env.NODE_ENV   || 'development',
  CLIENT_URL : process.env.CLIENT_URL || 'http://localhost:8080',
};