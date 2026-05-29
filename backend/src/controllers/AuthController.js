/**
 * AuthController.js — WITH ADMIN APPROVAL SYSTEM
 *
 * dept_officer registers → accountStatus: 'pending'
 * superAdmin approves   → accountStatus: 'active' → can login
 * superAdmin itself     → auto-approved (accountStatus: 'active')
 */

import { User }          from '../models/User.js';
import { generateToken } from '../middleware/Auth.js';

const authResponse = (res, user, statusCode = 200) => {
  const token = generateToken(user._id, user.role);
  return res.status(statusCode).json({ success: true, token, user: user.toJSON() });
};

// POST /api/auth/citizen/register
export const registerCitizen = async (req, res) => {
  try {
    const { name, email, password, phone, age, address, ward, pincode, aadharLast4, language } = req.body;
    if (!name || !email || !password || !phone || !ward)
      return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    if (await User.findOne({ email }))
      return res.status(409).json({ success: false, message: 'Email already registered' });
    const user = await User.create({
      role: 'citizen', name, email, password, phone,
      age: parseInt(age) || undefined, address,
      ward: parseInt(ward), pincode, aadharLast4,
      language: language || 'English',
      points: 0, badge: 'Bronze', complaintsSubmitted: 0, complaintsResolved: 0,
      accountStatus: 'active',
    });
    return authResponse(res, user, 201);
  } catch (err) {
    console.error('registerCitizen error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/citizen/login
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

// POST /api/auth/admin/register
// dept_officer → accountStatus: 'pending' (needs superAdmin approval)
// superAdmin   → accountStatus: 'active'  (auto-approved)
export const registerAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, department, post, joinedDate, role: reqRole } = req.body;
    if (!name || !email || !password || !phone)
      return res.status(400).json({ success: false, message: 'Name, email, password and phone are required' });

    const allowedRoles = ['superAdmin', 'dept_officer', 'admin'];
    const role = allowedRoles.includes(reqRole) ? reqRole : 'dept_officer';

    if (role !== 'superAdmin' && !department)
      return res.status(400).json({ success: false, message: 'Department is required for department officers' });

    if (await User.findOne({ email }))
      return res.status(409).json({ success: false, message: 'Email already registered' });

    const count      = await User.countDocuments({ role: { $in: ['admin', 'dept_officer', 'superAdmin'] } });
    const employeeId = `MUN-2026-${String(count + 1).padStart(4, '0')}`;

    // dept_officer starts as 'pending' — superAdmin must approve
    const accountStatus = role === 'superAdmin' ? 'active' : 'pending';

    const user = await User.create({
      role, name, email, password, phone,
      department: role === 'superAdmin' ? 'All Departments' : department,
      post: post || (role === 'superAdmin' ? 'Super Administrator' : 'Junior Officer'),
      joinedDate, employeeId,
      accountStatus,
    });

    if (accountStatus === 'pending') {
      // Don't return token — they can't login yet
      return res.status(201).json({
        success: true,
        pending: true,
        message: 'Registration successful. Your account is pending approval by the Super Admin. You will be notified once approved.',
        user: { name: user.name, email: user.email, department: user.department, employeeId },
      });
    }

    return authResponse(res, user, 201);
  } catch (err) {
    console.error('registerAdmin error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/admin/login
// Blocks pending accounts
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email, role: { $in: ['admin', 'superAdmin', 'dept_officer'] } });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    // Block pending accounts
    if (user.accountStatus === 'pending') {
      return res.status(403).json({
        success: false,
        pending: true,
        message: 'Your account is pending approval by the Super Admin. Please wait for approval before logging in.',
      });
    }

    // Block rejected accounts
    if (user.accountStatus === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your account registration was rejected. Please contact the Super Admin.',
      });
    }

    return authResponse(res, user);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// GET /api/auth/pending-admins  (superAdmin only)
export const getPendingAdmins = async (req, res) => {
  try {
    if (req.user.role !== 'superAdmin')
      return res.status(403).json({ success: false, message: 'Super Admin only' });
    const pending = await User.find({ accountStatus: 'pending' }).select('-password');
    res.json({ success: true, pending });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/auth/approve-admin/:id  (superAdmin only)
export const approveAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'superAdmin')
      return res.status(403).json({ success: false, message: 'Super Admin only' });

    const { action } = req.body; // 'approve' or 'reject'
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.accountStatus = action === 'approve' ? 'active' : 'rejected';
    await user.save();

    res.json({
      success: true,
      message: `Admin ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      user: user.toJSON(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/forgot-password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'Email not found' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[DEV] OTP for ${email}: ${otp}`);
    res.json({ success: true, message: 'OTP sent (check server logs in dev)', otp_dev: otp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};