import { User } from '../models/User.js';
import { generateToken } from '../middleware/Auth.js';

// ─────────────────────────────────────────────────────────────
// Helper: build response payload
// ─────────────────────────────────────────────────────────────
const authResponse = (res, user, statusCode = 200) => {
  const token = generateToken(user._id, user.role);
  return res.status(statusCode).json({
    success : true,
    token,
    user    : user.toJSON(),   // password stripped by toJSON()
  });
};

// ─────────────────────────────────────────────────────────────
// POST /api/auth/citizen/register
// ─────────────────────────────────────────────────────────────
export const registerCitizen = async (req, res) => {
  try {
    const { name, email, password, phone, age, address, ward, pincode, aadharLast4, language } = req.body;

    // Validate required fields
    if (!name || !email || !password || !phone || !ward) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }

    // Check duplicate
    if (await User.findOne({ email })) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({
      role: 'citizen',
      name, email, password, phone,
      age: parseInt(age) || undefined,
      address, ward: parseInt(ward),
      pincode, aadharLast4,
      language: language || 'English',
      points: 0, badge: 'Bronze',
      complaintsSubmitted: 0, complaintsResolved: 0,
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
// ─────────────────────────────────────────────────────────────
export const registerAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, department, post, joinedDate } = req.body;

    if (!name || !email || !password || !phone || !department) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }

    if (await User.findOne({ email })) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Auto-generate employee ID
    const count = await User.countDocuments({ role: 'admin' });
    const employeeId = `MUN-2026-${String(count + 1).padStart(4, '0')}`;

    const user = await User.create({
      role: 'admin',
      name, email, password, phone,
      department, post: post || 'Junior Officer',
      joinedDate, employeeId,
    });

    return authResponse(res, user, 201);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/auth/admin/login
// ─────────────────────────────────────────────────────────────
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email, role: 'admin' });
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
// POST /api/auth/forgot-password  (simulated OTP)
// ─────────────────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'Email not found' });

    // In production: send real OTP via SMS/email
    // Here we simulate — store OTP in DB or cache, return demo token
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[DEV] OTP for ${email}: ${otp}`);  // log in dev only

    res.json({ success: true, message: 'OTP sent to email (check server logs in dev)', otp_dev: otp });
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
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword;   // pre-save hook will hash it
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};