/**
 * backend/src/middleware/Auth.js
 * JWT protect middleware — unchanged from original.
 * Works for all roles: citizen, admin, superAdmin, dept_officer.
 */

import jwt  from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ENV }  from '../lib/env.js';

export const generateToken = (id, role) =>
  jwt.sign({ id, role }, ENV.JWT_SECRET, { expiresIn: '7d' });

export const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'No token provided' });

  try {
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, ENV.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ── Role guards ───────────────────────────────────────────────

// Allows any admin-tier role (superAdmin, dept_officer, legacy admin)
export const requireAdmin = (req, res, next) => {
  const adminRoles = ['admin', 'superAdmin', 'dept_officer'];
  if (!adminRoles.includes(req.user?.role))
    return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
};

// Only superAdmin passes
export const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'superAdmin')
    return res.status(403).json({ success: false, message: 'Super Admin access required' });
  next();
};

// ── requireRole — backward-compatible alias used by existing routes ───────────
// Usage: requireRole('admin') or requireRole('citizen')
// Passing 'admin' allows all admin-tier roles (superAdmin, dept_officer, admin).
export const requireRole = (...roles) => (req, res, next) => {
  const adminRoles = ['admin', 'superAdmin', 'dept_officer'];
  const userRole   = req.user?.role;

  // If any requested role is 'admin', accept all admin-tier roles
  const allowed = roles.some(r => r === 'admin')
    ? [...adminRoles, ...roles]
    : roles;

  if (!allowed.includes(userRole))
    return res.status(403).json({ success: false, message: `Access denied. Required: ${roles.join(' or ')}` });

  next();
};

// Also fix the duplicate email index warning from User model
// (the warning is harmless but noisy — fix is in User.js: remove the inline index:true on email)