/**
 * UserController.js — UPDATED
 *
 * CHANGES:
 * - getLeaderboard: supports ?global=true (city-wide top 3) and ?ward=N filtering
 * - All other methods unchanged
 */

import { User } from '../models/User.js';

const getBadge = (points) =>
  points >= 1000 ? 'Gold' : points >= 500 ? 'Silver' : 'Bronze';

// GET /api/users/leaderboard
// ?ward=N         → filter by ward (up to 100 users)
// ?global=true    → city-wide top 3 only (ignores ward)
// ?limit=N        → override default limit (max 200)
export const getLeaderboard = async (req, res) => {
  try {
    const { ward, global: isGlobal, limit = 50 } = req.query;
    const filter = { role: 'citizen' };

    // global=true → no ward filter, return top 3 city-wide
    if (isGlobal !== 'true' && ward) filter.ward = parseInt(ward);

    const resolvedLimit = isGlobal === 'true' ? 3 : Math.min(parseInt(limit) || 50, 200);

    const users = await User.find(filter)
      .select('name ward points badge complaintsSubmitted complaintsResolved')
      .sort({ points: -1 })
      .limit(resolvedLimit)
      .lean();

    res.json({ success: true, leaderboard: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/me
export const getProfile = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// PATCH /api/users/me
export const updateProfile = async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'address', 'ward', 'pincode', 'language', 'department', 'post'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, select: '-password' }
    ).lean();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/users/me/password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!(await user.matchPassword(currentPassword)))
      return res.status(400).json({ success: false, message: 'Current password incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users — admin: list all citizens
export const getAllCitizens = async (req, res) => {
  try {
    const users = await User.find({ role: 'citizen' })
      .select('name email phone ward points badge complaintsSubmitted complaintsResolved createdAt')
      .lean();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};