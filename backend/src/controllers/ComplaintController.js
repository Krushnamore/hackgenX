import { Complaint } from '../models/Complaint.js';
import { User } from '../models/User.js';

// ─────────────────────────────────────────────────────────────
// Helper: add citizenEmail to complaint object for admin views
// ─────────────────────────────────────────────────────────────
const withCitizenEmail = async (complaint) => {
  const obj = complaint.toObject ? complaint.toObject() : { ...complaint };
  if (!obj.citizenEmail && obj.citizenId) {
    try {
      const citizen = await User.findById(obj.citizenId).select('email').lean();
      if (citizen?.email) obj.citizenEmail = citizen.email;
    } catch {}
  }
  return obj;
};

// ─────────────────────────────────────────────────────────────
// POST /api/complaints  — citizen submits a complaint
// ─────────────────────────────────────────────────────────────
export const createComplaint = async (req, res) => {
  try {
    const citizen = req.user;
    const {
      title, description, category, priority, ward, location,
      gpsCoords, photo, estimatedResolution, isSOS, sosType,
    } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ success: false, message: 'Title, description and category are required' });
    }

    const complaint = await Complaint.create({
      citizenId    : citizen._id,
      citizenName  : citizen.name,
      citizenPhone : citizen.phone,
      title, description, category,
      priority     : priority || 'Medium',
      ward         : ward || citizen.ward || 1,
      location     : location || '',
      gpsCoords    : gpsCoords || { lat: 0, lng: 0 },
      photo        : photo || '',
      estimatedResolution: estimatedResolution || '',
      isSOS        : isSOS || false,
      sosType      : sosType || '',
      department   : mapCategoryToDept(category),
    });

    // Award +50 points to citizen
    await User.findByIdAndUpdate(citizen._id, {
      $inc: { points: 50, complaintsSubmitted: 1 },
    });
    await updateBadge(citizen._id);

    // Attach citizenEmail to response so admin board has it
    const complaintObj = await withCitizenEmail(complaint);
    return res.status(201).json({ success: true, complaint: complaintObj });
  } catch (err) {
    console.error('createComplaint error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/complaints  — admin sees ALL; citizen sees their own
// ─────────────────────────────────────────────────────────────
export const getComplaints = async (req, res) => {
  try {
    const { category, priority, status, ward, search, page = 1, limit = 200 } = req.query;
    const filter = {};

    // Citizens only see their own complaints
    if (req.user.role === 'citizen') filter.citizenId = req.user._id;
    // Admins see ALL complaints from all citizens (no filter on citizenId)

    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (status)   filter.status   = status;
    if (ward)     filter.ward     = parseInt(ward);
    if (search)   filter.$or      = [
      { title       : { $regex: search, $options: 'i' } },
      { complaintId : { $regex: search, $options: 'i' } },
      { citizenName : { $regex: search, $options: 'i' } },
    ];

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('citizenId', 'email');  // populate citizen email

    const total = await Complaint.countDocuments(filter);

    // Attach citizenEmail from populated citizenId
    const enriched = complaints.map(c => {
      const obj = c.toObject();
      if (c.citizenId?.email) obj.citizenEmail = c.citizenId.email;
      // Keep citizenId as string for frontend compatibility
      if (obj.citizenId?._id) obj.citizenId = obj.citizenId._id;
      return obj;
    });

    res.json({ success: true, complaints: enriched, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/complaints/:id  — get single complaint
// ─────────────────────────────────────────────────────────────
export const getComplaintById = async (req, res) => {
  try {
    const query = { $or: [{ _id: req.params.id }, { complaintId: req.params.id }] };
    const complaint = await Complaint.findOne(query).populate('citizenId', 'email');
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    // Citizen can only view their own
    const citizenObjId = complaint.citizenId?._id || complaint.citizenId;
    if (req.user.role === 'citizen' && citizenObjId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const obj = complaint.toObject();
    if (complaint.citizenId?.email) obj.citizenEmail = complaint.citizenId.email;
    if (obj.citizenId?._id) obj.citizenId = obj.citizenId._id;

    res.json({ success: true, complaint: obj });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/complaints/:id/status  — admin updates status
// When admin changes status → citizen sees it in real time via refreshComplaints
// ─────────────────────────────────────────────────────────────
export const updateStatus = async (req, res) => {
  try {
    const { status, adminNote, assignedOfficer } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const complaint = await Complaint.findOne({
      $or: [{ _id: req.params.id }, { complaintId: req.params.id }],
    });
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    const today = new Date().toISOString().split('T')[0];

    // Update timeline steps up to new status
    const statusToStep = {
      'Under Review' : 1,
      'In Progress'  : 2,
      'Resolved'     : 3,
    };
    const stepIdx = statusToStep[status];
    if (stepIdx !== undefined) {
      for (let i = 1; i <= stepIdx; i++) {
        if (complaint.timeline[i] && !complaint.timeline[i].done) {
          complaint.timeline[i].done = true;
          complaint.timeline[i].date = today;
        }
      }
    }

    complaint.status = status;
    if (adminNote)       complaint.adminNote = adminNote;
    if (assignedOfficer) complaint.assignedOfficer = assignedOfficer;

    await complaint.save();

    const obj = await withCitizenEmail(complaint);
    res.json({ success: true, complaint: obj });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/complaints/:id/resolve  — admin resolves with proof
// ─────────────────────────────────────────────────────────────
export const resolveComplaint = async (req, res) => {
  try {
    const { resolvePhoto, adminNote, assignedOfficer } = req.body;
    const complaint = await Complaint.findOne({
      $or: [{ _id: req.params.id }, { complaintId: req.params.id }],
    });
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    const today = new Date().toISOString().split('T')[0];

    // Mark all timeline steps done
    complaint.timeline = complaint.timeline.map(step => ({
      ...step.toObject(),
      done: true,
      date: step.date || today,
    }));

    complaint.status          = 'Resolved';
    complaint.resolvePhoto    = resolvePhoto || '';
    complaint.adminNote       = adminNote || complaint.adminNote;
    complaint.assignedOfficer = assignedOfficer || complaint.assignedOfficer;
    await complaint.save();

    // Award +100 pts to citizen
    await User.findByIdAndUpdate(complaint.citizenId, {
      $inc: { points: 100, complaintsResolved: 1 },
    });
    await updateBadge(complaint.citizenId);

    const obj = await withCitizenEmail(complaint);
    res.json({ success: true, complaint: obj });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/complaints/:id/support
// ─────────────────────────────────────────────────────────────
export const supportComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findOne({
      $or: [{ _id: req.params.id }, { complaintId: req.params.id }],
    });
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    const userId = req.user._id;
    if (complaint.supportedBy.includes(userId)) {
      return res.status(400).json({ success: false, message: 'Already supported' });
    }

    complaint.supportedBy.push(userId);
    complaint.supportCount = complaint.supportedBy.length;
    await complaint.save();

    // +10 pts to original citizen
    await User.findByIdAndUpdate(complaint.citizenId, { $inc: { points: 10 } });
    await updateBadge(complaint.citizenId);

    res.json({ success: true, supportCount: complaint.supportCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/complaints/:id/feedback
// ─────────────────────────────────────────────────────────────
export const submitFeedback = async (req, res) => {
  try {
    const { rating, comment, resolved } = req.body;
    const complaint = await Complaint.findOne({
      $or: [{ _id: req.params.id }, { complaintId: req.params.id }],
    });

    if (!complaint) return res.status(404).json({ success: false, message: 'Not found' });
    if (complaint.status !== 'Resolved')
      return res.status(400).json({ success: false, message: 'Can only rate resolved complaints' });
    if (complaint.citizenId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not your complaint' });
    if (complaint.feedback)
      return res.status(400).json({ success: false, message: 'Already submitted feedback' });

    complaint.feedback = { rating, comment, resolved };
    await complaint.save();

    // +25 pts
    await User.findByIdAndUpdate(req.user._id, { $inc: { points: 25 } });
    await updateBadge(req.user._id);

    const obj = await withCitizenEmail(complaint);
    res.json({ success: true, complaint: obj });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/complaints/:id  — admin only
// ─────────────────────────────────────────────────────────────
export const deleteComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findOneAndDelete({
      $or: [{ _id: req.params.id }, { complaintId: req.params.id }],
    });
    if (!complaint) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Complaint deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/complaints/stats  — admin dashboard
// ─────────────────────────────────────────────────────────────
export const getStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [total, resolvedToday, critical, feedbacks] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: 'Resolved', updatedAt: { $gte: new Date(today) } }),
      Complaint.countDocuments({ priority: 'Critical', status: { $nin: ['Resolved', 'Rejected'] } }),
      Complaint.find({ feedback: { $ne: null } }, 'feedback'),
    ]);

    const avgRating = feedbacks.length
      ? (feedbacks.reduce((s, c) => s + (c.feedback?.rating || 0), 0) / feedbacks.length).toFixed(1)
      : 0;

    const catAgg  = await Complaint.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
    const wardAgg = await Complaint.aggregate([{ $group: { _id: '$ward',     count: { $sum: 1 } } }]);

    res.json({
      success: true,
      stats: {
        total, resolvedToday, critical,
        satisfaction : Math.round(Number(avgRating) * 20),
        categories   : catAgg.map(a  => ({ name: a._id, count: a.count })),
        wards        : wardAgg.map(a => ({ ward: a._id, count: a.count })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const mapCategoryToDept = (cat) => ({
  Road        : 'Roads & Infrastructure',
  Water       : 'Water Supply',
  Sanitation  : 'Sanitation',
  Electricity : 'Electricity',
  Other       : 'General Administration',
}[cat] || 'General Administration');

const updateBadge = async (userId) => {
  const user = await User.findById(userId);
  if (!user || user.role !== 'citizen') return;
  user.updateBadge();
  await user.save();
};