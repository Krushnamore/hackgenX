import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ENV } from '../lib/env.js';

// ── Verify JWT token ───────────────────────────────────────────
export const protect = async (req, res, next) => {
  let token;

  // Accept token from Authorization header: "Bearer <token>"
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token' });
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ success: false, message: 'User not found' });
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

// ── Role guard ────────────────────────────────────────────────
export const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) {
    return res.status(403).json({ success: false, message: `Access denied — ${role}s only` });
  }
  next();
};

// ── Generate JWT ──────────────────────────────────────────────
export const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, ENV.JWT_SECRET, { expiresIn: ENV.JWT_EXPIRES });
};