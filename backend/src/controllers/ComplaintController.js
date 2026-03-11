/**
 * backend/src/routes/Complaints.js
 *
 * KEY CHANGE: Department-scoped complaint access enforced SERVER-SIDE.
 *
 * superAdmin   → sees all complaints (no category filter applied)
 * dept_officer → auto-filtered to their department's category
 * admin (legacy) → treated as dept_officer
 * citizen      → sees only their own complaints
 *
 * Officers CANNOT bypass their department filter via query params.
 */

import express from 'express';
import { protect } from '../middleware/Auth.js';
import { Complaint } from '../models/Complaint.js';
import { User }      from '../models/User.js';

const router = express.Router();

// ── Category ↔ Department mapping ────────────────────────────
// Must match the CATEGORY_DEPT_MAP in all frontend pages
const DEPT_TO_CATEGORY = {
  'Roads & Infrastructure' : 'Road',
  'Water Supply'           : 'Water',
  'Sanitation'             : 'Sanitation',
  'Electricity'            : 'Electricity',
  'Planning'               : 'Other',
  'General Administration' : null,   // null = sees all (like superAdmin)
};

// ── Build scope filter for a user ────────────────────────────
const buildScopeFilter = (user) => {
  if (!user) return {};

  // Citizens: their own complaints only
  if (user.role === 'citizen') return { citizenId: user._id };

  // Super Admin: no restriction
  if (user.role === 'superAdmin') return {};

  // dept_officer or legacy admin: filter by their department's category
  const cat = DEPT_TO_CATEGORY[user.department];
  if (cat === null || cat === undefined) return {}; // General Admin sees all
  return { category: cat };
};

