/**
 * backend/src/controllers/AuthController.js
 *
 * TWO-TIER ADMIN SYSTEM
 * ─────────────────────
 * registerAdmin accepts role: 'superAdmin' | 'dept_officer' | 'admin' (legacy)
 * loginAdmin    accepts all three admin roles in one query
 */

import { User }          from '../models/User.js';
import { generateToken } from '../middleware/Auth.js';

// ── Helper: build and send auth response ─────────────────────
const authResponse = (res, user, statusCode = 200) => {
  const token = generateToken(user._id, user.role);
  return res.status(statusCode).json({
    success : true,
    token,
    user    : user.toJSON(),
  });
};

// ─────────────────────────────────────────────────────────────
// POST /api/auth/citizen/register
// ─────────────────────────────────────────────────────────────
export const registerCitizen = async (req, res) => {
  try {
    const {
      name, email, password, phone,
      age, address, ward, pincode, aadharLast4, language,
    } = req.body;

    // ensure numerical values are parsed before validation
    const wardNum = ward !== undefined ? parseInt(ward) : ward;

    const requiredFields = { name, email, password, phone, ward: wardNum };
    const missing = Object.entries(requiredFields)
      .filter(([, v]) => v === undefined || v === null || v === '' || (typeof v === 'number' && isNaN(v)))
      .map(([k]) => k);

    if (missing.length) {
      // log the incoming body for debugging purposes
      console.warn('registerCitizen missing fields:', missing, 'body:', req.body);
      return res.status(400).json({
        success: false,
        message: `Please provide the following required field(s): ${missing.join(', ')}`,
      });
    }

    if (await User.findOne({ email }))
      return res.status(409).json({ success: false, message: 'Email already registered' });

    const user = await User.create({
      role                : 'citizen',
      name, email, password, phone,
      age                 : parseInt(age) || undefined,
      address,
      ward                : parseInt(ward),
      pincode, aadharLast4,
      language            : language || 'English',
      points              : 0,
      badge               : 'Bronze',
      complaintsSubmitted : 0,
      complaintsResolved  : 0,
    });

    return authResponse(res, user, 201);
  } catch (err) {
    console.error('registerCitizen error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/auth/citizen/login
// ─────────────────────────────────────────────────────────────
export const loginCitizen = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email, role: 'citizen' });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    return authResponse(res, user);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/auth/admin/register
//
// Body fields:
//   role       — 'superAdmin' | 'dept_officer'  (required; defaults to dept_officer)
//   name       — full name
//   email      — work email
//   password   — plain text (hashed by pre-save hook)
//   phone      — contact number
//   department — required for dept_officer; auto-set for superAdmin
//   post       — job title / designation
//   joinedDate — ISO date string
// ─────────────────────────────────────────────────────────────
export const registerAdmin = async (req, res) => {
  try {
    const {
      name, email, password, phone,
      department, post, joinedDate,
      role: reqRole,
    } = req.body;

    // Basic validation
    if (!name || !email || !password || !phone)
      return res.status(400).json({ success: false, message: 'Name, email, password and phone are required' });

    // Determine role — only allow known admin roles
    const allowedRoles = ['superAdmin', 'dept_officer', 'admin'];
    const role = allowedRoles.includes(reqRole) ? reqRole : 'dept_officer';

    // dept_officer must have a department
    if (role !== 'superAdmin' && !department)
      return res.status(400).json({ success: false, message: 'Department is required for department officers' });

    // Check duplicate email
    if (await User.findOne({ email }))
      return res.status(409).json({ success: false, message: 'Email already registered' });

    // Auto-generate sequential employee ID
    const count      = await User.countDocuments({ role: { $in: ['admin', 'dept_officer', 'superAdmin'] } });
    const employeeId = `MUN-2026-${String(count + 1).padStart(4, '0')}`;

    const user = await User.create({
      role,
      name, email, password, phone,
      department : role === 'superAdmin' ? 'All Departments' : department,
      post       : post || (role === 'superAdmin' ? 'Super Administrator' : 'Junior Officer'),
      joinedDate,
      employeeId,
    });

    return authResponse(res, user, 201);
  } catch (err) {
    console.error('registerAdmin error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/auth/admin/login
// Accepts superAdmin, dept_officer, and legacy admin roles
// ─────────────────────────────────────────────────────────────
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({
      email,
      role: { $in: ['admin', 'superAdmin', 'dept_officer'] },
    });

    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    return authResponse(res, user);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/auth/me  (protected)
// ─────────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// ─────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ success: false, message: 'Email not found' });

    // In production: send real OTP via SMS/email
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[DEV] OTP for ${email}: ${otp}`);

    res.json({ success: true, message: 'OTP sent (check server logs in dev)', otp_dev: otp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword; // pre-save hook will hash it
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};