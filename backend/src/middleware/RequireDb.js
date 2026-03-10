/**
 * backend/src/middleware/RequireDb.js
 * Blocks requests if MongoDB is not connected — unchanged from original.
 */

import mongoose from 'mongoose';

export const requireDb = (req, res, next) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ success: false, message: 'Database not connected' });
  next();
};