// ── GET /api/complaints ───────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { status, priority, category, ward, search, page = 1, limit = 100 } = req.query;

    const scopeFilter = buildScopeFilter(req.user);

    // Officers cannot override their category scope via query
    if (category && scopeFilter.category && scopeFilter.category !== category) {
      return res.json({ success: true, complaints: [], total: 0 });
    }

    const filter = { ...scopeFilter };
    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;
    if (category && !scopeFilter.category) filter.category = category;
    if (ward)     filter.ward     = Number(ward);

    if (search) {
      filter.$or = [
        { complaintId : { $regex: search, $options: 'i' } },
        { citizenName : { $regex: search, $options: 'i' } },
        { title       : { $regex: search, $options: 'i' } },
      ];
    }

    const total      = await Complaint.countDocuments(filter);
    const complaints = await Complaint
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    res.json({ success: true, complaints, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/complaints/stats ─────────────────────────────────
router.get('/stats', protect, async (req, res) => {
  try {
    const filter = buildScopeFilter(req.user);

    const [total, resolved, pending, critical, sos] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.countDocuments({ ...filter, status: 'Resolved' }),
      Complaint.countDocuments({ ...filter, status: { $nin: ['Resolved', 'Rejected'] } }),
      Complaint.countDocuments({ ...filter, priority: 'Critical', status: { $nin: ['Resolved', 'Rejected'] } }),
      Complaint.countDocuments({ ...filter, isSOS: true, status: { $nin: ['Resolved', 'Rejected'] } }),
    ]);

    res.json({ success: true, stats: { total, resolved, pending, critical, sos } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/complaints/:id ───────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const complaint = await Complaint.findOne({
      $or: [{ _id: req.params.id }, { complaintId: req.params.id }],
    });
    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found' });

    // Officers cannot view complaints outside their scope
    const scope = buildScopeFilter(req.user);
    if (scope.category && complaint.category !== scope.category)
      return res.status(403).json({ success: false, message: 'Access denied' });

    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/complaints ──────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'citizen')
      return res.status(403).json({ success: false, message: 'Only citizens can file complaints' });

    const complaint = await Complaint.create({
      ...req.body,
      citizenId   : user._id,
      citizenName : user.name,
      citizenPhone: user.phone,
    });

    // Increment citizen's submission count + award 50 points
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $inc: { complaintsSubmitted: 1, points: 50 } },
      { new: true }
    );

    // Update badge based on new points
    if (updatedUser) {
      let badge = 'Bronze';
      if (updatedUser.points >= 500) badge = 'Gold';
      else if (updatedUser.points >= 200) badge = 'Silver';
      if (badge !== updatedUser.badge) {
        await User.findByIdAndUpdate(user._id, { badge });
      }
    }

    res.status(201).json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/complaints/:id/status ─────────────────────────
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status, adminNote, assignedOfficer } = req.body;

    const complaint = await Complaint.findOne({
      $or: [{ _id: req.params.id }, { complaintId: req.params.id }],
    });
    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found' });

    // Check scope for dept_officer
    const scope = buildScopeFilter(req.user);
    if (scope.category && complaint.category !== scope.category)
      return res.status(403).json({ success: false, message: 'Cannot update complaints outside your department' });

    complaint.status = status || complaint.status;
    if (adminNote)       complaint.adminNote       = adminNote;
    if (assignedOfficer) complaint.assignedOfficer = assignedOfficer;

    // Update timeline
    const timelineMap = {
      'Under Review': 1,
      'In Progress' : 2,
      'Resolved'    : 3,
    };
    const idx = timelineMap[status];
    if (idx !== undefined) {
      for (let i = 0; i <= idx; i++) {
        if (complaint.timeline[i]) {
          complaint.timeline[i].done = true;
          if (!complaint.timeline[i].date)
            complaint.timeline[i].date = new Date().toISOString().split('T')[0];
        }
      }
    }

    await complaint.save();
    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/complaints/:id/resolve ─────────────────────────
router.post('/:id/resolve', protect, async (req, res) => {
  try {
    const adminRoles = ['admin', 'superAdmin', 'dept_officer'];
    if (!adminRoles.includes(req.user.role))
      return res.status(403).json({ success: false, message: 'Admin access required' });

    const { resolvePhoto, adminNote, assignedOfficer } = req.body;

    const complaint = await Complaint.findOne({
      $or: [{ _id: req.params.id }, { complaintId: req.params.id }],
    });
    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found' });

    // Scope check for dept_officer
    const scope = buildScopeFilter(req.user);
    if (scope.category && complaint.category !== scope.category)
      return res.status(403).json({ success: false, message: 'Cannot resolve complaints outside your department' });

    complaint.status         = 'Resolved';
    complaint.resolvePhoto   = resolvePhoto || '';
    complaint.adminNote      = adminNote    || complaint.adminNote;
    complaint.assignedOfficer= assignedOfficer || req.user.name;

    const today = new Date().toISOString().split('T')[0];
    // FIX: safely convert Mongoose subdoc before spreading, then markModified so it saves
    complaint.timeline = complaint.timeline.map(step => {
      const s = typeof step.toObject === 'function' ? step.toObject() : { ...step };
      return { ...s, done: true, date: s.date || today };
    });
    complaint.markModified('timeline');

    await complaint.save();

    // Award points to citizen + update badge
    const updatedCitizen = await User.findByIdAndUpdate(complaint.citizenId, {
      $inc: { points: 100, complaintsResolved: 1 },
    }, { new: true });

    if (updatedCitizen) {
      let badge = 'Bronze';
      if (updatedCitizen.points >= 500) badge = 'Gold';
      else if (updatedCitizen.points >= 200) badge = 'Silver';
      if (badge !== updatedCitizen.badge) {
        await User.findByIdAndUpdate(complaint.citizenId, { badge });
      }
    }

    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/complaints/:id ────────────────────────────────
// superAdmin, dept_officer and admin can delete
router.delete('/:id', protect, async (req, res) => {
  try {
    const allowedRoles = ['superAdmin', 'dept_officer', 'admin'];
    if (!allowedRoles.includes(req.user.role))
      return res.status(403).json({ success: false, message: 'Admin access required to delete complaints' });

    const complaint = await Complaint.findOneAndDelete({
      $or: [{ _id: req.params.id }, { complaintId: req.params.id }],
    });
    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found' });

    res.json({ success: true, message: 'Complaint deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/complaints/:id/feedback ────────────────────────
router.post('/:id/feedback', protect, async (req, res) => {
  try {
    const { rating, comment, resolved } = req.body;
    const complaint = await Complaint.findOne({
      $or: [{ _id: req.params.id }, { complaintId: req.params.id }],
    });
    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found' });

    complaint.feedback = { rating, comment, resolved };
    await complaint.save();
    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/complaints/:id/support ─────────────────────────
router.post('/:id/support', protect, async (req, res) => {
  try {
    const complaint = await Complaint.findOne({
      $or: [{ _id: req.params.id }, { complaintId: req.params.id }],
    });
    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found' });

    if (complaint.supportedBy.includes(req.user._id))
      return res.status(400).json({ success: false, message: 'Already supported' });

    complaint.supportedBy.push(req.user._id);
    complaint.supportCount = complaint.supportedBy.length;
    await complaint.save();
    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;