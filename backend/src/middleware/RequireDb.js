import mongoose from 'mongoose';

export const requireDb = (req, res, next) => {
  // Mongoose readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  if (mongoose.connection.readyState === 1) return next();

  return res.status(503).json({
    success: false,
    message: 'Database not connected',
    hint: 'Set DB_URL and ensure Atlas IP allowlist includes your current IP, or run with SKIP_DB=true for a limited no-DB mode.',
  });
};
