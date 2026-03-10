/**
 * backend/src/routes/Users.js
 *
 * GET /api/users/leaderboard
 *   ?ward=1   (optional) filter by ward
 *   ?limit=50 (optional) max results, default 100
 */

import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Lazy-load User model to avoid circular import issues
const getUser = () => mongoose.model('User');

// ── GET /api/users/leaderboard ──────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  try {
    const User  = getUser();
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const ward  = req.query.ward ? parseInt(req.query.ward) : null;

    const filter = { role: 'citizen' };
    if (ward) filter.ward = ward;

    const users = await User.find(filter)
      .select('name ward points badge complaintsSubmitted complaintsResolved createdAt')
      .sort({ points: -1 })
      .limit(limit)
      .lean();

    const list = users.map(u => ({ ...u, id: u._id.toString() }));

    return res.json({ success: true, users: list, total: list.length });
  } catch (err) {
    console.error('leaderboard error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;