import { User } from '../models/User.js';

// GET /api/users/leaderboard
export const getLeaderboard = async (req, res) => {
  try {
    const { ward } = req.query;
    const filter = { role: 'citizen' };
    if (ward) filter.ward = parseInt(ward);

    const users = await User.find(filter)
      .select('name ward points badge complaintsSubmitted complaintsResolved')
      .sort({ points: -1 })
      .limit(50);

    res.json({ success: true, leaderboard: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/me  — current user profile
export const getProfile = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// PATCH /api/users/me  — update profile
export const updateProfile = async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'address', 'ward', 'pincode', 'language',
                     'department', 'post'];   // only these fields editable
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
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

// GET /api/users  — admin: list all citizens
export const getAllCitizens = async (req, res) => {
  try {
    const users = await User.find({ role: 'citizen' }).select('-password');
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};